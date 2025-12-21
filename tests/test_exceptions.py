"""Unit tests for custom exceptions."""

import pytest
from unittest.mock import patch

with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.exceptions import (
                DatasetError,
                ImageNotFoundError,
                AnnotationNotFoundError,
                CategoryNotFoundError,
                CategoryInUseError,
                SegmentationError,
            )


class TestExceptionHierarchy:
    def test_dataset_error_is_base(self):
        """Test DatasetError is Exception subclass."""
        assert issubclass(DatasetError, Exception)

    def test_image_not_found_inherits(self):
        """Test ImageNotFoundError inherits from DatasetError."""
        assert issubclass(ImageNotFoundError, DatasetError)
        assert issubclass(ImageNotFoundError, Exception)

    def test_annotation_not_found_inherits(self):
        """Test AnnotationNotFoundError inherits from DatasetError."""
        assert issubclass(AnnotationNotFoundError, DatasetError)

    def test_category_not_found_inherits(self):
        """Test CategoryNotFoundError inherits from DatasetError."""
        assert issubclass(CategoryNotFoundError, DatasetError)

    def test_category_in_use_inherits(self):
        """Test CategoryInUseError inherits from DatasetError."""
        assert issubclass(CategoryInUseError, DatasetError)

    def test_segmentation_error_independent(self):
        """Test SegmentationError does not inherit from DatasetError."""
        assert issubclass(SegmentationError, Exception)
        assert not issubclass(SegmentationError, DatasetError)


class TestExceptionMessages:
    def test_image_not_found_message(self):
        """Test ImageNotFoundError message."""
        error = ImageNotFoundError("Image 123 not found")
        assert str(error) == "Image 123 not found"

    def test_annotation_not_found_message(self):
        """Test AnnotationNotFoundError message."""
        error = AnnotationNotFoundError("Annotation 456 not found")
        assert str(error) == "Annotation 456 not found"

    def test_category_in_use_message(self):
        """Test CategoryInUseError message."""
        error = CategoryInUseError("Category is in use")
        assert str(error) == "Category is in use"

    def test_segmentation_error_message(self):
        """Test SegmentationError message."""
        error = SegmentationError("SAM2 inference failed")
        assert str(error) == "SAM2 inference failed"


class TestExceptionRaising:
    def test_can_raise_and_catch_dataset_error(self):
        """Test raising and catching DatasetError."""
        with pytest.raises(DatasetError):
            raise DatasetError("Test error")

    def test_can_raise_and_catch_specific(self):
        """Test raising specific error catches as DatasetError."""
        with pytest.raises(DatasetError):
            raise ImageNotFoundError("Image not found")

    def test_can_catch_specific_error(self):
        """Test catching specific error type."""
        with pytest.raises(CategoryInUseError):
            raise CategoryInUseError("Category in use")
