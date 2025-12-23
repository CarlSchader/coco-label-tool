"""COCO annotation type detection and counting.

This module provides utilities for detecting the type of COCO annotations
and counting annotations by type. COCO supports multiple annotation types:

- Object Detection: bbox, segmentation, category_id
- Keypoint Detection: keypoints, num_keypoints (extends object detection)
- Panoptic Segmentation: segments_info, file_name
- Image Captioning: caption
- DensePose: dp_I, dp_U, dp_V, dp_x, dp_y, dp_masks
"""

from enum import Enum
from typing import Dict, List, Set


class AnnotationType(str, Enum):
    """COCO annotation types."""

    OBJECT_DETECTION = "object_detection"
    KEYPOINT = "keypoint"
    PANOPTIC = "panoptic"
    CAPTIONING = "captioning"
    DENSEPOSE = "densepose"


def detect_annotation_type(annotation: dict) -> AnnotationType:
    """Detect COCO annotation type by examining its structure.

    Detection priority (first match wins):
    1. caption field (not None) -> CAPTIONING
    2. dp_I or dp_masks field -> DENSEPOSE
    3. keypoints field (not None) -> KEYPOINT
    4. segments_info field -> PANOPTIC
    5. Default -> OBJECT_DETECTION

    Args:
        annotation: A COCO annotation dictionary

    Returns:
        The detected AnnotationType
    """
    # Priority 1: Captioning (has caption field)
    if annotation.get("caption") is not None:
        return AnnotationType.CAPTIONING

    # Priority 2: DensePose (has dp_I or dp_masks)
    if annotation.get("dp_I") is not None or annotation.get("dp_masks") is not None:
        return AnnotationType.DENSEPOSE

    # Priority 3: Keypoint detection (has keypoints)
    if annotation.get("keypoints") is not None:
        return AnnotationType.KEYPOINT

    # Priority 4: Panoptic segmentation (has segments_info)
    if annotation.get("segments_info") is not None:
        return AnnotationType.PANOPTIC

    # Default: Object detection
    return AnnotationType.OBJECT_DETECTION


def count_annotation_types_for_image(annotations: List[dict]) -> Dict[str, int]:
    """Count annotations by type for a single image.

    Args:
        annotations: List of annotation dictionaries for one image

    Returns:
        Dictionary mapping annotation type names to counts.
        Only includes types with count > 0.

    Example:
        >>> annotations = [
        ...     {"id": 1, "category_id": 5},
        ...     {"id": 2, "caption": "A cat"},
        ... ]
        >>> count_annotation_types_for_image(annotations)
        {"object_detection": 1, "captioning": 1}
    """
    if not annotations:
        return {}

    counts: Dict[str, int] = {}
    for annotation in annotations:
        ann_type = detect_annotation_type(annotation)
        type_name = ann_type.value
        counts[type_name] = counts.get(type_name, 0) + 1

    return counts


def count_annotation_types_batch(
    annotations_by_image: Dict[int, List[dict]], image_ids: Set[int]
) -> Dict[int, Dict[str, int]]:
    """Batch count annotation types for multiple images.

    Args:
        annotations_by_image: Dictionary mapping image_id to list of annotations
        image_ids: Set of image IDs to process

    Returns:
        Dictionary mapping image_id to annotation type counts.
        Images not in annotations_by_image will have empty counts.

    Example:
        >>> annotations_by_image = {
        ...     100: [{"id": 1, "category_id": 5}],
        ...     101: [{"id": 2, "caption": "Test"}],
        ... }
        >>> count_annotation_types_batch(annotations_by_image, {100, 101})
        {100: {"object_detection": 1}, 101: {"captioning": 1}}
    """
    result: Dict[int, Dict[str, int]] = {}

    for image_id in image_ids:
        annotations = annotations_by_image.get(image_id, [])
        result[image_id] = count_annotation_types_for_image(annotations)

    return result


def get_total_annotation_count(type_counts: Dict[str, int]) -> int:
    """Sum all annotation counts.

    Args:
        type_counts: Dictionary of annotation type counts

    Returns:
        Total count across all types

    Example:
        >>> get_total_annotation_count({"object_detection": 5, "captioning": 3})
        8
    """
    return sum(type_counts.values())
