"""Dataset operations for COCO format JSON."""

import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import cv2
import numpy as np

from .config import DATASET_IS_S3, DATASET_JSON, DATASET_URI
from .exceptions import AnnotationNotFoundError, CategoryInUseError, ImageNotFoundError
from .s3_state import s3_state
from .uri_utils import (
    load_json_from_uri,
    resolve_image_uri,
    save_cache_metadata,
    upload_json_to_s3,
)


def _get_local_json_path() -> Path:
    """Get the path to the local JSON file (original or cached).

    For local datasets, returns DATASET_JSON.
    For S3 datasets, returns the cached local path from s3_state.
    """
    if DATASET_IS_S3:
        local_path = s3_state.get_local_path()
        if local_path is None:
            # Need to initialize - load from S3
            _initialize_s3_dataset()
            local_path = s3_state.get_local_path()
        return local_path  # type: ignore
    else:
        return DATASET_JSON  # type: ignore


def _initialize_s3_dataset() -> None:
    """Initialize S3 dataset by downloading and caching."""
    data, local_path = load_json_from_uri(DATASET_URI)
    s3_state.set_local_path(local_path)


def _load_dataset() -> Dict[str, Any]:
    """Load dataset from local file or S3 cache."""
    local_path = _get_local_json_path()
    with open(local_path, "r") as f:
        return json.load(f)


def _save_dataset(data: Dict[str, Any]) -> None:
    """Save dataset to local file and mark dirty if S3."""
    local_path = _get_local_json_path()
    with open(local_path, "w") as f:
        json.dump(data, f, indent=2)

    # Mark as dirty if S3 dataset (has unsaved remote changes)
    if DATASET_IS_S3:
        s3_state.mark_dirty()


def resolve_image_path(file_name: str) -> str:
    """Resolve image path from file_name.

    For local datasets: resolves relative to DATASET_DIR.
    For S3 datasets: resolves relative to DATASET_URI.
    """
    return resolve_image_uri(file_name, DATASET_URI)


def load_full_metadata() -> Dict:
    """Load dataset metadata without loading all images."""
    data = _load_dataset()
    return {
        "info": data.get("info", {}),
        "licenses": data.get("licenses", []),
        "categories": data.get("categories", []),
        "total_images": len(data.get("images", [])),
    }


def load_images_range(
    start: int, end: int
) -> Tuple[List[Dict], Dict[int, Dict], Dict[int, List], Set[int]]:
    """Load a range of images and their annotations."""
    data = _load_dataset()
    images = data.get("images", [])
    annotations = data.get("annotations", [])

    selected_images = []
    for i in range(start, end):
        if i < len(images):
            img = images[i].copy()
            img["index"] = i
            selected_images.append(img)

    image_ids = {img["id"] for img in selected_images}
    selected_annotations = [ann for ann in annotations if ann["image_id"] in image_ids]

    image_map = {img["index"]: img for img in selected_images}

    annotations_by_image: Dict[int, List] = {}
    for ann in selected_annotations:
        img_id = ann["image_id"]
        if img_id not in annotations_by_image:
            annotations_by_image[img_id] = []
        annotations_by_image[img_id].append(ann)

    cached_indices = set(range(start, end))

    return selected_images, image_map, annotations_by_image, cached_indices


def get_categories() -> List[Dict]:
    """Get all categories."""
    data = _load_dataset()
    return data.get("categories", [])


def save_dataset(images: List[Dict], annotations: List[Dict]) -> None:
    """Save dataset to JSON file."""
    data = _load_dataset()
    data["images"] = images
    data["annotations"] = annotations
    _save_dataset(data)


def add_category(name: str, supercategory: str) -> Dict:
    """Add a new category."""
    data = _load_dataset()

    categories = data.get("categories", [])
    new_id = max([cat["id"] for cat in categories], default=0) + 1

    new_category = {"id": new_id, "name": name, "supercategory": supercategory}

    categories.append(new_category)
    data["categories"] = categories

    _save_dataset(data)
    return new_category


def update_category(category_id: int, name: str, supercategory: str) -> None:
    """Update an existing category."""
    data = _load_dataset()

    categories = data.get("categories", [])
    for cat in categories:
        if cat["id"] == category_id:
            cat["name"] = name
            cat["supercategory"] = supercategory
            break

    data["categories"] = categories
    _save_dataset(data)


def delete_category(category_id: int) -> None:
    """Delete a category."""
    data = _load_dataset()

    annotations = data.get("annotations", [])
    if any(ann["category_id"] == category_id for ann in annotations):
        raise CategoryInUseError(
            "Cannot delete category: it is used by one or more annotations"
        )

    categories = [cat for cat in data.get("categories", []) if cat["id"] != category_id]
    data["categories"] = categories

    _save_dataset(data)


def get_annotations_by_image(image_id: int) -> List[Dict]:
    """Get all annotations for a specific image."""
    data = _load_dataset()
    annotations = data.get("annotations", [])
    return [ann for ann in annotations if ann["image_id"] == image_id]


def add_annotation(
    image_id: int, category_id: int, segmentation: List[List[float]]
) -> Dict:
    """Add a new annotation."""
    data = _load_dataset()

    annotations = data.get("annotations", [])
    new_id = max([ann["id"] for ann in annotations], default=0) + 1

    x_coords = []
    y_coords = []
    for polygon in segmentation:
        for i in range(0, len(polygon), 2):
            x_coords.append(polygon[i])
            y_coords.append(polygon[i + 1])

    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    bbox = [x_min, y_min, x_max - x_min, y_max - y_min]

    area = float(
        np.sum(
            [
                cv2.contourArea(
                    np.array(
                        [
                            [polygon[i], polygon[i + 1]]
                            for i in range(0, len(polygon), 2)
                        ],
                        dtype=np.float32,
                    )
                )
                for polygon in segmentation
            ]
        )
    )

    new_annotation = {
        "id": new_id,
        "image_id": image_id,
        "category_id": category_id,
        "segmentation": segmentation,
        "bbox": bbox,
        "area": area,
        "iscrowd": 0,
    }

    annotations.append(new_annotation)
    data["annotations"] = annotations

    _save_dataset(data)
    return new_annotation


def update_annotation(annotation_id: int, category_id: int) -> Dict:
    """Update an annotation's category."""
    data = _load_dataset()

    annotation = None
    for ann in data.get("annotations", []):
        if ann["id"] == annotation_id:
            ann["category_id"] = category_id
            annotation = ann
            break

    if not annotation:
        raise AnnotationNotFoundError("Annotation not found")

    _save_dataset(data)
    return annotation


def delete_annotation(annotation_id: int) -> None:
    """Delete an annotation."""
    data = _load_dataset()

    annotations = [
        ann for ann in data.get("annotations", []) if ann["id"] != annotation_id
    ]
    data["annotations"] = annotations

    _save_dataset(data)


def delete_image(image_id: int) -> None:
    """Delete an image and its annotations."""
    data = _load_dataset()

    image_to_delete = None
    for img in data["images"]:
        if img["id"] == image_id:
            image_to_delete = img
            break

    if not image_to_delete:
        raise ImageNotFoundError("Image not found")

    # Only delete local files, not S3 files
    if not DATASET_IS_S3:
        image_path = Path(resolve_image_path(image_to_delete["file_name"]))
        if image_path.exists():
            image_path.unlink()

    data["images"] = [img for img in data["images"] if img["id"] != image_id]
    data["annotations"] = [
        ann for ann in data.get("annotations", []) if ann["image_id"] != image_id
    ]

    _save_dataset(data)


# S3-specific functions


def save_dataset_to_s3() -> Dict[str, Any]:
    """Upload local cached JSON back to S3.

    Returns:
        Upload status with ETag

    Raises:
        ValueError: If not an S3 dataset or no dataset loaded
        RuntimeError: If upload fails
    """
    if not DATASET_IS_S3:
        raise ValueError("Cannot save to S3: dataset is not from S3")

    local_path = s3_state.get_local_path()
    if local_path is None:
        raise ValueError("No local dataset loaded")

    # Upload to S3 (with retry logic in uri_utils)
    s3_metadata = upload_json_to_s3(DATASET_URI, local_path)

    # Update cache metadata with new ETag
    save_cache_metadata(DATASET_URI, s3_metadata)

    # Mark as clean (no more unsaved changes)
    s3_state.mark_clean()

    return {
        "status": "success",
        "s3_uri": DATASET_URI,
        "etag": s3_metadata.get("ETag", "").strip('"'),
        "size": s3_metadata.get("ContentLength"),
    }


def get_s3_dirty_status() -> bool:
    """Check if there are unsaved changes for S3 dataset."""
    return s3_state.get_dirty_status()
