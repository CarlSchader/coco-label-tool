"""Unit tests for dataset operations."""

import pytest
import json
from pathlib import Path
from unittest.mock import patch, mock_open

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
            )
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
def mock_dataset_file():
    """Mock the dataset JSON file."""
    with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
        yield


@pytest.fixture
def mock_dataset_path():
    """Mock the DATASET_JSON path."""
    with patch("coco_label_tool.app.dataset.DATASET_JSON", Path("/tmp/test.json")):
        yield


class TestLoadFullMetadata:
    def test_load_full_metadata(self, mock_dataset_file):
        """Test loading dataset metadata."""
        metadata = load_full_metadata()

        assert metadata["total_images"] == 3
        assert "info" in metadata
        assert "categories" in metadata
        assert len(metadata["categories"]) == 3


class TestLoadImagesRange:
    def test_load_range_valid(self, mock_dataset_file):
        """Test loading valid range."""
        images, image_map, annot_by_image, indices = load_images_range(0, 2)

        assert len(images) == 2
        assert len(image_map) == 2
        assert 0 in image_map
        assert 1 in image_map
        assert images[0]["index"] == 0
        assert images[1]["index"] == 1
        assert indices == {0, 1}

    def test_load_range_with_annotations(self, mock_dataset_file):
        """Test annotations are grouped correctly."""
        images, image_map, annot_by_image, indices = load_images_range(0, 2)

        assert 1 in annot_by_image
        assert len(annot_by_image[1]) == 2
        assert 2 not in annot_by_image

    def test_load_range_exceeds_dataset(self, mock_dataset_file):
        """Test loading range that exceeds dataset size."""
        images, image_map, annot_by_image, indices = load_images_range(0, 100)

        assert len(images) == 3
        assert len(image_map) == 3

    def test_load_range_empty(self, mock_dataset_file):
        """Test empty range."""
        images, image_map, annot_by_image, indices = load_images_range(5, 5)

        assert len(images) == 0
        assert len(image_map) == 0
        assert len(annot_by_image) == 0

    def test_load_range_no_annotations(self, mock_dataset_file):
        """Test range with image that has no annotations."""
        images, image_map, annot_by_image, indices = load_images_range(1, 2)

        assert len(images) == 1
        assert 2 not in annot_by_image


class TestGetCategories:
    def test_get_categories(self, mock_dataset_file):
        """Test retrieving categories."""
        categories = get_categories()

        assert len(categories) == 3
        assert categories[0]["name"] == "dog"
        assert categories[1]["supercategory"] == "animal"


class TestSaveDataset:
    def test_save_dataset(self, mock_dataset_path):
        """Test saving dataset preserves structure."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            new_images = [{"id": 1, "file_name": "new.jpg"}]
            new_annotations = [{"id": 1, "image_id": 1, "category_id": 1}]

            save_dataset(new_images, new_annotations)

            handle = m()
            written_data = "".join(call.args[0] for call in handle.write.call_args_list)
            saved = json.loads(written_data)

            assert saved["images"] == new_images
            assert saved["annotations"] == new_annotations
            assert "categories" in saved
            assert "info" in saved


class TestAddCategory:
    def test_add_category(self, mock_dataset_path, mock_dataset_file):
        """Test adding a new category."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            new_cat = add_category("bird", "animal")

            assert new_cat["name"] == "bird"
            assert new_cat["supercategory"] == "animal"
            assert new_cat["id"] == 4

    def test_add_category_empty_list(self, mock_dataset_path):
        """Test adding category when no categories exist."""
        empty_dataset = {**MOCK_DATASET, "categories": []}
        with patch("builtins.open", mock_open(read_data=json.dumps(empty_dataset))):
            new_cat = add_category("first", "none")
            assert new_cat["id"] == 1


class TestUpdateCategory:
    def test_update_category_name(self, mock_dataset_path, mock_dataset_file):
        """Test updating category name."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            update_category(1, "puppy", "animal")

            handle = m()
            written_data = "".join(call.args[0] for call in handle.write.call_args_list)
            saved = json.loads(written_data)

            updated_cat = next(c for c in saved["categories"] if c["id"] == 1)
            assert updated_cat["name"] == "puppy"

    def test_update_category_supercategory(self, mock_dataset_path, mock_dataset_file):
        """Test updating supercategory."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            update_category(1, "dog", "pet")

            handle = m()
            written_data = "".join(call.args[0] for call in handle.write.call_args_list)
            saved = json.loads(written_data)

            updated_cat = next(c for c in saved["categories"] if c["id"] == 1)
            assert updated_cat["supercategory"] == "pet"

    def test_update_nonexistent_category(self, mock_dataset_path, mock_dataset_file):
        """Test updating non-existent category silently succeeds."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            update_category(999, "ghost", "none")


class TestDeleteCategory:
    def test_delete_category_in_use(self, mock_dataset_path, mock_dataset_file):
        """Test deleting a category that is in use."""
        with pytest.raises(CategoryInUseError):
            delete_category(1)

    def test_delete_category_success(self, mock_dataset_path, mock_dataset_file):
        """Test successfully deleting an unused category."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            delete_category(3)
            assert m.call_count >= 2


class TestGetAnnotationsByImage:
    def test_get_annotations_for_image_with_annotations(self):
        """Test getting annotations for an image that has annotations."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            annotations = get_annotations_by_image(1)
            assert len(annotations) == 2
            assert all(ann["image_id"] == 1 for ann in annotations)
            assert annotations[0]["id"] == 1
            assert annotations[1]["id"] == 2

    def test_get_annotations_for_image_without_annotations(self):
        """Test getting annotations for an image that has no annotations."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            # Image 2 exists but has no annotations in MOCK_DATASET
            annotations = get_annotations_by_image(2)
            assert len(annotations) == 0
            assert annotations == []

    def test_get_annotations_for_nonexistent_image(self):
        """Test getting annotations for an image that doesn't exist."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            annotations = get_annotations_by_image(999)
            assert len(annotations) == 0
            assert annotations == []


class TestAddAnnotation:
    def test_add_annotation_single_polygon(self, mock_dataset_path, mock_dataset_file):
        """Test adding annotation with single polygon."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            with patch("cv2.contourArea", return_value=150.0):
                segmentation = [[10, 10, 20, 10, 20, 20, 10, 20]]
                annotation = add_annotation(1, 1, segmentation)

                assert annotation["id"] == 4
                assert annotation["image_id"] == 1
                assert annotation["category_id"] == 1
                assert annotation["segmentation"] == segmentation
                assert annotation["iscrowd"] == 0
                assert annotation["bbox"] == [10, 10, 10, 10]
                assert annotation["area"] == 150.0

    def test_add_annotation_multiple_polygons(
        self, mock_dataset_path, mock_dataset_file
    ):
        """Test adding annotation with multiple polygons."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            with patch("cv2.contourArea", return_value=100.0):
                segmentation = [
                    [10, 10, 20, 10, 20, 20, 10, 20],
                    [30, 30, 40, 30, 40, 40, 30, 40],
                ]
                annotation = add_annotation(1, 1, segmentation)

                assert len(annotation["segmentation"]) == 2
                assert annotation["bbox"] == [10, 10, 30, 30]

    def test_add_annotation_empty_list(self, mock_dataset_path):
        """Test adding first annotation."""
        dataset_no_annot = {**MOCK_DATASET, "annotations": []}
        with patch("builtins.open", mock_open(read_data=json.dumps(dataset_no_annot))):
            with patch("cv2.contourArea", return_value=100.0):
                annotation = add_annotation(1, 1, [[10, 10, 20, 20]])
                assert annotation["id"] == 1


class TestUpdateAnnotation:
    def test_update_annotation_category(self, mock_dataset_path, mock_dataset_file):
        """Test updating annotation category."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            annotation = update_annotation(1, 2)

            assert annotation["category_id"] == 2
            assert annotation["id"] == 1

    def test_update_annotation_not_found(self, mock_dataset_path, mock_dataset_file):
        """Test AnnotationNotFoundError when annotation doesn't exist."""
        with pytest.raises(AnnotationNotFoundError):
            update_annotation(999, 1)

    def test_update_annotation_preserves_fields(
        self, mock_dataset_path, mock_dataset_file
    ):
        """Test other fields are preserved."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            annotation = update_annotation(1, 2)

            assert annotation["segmentation"] == [[10, 10, 20, 20, 30, 10]]
            assert annotation["bbox"] == [10, 10, 20, 10]


class TestDeleteAnnotation:
    def test_delete_annotation_exists(self, mock_dataset_path, mock_dataset_file):
        """Test deleting existing annotation."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            delete_annotation(1)

            handle = m()
            written_data = "".join(call.args[0] for call in handle.write.call_args_list)
            saved = json.loads(written_data)

            assert len(saved["annotations"]) == 2
            assert not any(a["id"] == 1 for a in saved["annotations"])

    def test_delete_annotation_nonexistent(self, mock_dataset_path, mock_dataset_file):
        """Test deleting non-existent annotation succeeds silently."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            delete_annotation(999)


class TestDeleteImage:
    def test_delete_image_with_annotations(self, mock_dataset_path, mock_dataset_file):
        """Test deleting image cascades to annotations."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))) as m:
            with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
                with patch("pathlib.Path.exists", return_value=True):
                    with patch("pathlib.Path.unlink") as mock_unlink:
                        delete_image(1)

                        mock_unlink.assert_called_once()

                        handle = m()
                        written_data = "".join(
                            call.args[0] for call in handle.write.call_args_list
                        )
                        saved = json.loads(written_data)

                        assert len(saved["images"]) == 2
                        assert not any(img["id"] == 1 for img in saved["images"])
                        assert not any(
                            ann["image_id"] == 1 for ann in saved["annotations"]
                        )

    def test_delete_image_not_found(self, mock_dataset_path, mock_dataset_file):
        """Test ImageNotFoundError when image doesn't exist."""
        with pytest.raises(ImageNotFoundError):
            delete_image(999)

    def test_delete_image_file_not_exists(self, mock_dataset_path, mock_dataset_file):
        """Test file deletion when file doesn't exist."""
        with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))):
            with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
                with patch("pathlib.Path.exists", return_value=False):
                    with patch("pathlib.Path.unlink") as mock_unlink:
                        delete_image(1)

                        mock_unlink.assert_not_called()

    def test_delete_image_no_annotations(self, mock_dataset_path):
        """Test deleting image without annotations."""
        dataset_no_annot = {
            **MOCK_DATASET,
            "annotations": [
                a for a in MOCK_DATASET["annotations"] if a["image_id"] != 2
            ],
        }
        with patch("builtins.open", mock_open(read_data=json.dumps(dataset_no_annot))):
            with patch("coco_label_tool.app.dataset.DATASET_URI", "/tmp/dataset.json"):
                with patch("pathlib.Path.exists", return_value=False):
                    delete_image(2)


class TestResolveImagePath:
    def test_resolve_relative_path(self):
        """Test resolving relative path."""
        from coco_label_tool.app.dataset import resolve_image_path

        # resolve_image_path now uses DATASET_URI, not DATASET_DIR
        with patch(
            "coco_label_tool.app.dataset.DATASET_URI", "/dataset/dir/dataset.json"
        ):
            result = resolve_image_path("images/test.jpg")
            # Now returns string, not Path
            assert result == "/dataset/dir/images/test.jpg"

    def test_resolve_absolute_path(self):
        """Test resolving absolute path."""
        from coco_label_tool.app.dataset import resolve_image_path

        result = resolve_image_path("/absolute/path/test.jpg")
        # Now returns string, not Path
        assert result == "/absolute/path/test.jpg"

    def test_resolve_home_path(self):
        """Test resolving home directory path."""
        from coco_label_tool.app.dataset import resolve_image_path
        import os

        result = resolve_image_path("~/test.jpg")
        expected = os.path.expanduser("~/test.jpg")
        # Now returns string, not Path
        assert result == expected
