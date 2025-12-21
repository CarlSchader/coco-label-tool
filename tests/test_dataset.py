"""Unit tests for dataset operations.

These tests verify that the dataset module functions correctly delegate
to the DatasetManager and perform proper business logic (bbox calculation,
validation, etc.).
"""

import json
from unittest.mock import patch

import pytest

# Mock environment and path before importing
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.dataset import (
                load_full_metadata,
                load_images_range,
                get_categories,
                save_dataset,
                add_category,
                update_category,
                delete_category,
                get_annotations_by_image,
                add_annotation,
                update_annotation,
                delete_annotation,
                delete_image,
                resolve_image_path,
            )
            from coco_label_tool.app.dataset_manager import dataset_manager
            from coco_label_tool.app.exceptions import (
                CategoryInUseError,
                AnnotationNotFoundError,
                ImageNotFoundError,
            )


MOCK_DATASET = {
    "info": {"description": "Test dataset"},
    "licenses": [],
    "images": [
        {"id": 1, "file_name": "image1.jpg", "width": 640, "height": 480},
        {"id": 2, "file_name": "image2.jpg", "width": 800, "height": 600},
        {"id": 3, "file_name": "image3.jpg", "width": 1024, "height": 768},
    ],
    "annotations": [
        {
            "id": 1,
            "image_id": 1,
            "category_id": 1,
            "segmentation": [[10, 10, 20, 20, 30, 10]],
            "bbox": [10, 10, 20, 10],
            "area": 100,
            "iscrowd": 0,
        },
        {
            "id": 2,
            "image_id": 1,
            "category_id": 2,
            "segmentation": [[50, 50, 60, 60, 70, 50]],
            "bbox": [50, 50, 20, 10],
            "area": 100,
            "iscrowd": 0,
        },
        {
            "id": 3,
            "image_id": 3,
            "category_id": 1,
            "segmentation": [[100, 100, 200, 200, 300, 100]],
            "bbox": [100, 100, 200, 100],
            "area": 10000,
            "iscrowd": 0,
        },
    ],
    "categories": [
        {"id": 1, "name": "dog", "supercategory": "animal"},
        {"id": 2, "name": "cat", "supercategory": "animal"},
        {"id": 3, "name": "bird", "supercategory": "animal"},
    ],
}


@pytest.fixture
def loaded_dataset(tmp_path):
    """Load mock dataset into the DatasetManager."""
    json_path = tmp_path / "dataset.json"
    json_path.write_text(json.dumps(MOCK_DATASET))
    dataset_manager.load(json_path)
    yield
    # Cleanup: cancel any pending timers
    dataset_manager._cancel_timer()
    dataset_manager._data = None
    dataset_manager._local_path = None
    dataset_manager._changes.reset()


class TestLoadFullMetadata:
    def test_load_full_metadata(self, loaded_dataset):
        """Test loading dataset metadata."""
        metadata = load_full_metadata()

        assert metadata["total_images"] == 3
        assert "info" in metadata
        assert "categories" in metadata
        assert len(metadata["categories"]) == 3


class TestLoadImagesRange:
    def test_load_range_valid(self, loaded_dataset):
        """Test loading valid range."""
        images, image_map, annot_by_image, indices = load_images_range(0, 2)

        assert len(images) == 2
        assert len(image_map) == 2
        assert 0 in image_map
        assert 1 in image_map
        assert images[0]["index"] == 0
        assert images[1]["index"] == 1
        assert indices == {0, 1}

    def test_load_range_with_annotations(self, loaded_dataset):
        """Test annotations are grouped correctly."""
        images, image_map, annot_by_image, indices = load_images_range(0, 2)

        assert 1 in annot_by_image
        assert len(annot_by_image[1]) == 2
        assert 2 not in annot_by_image

    def test_load_range_exceeds_dataset(self, loaded_dataset):
        """Test loading range that exceeds dataset size."""
        images, image_map, annot_by_image, indices = load_images_range(0, 100)

        assert len(images) == 3
        assert len(image_map) == 3

    def test_load_range_empty(self, loaded_dataset):
        """Test empty range."""
        images, image_map, annot_by_image, indices = load_images_range(5, 5)

        assert len(images) == 0
        assert len(image_map) == 0
        assert len(annot_by_image) == 0

    def test_load_range_no_annotations(self, loaded_dataset):
        """Test range with image that has no annotations."""
        images, image_map, annot_by_image, indices = load_images_range(1, 2)

        assert len(images) == 1
        assert 2 not in annot_by_image


class TestGetCategories:
    def test_get_categories(self, loaded_dataset):
        """Test retrieving categories."""
        categories = get_categories()

        assert len(categories) == 3
        assert categories[0]["name"] == "dog"
        assert categories[1]["supercategory"] == "animal"


class TestSaveDataset:
    def test_save_dataset(self, loaded_dataset):
        """Test saving dataset preserves structure."""
        new_images = [{"id": 1, "file_name": "new.jpg"}]
        new_annotations = [{"id": 1, "image_id": 1, "category_id": 1}]

        save_dataset(new_images, new_annotations)

        # Verify the data was saved to disk (flush is called)
        # Read from the manager's local path
        json_path = dataset_manager._local_path
        saved_data = json.loads(json_path.read_text())

        assert saved_data["images"] == new_images
        assert saved_data["annotations"] == new_annotations
        assert "categories" in saved_data
        assert "info" in saved_data


class TestAddCategory:
    def test_add_category(self, loaded_dataset):
        """Test adding a new category."""
        new_cat = add_category("fish", "animal")

        assert new_cat["name"] == "fish"
        assert new_cat["supercategory"] == "animal"
        assert new_cat["id"] == 4  # Max existing is 3

        # Verify it's in the dataset
        categories = get_categories()
        assert any(c["id"] == 4 and c["name"] == "fish" for c in categories)

    def test_add_category_empty_list(self, tmp_path):
        """Test adding category when no categories exist."""
        empty_dataset = {**MOCK_DATASET, "categories": []}
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(empty_dataset))
        dataset_manager.load(json_path)

        try:
            new_cat = add_category("first", "none")
            assert new_cat["id"] == 1
        finally:
            dataset_manager._cancel_timer()
            dataset_manager._data = None
            dataset_manager._local_path = None
            dataset_manager._changes.reset()


class TestUpdateCategory:
    def test_update_category_name(self, loaded_dataset):
        """Test updating category name."""
        update_category(1, "puppy", "animal")

        categories = get_categories()
        updated_cat = next(c for c in categories if c["id"] == 1)
        assert updated_cat["name"] == "puppy"

    def test_update_category_supercategory(self, loaded_dataset):
        """Test updating supercategory."""
        update_category(1, "dog", "pet")

        categories = get_categories()
        updated_cat = next(c for c in categories if c["id"] == 1)
        assert updated_cat["supercategory"] == "pet"

    def test_update_nonexistent_category(self, loaded_dataset):
        """Test updating non-existent category silently succeeds."""
        # Should not raise, just does nothing
        update_category(999, "ghost", "none")


class TestDeleteCategory:
    def test_delete_category_in_use(self, loaded_dataset):
        """Test deleting a category that is in use."""
        with pytest.raises(CategoryInUseError):
            delete_category(1)

    def test_delete_category_success(self, loaded_dataset):
        """Test successfully deleting an unused category."""
        # Category 3 (bird) has no annotations
        delete_category(3)

        categories = get_categories()
        assert len(categories) == 2
        assert not any(c["id"] == 3 for c in categories)


class TestGetAnnotationsByImage:
    def test_get_annotations_for_image_with_annotations(self, loaded_dataset):
        """Test getting annotations for an image that has annotations."""
        annotations = get_annotations_by_image(1)
        assert len(annotations) == 2
        assert all(ann["image_id"] == 1 for ann in annotations)
        assert annotations[0]["id"] == 1
        assert annotations[1]["id"] == 2

    def test_get_annotations_for_image_without_annotations(self, loaded_dataset):
        """Test getting annotations for an image that has no annotations."""
        # Image 2 exists but has no annotations in MOCK_DATASET
        annotations = get_annotations_by_image(2)
        assert len(annotations) == 0
        assert annotations == []

    def test_get_annotations_for_nonexistent_image(self, loaded_dataset):
        """Test getting annotations for an image that doesn't exist."""
        annotations = get_annotations_by_image(999)
        assert len(annotations) == 0
        assert annotations == []


class TestAddAnnotation:
    def test_add_annotation_single_polygon(self, loaded_dataset):
        """Test adding annotation with single polygon."""
        with patch("cv2.contourArea", return_value=150.0):
            segmentation = [[10.0, 10.0, 20.0, 10.0, 20.0, 20.0, 10.0, 20.0]]
            annotation = add_annotation(1, 1, segmentation)

            assert annotation["id"] == 4  # Max existing is 3
            assert annotation["image_id"] == 1
            assert annotation["category_id"] == 1
            assert annotation["segmentation"] == segmentation
            assert annotation["iscrowd"] == 0
            assert annotation["bbox"] == [10.0, 10.0, 10.0, 10.0]
            assert annotation["area"] == 150.0

    def test_add_annotation_multiple_polygons(self, loaded_dataset):
        """Test adding annotation with multiple polygons."""
        with patch("cv2.contourArea", return_value=100.0):
            segmentation = [
                [10.0, 10.0, 20.0, 10.0, 20.0, 20.0, 10.0, 20.0],
                [30.0, 30.0, 40.0, 30.0, 40.0, 40.0, 30.0, 40.0],
            ]
            annotation = add_annotation(1, 1, segmentation)

            assert len(annotation["segmentation"]) == 2
            assert annotation["bbox"] == [10.0, 10.0, 30.0, 30.0]

    def test_add_annotation_empty_list(self, tmp_path):
        """Test adding first annotation."""
        dataset_no_annot = {**MOCK_DATASET, "annotations": []}
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(dataset_no_annot))
        dataset_manager.load(json_path)

        try:
            with patch("cv2.contourArea", return_value=100.0):
                annotation = add_annotation(1, 1, [[10.0, 10.0, 20.0, 20.0]])
                assert annotation["id"] == 1
        finally:
            dataset_manager._cancel_timer()
            dataset_manager._data = None
            dataset_manager._local_path = None
            dataset_manager._changes.reset()


class TestUpdateAnnotation:
    def test_update_annotation_category(self, loaded_dataset):
        """Test updating annotation category."""
        annotation = update_annotation(1, 2)

        assert annotation["category_id"] == 2
        assert annotation["id"] == 1

    def test_update_annotation_not_found(self, loaded_dataset):
        """Test AnnotationNotFoundError when annotation doesn't exist."""
        with pytest.raises(AnnotationNotFoundError):
            update_annotation(999, 1)

    def test_update_annotation_preserves_fields(self, loaded_dataset):
        """Test other fields are preserved."""
        annotation = update_annotation(1, 2)

        assert annotation["segmentation"] == [[10, 10, 20, 20, 30, 10]]
        assert annotation["bbox"] == [10, 10, 20, 10]


class TestDeleteAnnotation:
    def test_delete_annotation_exists(self, loaded_dataset):
        """Test deleting existing annotation."""
        delete_annotation(1)

        annotations = get_annotations_by_image(1)
        assert len(annotations) == 1
        assert not any(a["id"] == 1 for a in annotations)

    def test_delete_annotation_nonexistent(self, loaded_dataset):
        """Test deleting non-existent annotation succeeds silently."""
        delete_annotation(999)
        # Should not raise


class TestDeleteImage:
    def test_delete_image_with_annotations(self, loaded_dataset):
        """Test deleting image cascades to annotations."""
        with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
            with patch("pathlib.Path.exists", return_value=True):
                with patch("pathlib.Path.unlink") as mock_unlink:
                    delete_image(1)

                    mock_unlink.assert_called_once()

                    # Verify image removed
                    images = dataset_manager.get_images()
                    assert len(images) == 2
                    assert not any(img["id"] == 1 for img in images)

                    # Verify annotations removed
                    annotations = get_annotations_by_image(1)
                    assert len(annotations) == 0

    def test_delete_image_not_found(self, loaded_dataset):
        """Test ImageNotFoundError when image doesn't exist."""
        with pytest.raises(ImageNotFoundError):
            delete_image(999)

    def test_delete_image_file_not_exists(self, loaded_dataset):
        """Test file deletion when file doesn't exist."""
        with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
            with patch("pathlib.Path.exists", return_value=False):
                with patch("pathlib.Path.unlink") as mock_unlink:
                    delete_image(1)

                    mock_unlink.assert_not_called()

    def test_delete_image_no_annotations(self, tmp_path):
        """Test deleting image without annotations."""
        dataset_no_annot_for_2 = {
            **MOCK_DATASET,
            "annotations": [
                a for a in MOCK_DATASET["annotations"] if a["image_id"] != 2
            ],
        }
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(dataset_no_annot_for_2))
        dataset_manager.load(json_path)

        try:
            with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
                with patch("pathlib.Path.exists", return_value=False):
                    delete_image(2)

                    images = dataset_manager.get_images()
                    assert not any(img["id"] == 2 for img in images)
        finally:
            dataset_manager._cancel_timer()
            dataset_manager._data = None
            dataset_manager._local_path = None
            dataset_manager._changes.reset()


class TestResolveImagePath:
    def test_resolve_relative_path(self):
        """Test resolving relative path."""
        # resolve_image_path now uses DATASET_URI, not DATASET_DIR
        with patch(
            "coco_label_tool.app.dataset.DATASET_URI", "/dataset/dir/dataset.json"
        ):
            result = resolve_image_path("images/test.jpg")
            # Now returns string, not Path
            assert result == "/dataset/dir/images/test.jpg"

    def test_resolve_absolute_path(self):
        """Test resolving absolute path."""
        result = resolve_image_path("/absolute/path/test.jpg")
        # Now returns string, not Path
        assert result == "/absolute/path/test.jpg"

    def test_resolve_home_path(self):
        """Test resolving home directory path."""
        import os

        result = resolve_image_path("~/test.jpg")
        expected = os.path.expanduser("~/test.jpg")
        # Now returns string, not Path
        assert result == expected
