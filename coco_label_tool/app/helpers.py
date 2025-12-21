"""Helper functions for route handlers."""

from typing import Dict
from .cache import ImageCache


async def reload_dataset_cache(cache: ImageCache) -> Dict:
    """Reload dataset from JSON and update cache."""
    data = await get_dataset_response(cache)
    return data


async def get_dataset_response(cache: ImageCache) -> Dict:
    """Get current cached dataset as response dict."""
    return {
        "images": cache.images,
        "image_map": cache.image_map,
        "annotations_by_image": cache.annotations_by_image,
        "cached_indices": list(cache.cached_indices),
    }


def refresh_cache_after_operation(cache: ImageCache, operation_func, *args, **kwargs):
    """Execute an operation and refresh the cache afterwards."""
    result = operation_func(*args, **kwargs)
    return result
