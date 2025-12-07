"""Unit tests for ImageCache class."""

from unittest.mock import patch

with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from app.cache import ImageCache


class TestImageCacheUpdate:
    def test_update_all_fields(self):
        """Test updating all cache fields."""
        cache = ImageCache()

        images = [{"id": 1, "file_name": "img1.jpg"}]
        image_map = {0: {"id": 1}}
        annotations = {1: [{"id": 1}]}
        indices = {0, 1, 2}

        cache.update(images, image_map, annotations, indices)

        assert cache.images == images
        assert cache.image_map == image_map
        assert cache.annotations_by_image == annotations
        assert cache.cached_indices == indices

    def test_update_overwrites_existing(self):
        """Test updating overwrites existing data."""
        cache = ImageCache()
        cache.images = [{"id": 999}]
        cache.cached_indices = {999}

        new_images = [{"id": 1}]
        cache.update(new_images, {}, {}, {1})

        assert cache.images == new_images
        assert cache.cached_indices == {1}


class TestImageCacheAddAnnotation:
    def test_add_to_existing_image(self):
        """Test adding annotation to existing image_id."""
        cache = ImageCache()
        cache.annotations_by_image = {1: [{"id": 1}]}

        new_annotation = {"id": 2}
        cache.add_annotation(1, new_annotation)

        assert len(cache.annotations_by_image[1]) == 2
        assert cache.annotations_by_image[1][1] == new_annotation

    def test_add_to_new_image(self):
        """Test adding annotation creates new list."""
        cache = ImageCache()

        annotation = {"id": 1}
        cache.add_annotation(1, annotation)

        assert 1 in cache.annotations_by_image
        assert len(cache.annotations_by_image[1]) == 1
        assert cache.annotations_by_image[1][0] == annotation


class TestImageCacheUpdateAnnotation:
    def test_update_existing_annotation(self):
        """Test updating existing annotation."""
        cache = ImageCache()
        cache.annotations_by_image = {
            1: [{"id": 1, "category_id": 1}],
            2: [{"id": 2, "category_id": 1}],
        }

        updated = {"id": 1, "category_id": 2}
        cache.update_annotation(1, updated)

        assert cache.annotations_by_image[1][0]["category_id"] == 2

    def test_update_annotation_not_found(self):
        """Test update returns early when annotation not found."""
        cache = ImageCache()
        cache.annotations_by_image = {1: [{"id": 1}]}

        cache.update_annotation(999, {"id": 999})

        assert cache.annotations_by_image[1][0]["id"] == 1


class TestImageCacheDeleteAnnotation:
    def test_delete_existing_annotation(self):
        """Test deleting existing annotation."""
        cache = ImageCache()
        cache.annotations_by_image = {1: [{"id": 1}, {"id": 2}]}

        cache.delete_annotation(1)

        assert len(cache.annotations_by_image[1]) == 1
        assert cache.annotations_by_image[1][0]["id"] == 2

    def test_delete_from_multiple_images(self):
        """Test deletion filters all images."""
        cache = ImageCache()
        cache.annotations_by_image = {
            1: [{"id": 1}, {"id": 2}],
            2: [{"id": 3}, {"id": 4}],
        }

        cache.delete_annotation(2)

        assert len(cache.annotations_by_image[1]) == 1
        assert cache.annotations_by_image[1][0]["id"] == 1


class TestImageCacheDeleteImage:
    def test_delete_image_from_list(self):
        """Test deleting image from list."""
        cache = ImageCache()
        cache.images = [{"id": 1}, {"id": 2}, {"id": 3}]
        cache.annotations_by_image = {1: [{"id": 1}], 2: [{"id": 2}]}

        cache.delete_image(2)

        assert len(cache.images) == 2
        assert not any(img["id"] == 2 for img in cache.images)

    def test_delete_annotations_for_image(self):
        """Test deleting annotations for image."""
        cache = ImageCache()
        cache.annotations_by_image = {1: [{"id": 1}], 2: [{"id": 2}]}

        cache.delete_image(1)

        assert 1 not in cache.annotations_by_image
        assert 2 in cache.annotations_by_image

    def test_delete_image_not_in_annotations(self):
        """Test deleting image not in annotations_by_image."""
        cache = ImageCache()
        cache.images = [{"id": 1}]
        cache.annotations_by_image = {}

        cache.delete_image(1)

        assert len(cache.images) == 0


class TestImageCacheGetImageById:
    def test_find_existing_image(self):
        """Test finding existing image."""
        cache = ImageCache()
        cache.images = [{"id": 1, "name": "img1"}, {"id": 2, "name": "img2"}]

        result = cache.get_image_by_id(1)

        assert result is not None
        assert result["name"] == "img1"

    def test_image_not_found(self):
        """Test returns None when image not found."""
        cache = ImageCache()
        cache.images = [{"id": 1}]

        result = cache.get_image_by_id(999)

        assert result is None


class TestImageCacheClear:
    def test_clear_all_fields(self):
        """Test all fields reset to defaults."""
        cache = ImageCache()
        cache.images = [{"id": 1}]
        cache.image_map = {0: {"id": 1}}
        cache.annotations_by_image = {1: [{"id": 1}]}
        cache.cached_indices = {0, 1}

        cache.clear()

        assert cache.images == []
        assert cache.image_map == {}
        assert cache.annotations_by_image == {}
        assert cache.cached_indices == set()
