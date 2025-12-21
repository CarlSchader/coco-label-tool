"""Dataset operations for COCO format JSON.

This module provides the public API for dataset operations. All data access
and mutations are delegated to the DatasetManager singleton, which keeps
the dataset in memory and handles periodic auto-save to disk.
"""

from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import cv2
import numpy as np

from .config import DATASET_IS_S3, DATASET_JSON, DATASET_URI
from .dataset_manager import dataset_manager
from .exceptions import AnnotationNotFoundError, CategoryInUseError, ImageNotFoundError
from .s3_state import s3_state
from .uri_utils import (
    load_json_from_uri,
    resolve_image_uri,
    save_cache_metadata,
    upload_json_to_s3,
)


# =============================================================================
# Initialization Functions (called at startup)
# =============================================================================


def get_local_json_path() -> Path:
    """Get the path to the local JSON file (original or cached).

    For local datasets, returns DATASET_JSON.
    For S3 datasets, downloads and caches the file, then returns the cache path.

    This function should be called at startup to get the path for loading
    into the DatasetManager.
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


def resolve_image_path(file_name: str) -> str:
    """Resolve image path from file_name.

    For local datasets: resolves relative to DATASET_DIR.
    For S3 datasets: resolves relative to DATASET_URI.
    """
    return resolve_image_uri(file_name, DATASET_URI)


# =============================================================================
# Read Operations (delegate to DatasetManager)
# =============================================================================


def load_full_metadata() -> Dict:
    """Load dataset metadata without loading all images."""
    return {
        "info": dataset_manager.get_info(),
        "licenses": dataset_manager.get_licenses(),
        "categories": dataset_manager.get_categories(),
        "total_images": len(dataset_manager.get_images()),
    }


def load_images_range(
    start: int, end: int
) -> Tuple[List[Dict], Dict[int, Dict], Dict[int, List], Set[int]]:
    """Load a range of images and their annotations."""
    images = dataset_manager.get_images()
    annotations = dataset_manager.get_annotations()

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
    return dataset_manager.get_categories()


def get_annotations_by_image(image_id: int) -> List[Dict]:
    """Get all annotations for a specific image."""
    annotations = dataset_manager.get_annotations()
    return [ann for ann in annotations if ann["image_id"] == image_id]


# =============================================================================
# Write Operations (delegate to DatasetManager)
# =============================================================================


def save_dataset(images: List[Dict], annotations: List[Dict]) -> None:
    """Save dataset to JSON file (bulk replacement).

    This is a bulk operation that replaces all images and annotations,
    then forces an immediate write to disk.
    """
    dataset_manager.set_images(images)
    dataset_manager.set_annotations(annotations)
    # Force immediate save for bulk operations (mark dirty first since
    # set_images/set_annotations don't track changes)
    dataset_manager._changes.annotations_updated = 1  # Force dirty flag
    dataset_manager.flush()


def add_category(name: str, supercategory: str) -> Dict:
    """Add a new category."""
    new_id = dataset_manager.get_next_category_id()
    new_category = {"id": new_id, "name": name, "supercategory": supercategory}
    dataset_manager.add_category(new_category)
    return new_category


def update_category(category_id: int, name: str, supercategory: str) -> None:
    """Update an existing category."""
    dataset_manager.update_category(
        category_id, {"name": name, "supercategory": supercategory}
    )


def delete_category(category_id: int) -> None:
    """Delete a category.

    Raises:
        CategoryInUseError: If the category is used by any annotation
    """
    # Check if category is in use
    annotations = dataset_manager.get_annotations()
    if any(ann["category_id"] == category_id for ann in annotations):
        raise CategoryInUseError(
            "Cannot delete category: it is used by one or more annotations"
        )

    dataset_manager.delete_category(category_id)


def add_annotation(
    image_id: int, category_id: int, segmentation: List[List[float]]
) -> Dict:
    """Add a new annotation.

    Calculates bbox and area from the segmentation polygons.
    """
    new_id = dataset_manager.get_next_annotation_id()

    # Calculate bounding box from segmentation
    x_coords = []
    y_coords = []
    for polygon in segmentation:
        for i in range(0, len(polygon), 2):
            x_coords.append(polygon[i])
            y_coords.append(polygon[i + 1])

    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    bbox = [x_min, y_min, x_max - x_min, y_max - y_min]

    # Calculate area using OpenCV
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

    dataset_manager.add_annotation(new_annotation)
    return new_annotation


def update_annotation(annotation_id: int, category_id: int) -> Dict:
    """Update an annotation's category.

    Raises:
        AnnotationNotFoundError: If the annotation doesn't exist
    """
    result = dataset_manager.update_annotation(
        annotation_id, {"category_id": category_id}
    )
    if result is None:
        raise AnnotationNotFoundError("Annotation not found")
    return result


def delete_annotation(annotation_id: int) -> None:
    """Delete an annotation."""
    dataset_manager.delete_annotation(annotation_id)


def delete_image(image_id: int) -> None:
    """Delete an image and its annotations.

    For local datasets, also deletes the image file from disk.

    Raises:
        ImageNotFoundError: If the image doesn't exist
    """
    # Find the image first to get file_name for deletion
    images = dataset_manager.get_images()
    image_to_delete = None
    for img in images:
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

    # Delete from dataset (also removes associated annotations)
    dataset_manager.delete_image(image_id)


# =============================================================================
# S3-specific functions
# =============================================================================


def save_dataset_to_s3() -> Dict[str, Any]:
    """Upload local cached JSON back to S3.

    Flushes any pending changes to disk first, then uploads to S3.

    Returns:
        Upload status with ETag

    Raises:
        ValueError: If not an S3 dataset or no dataset loaded
        RuntimeError: If upload fails
    """
    if not DATASET_IS_S3:
        raise ValueError("Cannot save to S3: dataset is not from S3")

    # Flush local changes to disk first
    dataset_manager.flush()

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
