"""Unit tests for helper functions."""

import pytest
from unittest.mock import patch

with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.helpers import (
                reload_dataset_cache,
                get_dataset_response,
                refresh_cache_after_operation,
            )
            from coco_label_tool.app.cache import ImageCache


class TestGetDatasetResponse:
    @pytest.mark.asyncio
    async def test_response_structure(self):
        """Test response dict structure."""
        cache = ImageCache()
        cache.images = [{"id": 1}]
        cache.image_map = {0: {"id": 1}}
        cache.annotations_by_image = {1: [{"id": 1}]}
        cache.cached_indices = {0, 1}

        response = await get_dataset_response(cache)

        assert "images" in response
        assert "image_map" in response
        assert "annotations_by_image" in response
        assert "cached_indices" in response
        assert response["images"] == [{"id": 1}]

    @pytest.mark.asyncio
    async def test_cached_indices_conversion(self):
        """Test cached_indices converted to list."""
        cache = ImageCache()
        cache.cached_indices = {0, 1, 2}

        response = await get_dataset_response(cache)

        assert isinstance(response["cached_indices"], list)
        assert set(response["cached_indices"]) == {0, 1, 2}


class TestReloadDatasetCache:
    @pytest.mark.asyncio
    async def test_cache_reload(self):
        """Test cache reload returns data."""
        cache = ImageCache()
        cache.images = [{"id": 1}]

        result = await reload_dataset_cache(cache)

        assert "images" in result
        assert result["images"] == [{"id": 1}]


class TestRefreshCacheAfterOperation:
    def test_operation_execution(self):
        """Test operation is executed."""
        cache = ImageCache()

        def test_operation(x, y):
            return x + y

        result = refresh_cache_after_operation(cache, test_operation, 2, 3)

        assert result == 5

    def test_result_passing(self):
        """Test result is passed through."""
        cache = ImageCache()

        def test_operation():
            return {"success": True}

        result = refresh_cache_after_operation(cache, test_operation)

        assert result == {"success": True}
