"""Tests for annotation type detection and counting."""

import sys
from pathlib import Path


# Add the app directory to path to import annotation_types directly
# This avoids triggering config.py which requires DATASET_PATH
sys.path.insert(0, str(Path(__file__).parent.parent / "coco_label_tool" / "app"))

from annotation_types import (
    AnnotationType,
    count_annotation_types_batch,
    count_annotation_types_for_image,
    detect_annotation_type,
    get_total_annotation_count,
)


class TestDetectAnnotationType:
    """Tests for detect_annotation_type function."""

    def test_detect_object_detection_basic(self):
        """Object detection annotation with standard fields."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 5,
            "segmentation": [[10, 10, 20, 10, 20, 20, 10, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
            "iscrowd": 0,
        }
        assert detect_annotation_type(annotation) == AnnotationType.OBJECT_DETECTION

    def test_detect_object_detection_minimal(self):
        """Object detection with minimal fields."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 5,
        }
        assert detect_annotation_type(annotation) == AnnotationType.OBJECT_DETECTION

    def test_detect_captioning(self):
        """Captioning annotation with caption field."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "caption": "A person riding a bicycle",
        }
        assert detect_annotation_type(annotation) == AnnotationType.CAPTIONING

    def test_detect_captioning_empty_caption(self):
        """Captioning annotation with empty caption."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "caption": "",
        }
        assert detect_annotation_type(annotation) == AnnotationType.CAPTIONING

    def test_detect_keypoint(self):
        """Keypoint detection annotation."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "segmentation": [[10, 10, 20, 10, 20, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
            "iscrowd": 0,
            "keypoints": [15.0, 15.0, 2.0, 18.0, 12.0, 2.0],
            "num_keypoints": 2,
        }
        assert detect_annotation_type(annotation) == AnnotationType.KEYPOINT

    def test_detect_keypoint_empty_keypoints(self):
        """Keypoint detection with empty keypoints array."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "keypoints": [],
            "num_keypoints": 0,
        }
        assert detect_annotation_type(annotation) == AnnotationType.KEYPOINT

    def test_detect_panoptic(self):
        """Panoptic segmentation annotation."""
        annotation = {
            "image_id": 100,
            "file_name": "segmentation_100.png",
            "segments_info": [
                {
                    "id": 1,
                    "category_id": 1,
                    "area": 100,
                    "bbox": [10, 10, 10, 10],
                    "iscrowd": 0,
                }
            ],
        }
        assert detect_annotation_type(annotation) == AnnotationType.PANOPTIC

    def test_detect_panoptic_empty_segments(self):
        """Panoptic segmentation with empty segments_info."""
        annotation = {
            "image_id": 100,
            "file_name": "segmentation_100.png",
            "segments_info": [],
        }
        assert detect_annotation_type(annotation) == AnnotationType.PANOPTIC

    def test_detect_densepose_with_dp_i(self):
        """DensePose annotation detected by dp_I field."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "dp_I": [1.0, 2.0, 3.0],
            "dp_U": [0.5, 0.6, 0.7],
            "dp_V": [0.8, 0.9, 1.0],
            "dp_x": [10.0, 20.0, 30.0],
            "dp_y": [15.0, 25.0, 35.0],
        }
        assert detect_annotation_type(annotation) == AnnotationType.DENSEPOSE

    def test_detect_densepose_with_dp_masks(self):
        """DensePose annotation detected by dp_masks field."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "dp_masks": [{"counts": [100, 50], "size": [640, 480]}],
        }
        assert detect_annotation_type(annotation) == AnnotationType.DENSEPOSE

    def test_detect_densepose_full(self):
        """Full DensePose annotation with all fields."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "iscrowd": 0,
            "area": 1500,
            "bbox": [100.0, 100.0, 50.0, 30.0],
            "dp_I": [1.0, 2.0, 3.0],
            "dp_U": [0.5, 0.6, 0.7],
            "dp_V": [0.8, 0.9, 1.0],
            "dp_x": [10.0, 20.0, 30.0],
            "dp_y": [15.0, 25.0, 35.0],
            "dp_masks": [{"counts": [100, 50], "size": [640, 480]}],
        }
        assert detect_annotation_type(annotation) == AnnotationType.DENSEPOSE


class TestDetectAnnotationTypePriority:
    """Tests for annotation type detection priority order."""

    def test_caption_takes_priority_over_object_detection(self):
        """Caption field should take priority even with other fields."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "caption": "A test caption",
            "segmentation": [[10, 10, 20, 20]],
            "bbox": [10, 10, 10, 10],
        }
        assert detect_annotation_type(annotation) == AnnotationType.CAPTIONING

    def test_densepose_takes_priority_over_keypoint(self):
        """DensePose fields should take priority over keypoint."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "keypoints": [15.0, 15.0, 2.0],
            "dp_I": [1.0, 2.0],
        }
        assert detect_annotation_type(annotation) == AnnotationType.DENSEPOSE

    def test_keypoint_takes_priority_over_panoptic(self):
        """Keypoint should take priority over panoptic."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "category_id": 1,
            "keypoints": [15.0, 15.0, 2.0],
            "segments_info": [],
        }
        assert detect_annotation_type(annotation) == AnnotationType.KEYPOINT

    def test_panoptic_takes_priority_over_object_detection(self):
        """Panoptic should take priority over object detection."""
        annotation = {
            "image_id": 100,
            "category_id": 1,
            "segmentation": [[10, 10, 20, 20]],
            "segments_info": [],
        }
        assert detect_annotation_type(annotation) == AnnotationType.PANOPTIC


class TestDetectAnnotationTypeEdgeCases:
    """Edge case tests for annotation type detection."""

    def test_empty_annotation(self):
        """Empty annotation defaults to object detection."""
        annotation = {}
        assert detect_annotation_type(annotation) == AnnotationType.OBJECT_DETECTION

    def test_only_image_id(self):
        """Annotation with only image_id defaults to object detection."""
        annotation = {"image_id": 100}
        assert detect_annotation_type(annotation) == AnnotationType.OBJECT_DETECTION

    def test_none_values_not_detected(self):
        """None values should not trigger detection."""
        annotation = {
            "id": 1,
            "image_id": 100,
            "caption": None,
            "keypoints": None,
        }
        assert detect_annotation_type(annotation) == AnnotationType.OBJECT_DETECTION


class TestCountAnnotationTypesForImage:
    """Tests for count_annotation_types_for_image function."""

    def test_empty_annotations(self):
        """Empty annotation list returns empty dict."""
        result = count_annotation_types_for_image([])
        assert result == {}

    def test_single_object_detection(self):
        """Single object detection annotation."""
        annotations = [
            {"id": 1, "image_id": 100, "category_id": 5, "bbox": [10, 10, 10, 10]}
        ]
        result = count_annotation_types_for_image(annotations)
        assert result == {"object_detection": 1}

    def test_multiple_same_type(self):
        """Multiple annotations of same type."""
        annotations = [
            {"id": 1, "image_id": 100, "category_id": 5},
            {"id": 2, "image_id": 100, "category_id": 6},
            {"id": 3, "image_id": 100, "category_id": 7},
        ]
        result = count_annotation_types_for_image(annotations)
        assert result == {"object_detection": 3}

    def test_mixed_types(self):
        """Mixed annotation types."""
        annotations = [
            {"id": 1, "image_id": 100, "category_id": 5},
            {"id": 2, "image_id": 100, "caption": "A test"},
            {"id": 3, "image_id": 100, "caption": "Another test"},
            {"id": 4, "image_id": 100, "keypoints": [1.0, 2.0, 1.0]},
        ]
        result = count_annotation_types_for_image(annotations)
        assert result == {"object_detection": 1, "captioning": 2, "keypoint": 1}

    def test_all_five_types(self):
        """All five annotation types present."""
        annotations = [
            {"id": 1, "image_id": 100, "category_id": 5},
            {"id": 2, "image_id": 100, "caption": "Test"},
            {"id": 3, "image_id": 100, "keypoints": [1.0, 2.0, 1.0]},
            {"image_id": 100, "segments_info": []},
            {"id": 5, "image_id": 100, "dp_I": [1.0]},
        ]
        result = count_annotation_types_for_image(annotations)
        assert result == {
            "object_detection": 1,
            "captioning": 1,
            "keypoint": 1,
            "panoptic": 1,
            "densepose": 1,
        }

    def test_only_returns_nonzero_counts(self):
        """Result should not include types with zero count."""
        annotations = [{"id": 1, "image_id": 100, "caption": "Test"}]
        result = count_annotation_types_for_image(annotations)
        assert "object_detection" not in result
        assert "keypoint" not in result
        assert result == {"captioning": 1}


class TestCountAnnotationTypesBatch:
    """Tests for count_annotation_types_batch function."""

    def test_empty_inputs(self):
        """Empty inputs return empty dict."""
        result = count_annotation_types_batch({}, set())
        assert result == {}

    def test_empty_image_ids(self):
        """Empty image_ids set returns empty dict."""
        annotations_by_image = {100: [{"id": 1, "image_id": 100, "category_id": 5}]}
        result = count_annotation_types_batch(annotations_by_image, set())
        assert result == {}

    def test_single_image(self):
        """Single image with annotations."""
        annotations_by_image = {
            100: [
                {"id": 1, "image_id": 100, "category_id": 5},
                {"id": 2, "image_id": 100, "caption": "Test"},
            ]
        }
        result = count_annotation_types_batch(annotations_by_image, {100})
        assert result == {100: {"object_detection": 1, "captioning": 1}}

    def test_multiple_images(self):
        """Multiple images with different annotations."""
        annotations_by_image = {
            100: [{"id": 1, "image_id": 100, "category_id": 5}],
            101: [
                {"id": 2, "image_id": 101, "caption": "Test1"},
                {"id": 3, "image_id": 101, "caption": "Test2"},
            ],
            102: [],
        }
        result = count_annotation_types_batch(annotations_by_image, {100, 101, 102})
        assert result == {
            100: {"object_detection": 1},
            101: {"captioning": 2},
            102: {},
        }

    def test_subset_of_images(self):
        """Only process requested image_ids."""
        annotations_by_image = {
            100: [{"id": 1, "image_id": 100, "category_id": 5}],
            101: [{"id": 2, "image_id": 101, "caption": "Test"}],
            102: [{"id": 3, "image_id": 102, "keypoints": [1.0]}],
        }
        result = count_annotation_types_batch(annotations_by_image, {100, 102})
        assert 101 not in result
        assert result == {100: {"object_detection": 1}, 102: {"keypoint": 1}}

    def test_missing_image_id_in_annotations(self):
        """Image ID not in annotations_by_image returns empty counts."""
        annotations_by_image = {100: [{"id": 1, "image_id": 100, "category_id": 5}]}
        result = count_annotation_types_batch(annotations_by_image, {100, 999})
        assert result == {100: {"object_detection": 1}, 999: {}}


class TestGetTotalAnnotationCount:
    """Tests for get_total_annotation_count function."""

    def test_empty_counts(self):
        """Empty dict returns 0."""
        assert get_total_annotation_count({}) == 0

    def test_single_type(self):
        """Single type count."""
        assert get_total_annotation_count({"object_detection": 5}) == 5

    def test_multiple_types(self):
        """Multiple types sum correctly."""
        counts = {"object_detection": 5, "captioning": 3, "keypoint": 2}
        assert get_total_annotation_count(counts) == 10

    def test_all_types(self):
        """All five types sum correctly."""
        counts = {
            "object_detection": 10,
            "keypoint": 5,
            "panoptic": 3,
            "captioning": 7,
            "densepose": 2,
        }
        assert get_total_annotation_count(counts) == 27


class TestAnnotationTypeEnum:
    """Tests for AnnotationType enum."""

    def test_enum_values(self):
        """Verify all enum values."""
        assert AnnotationType.OBJECT_DETECTION == "object_detection"
        assert AnnotationType.KEYPOINT == "keypoint"
        assert AnnotationType.PANOPTIC == "panoptic"
        assert AnnotationType.CAPTIONING == "captioning"
        assert AnnotationType.DENSEPOSE == "densepose"

    def test_enum_string_conversion(self):
        """Enum values can be used as strings."""
        assert AnnotationType.OBJECT_DETECTION.value == "object_detection"
        assert f"{AnnotationType.CAPTIONING.value}" == "captioning"

    def test_enum_membership(self):
        """Test enum membership."""
        assert "object_detection" in [e.value for e in AnnotationType]
        assert "invalid_type" not in [e.value for e in AnnotationType]
