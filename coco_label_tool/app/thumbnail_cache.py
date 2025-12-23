"""Lazy thumbnail generation with disk caching.

This module provides a caching layer for image thumbnails used in the
gallery view. Thumbnails are generated on-demand and cached to disk
for fast subsequent access.

Cache location: ~/.cache/coco-label-tool/thumbnails/
Cache key: SHA256 hash of (image_path + size)
Format: JPEG at quality 85
"""

import hashlib
import io
from pathlib import Path
from typing import Optional, Tuple, Union

from PIL import Image

DEFAULT_CACHE_DIR = Path.home() / ".cache" / "coco-label-tool" / "thumbnails"
DEFAULT_SIZE = 64
JPEG_QUALITY = 85


def get_cache_key(image_path: str, size: int) -> str:
    """Generate unique cache key from image path and size.

    Args:
        image_path: Path to the original image
        size: Thumbnail size

    Returns:
        SHA256 hex digest (64 characters)
    """
    key_string = f"{image_path}:{size}"
    return hashlib.sha256(key_string.encode()).hexdigest()


class ThumbnailCache:
    """Manages cached thumbnails on disk.

    Thumbnails are stored as JPEG files named by their cache key.
    The cache is append-only - thumbnails are never automatically deleted.
    """

    def __init__(self, cache_dir: Path = DEFAULT_CACHE_DIR):
        """Initialize thumbnail cache.

        Args:
            cache_dir: Directory for cached thumbnails
        """
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_cached_thumbnail(self, image_path: str, size: int) -> Optional[bytes]:
        """Get cached thumbnail if it exists.

        Args:
            image_path: Path to the original image
            size: Thumbnail size

        Returns:
            Thumbnail bytes if cached, None otherwise
        """
        key = get_cache_key(image_path, size)
        cache_path = self.cache_dir / f"{key}.jpg"

        if cache_path.exists():
            return cache_path.read_bytes()

        return None

    def save_thumbnail(self, image_path: str, size: int, data: bytes) -> Path:
        """Save thumbnail to cache.

        Args:
            image_path: Path to the original image
            size: Thumbnail size
            data: Thumbnail image bytes

        Returns:
            Path to the cached file
        """
        key = get_cache_key(image_path, size)
        cache_path = self.cache_dir / f"{key}.jpg"
        cache_path.write_bytes(data)
        return cache_path

    def generate_thumbnail(
        self, image_source: Union[Path, bytes], size: int
    ) -> Tuple[bytes, str]:
        """Generate thumbnail from image source.

        Args:
            image_source: Path to image file or image bytes
            size: Maximum dimension for thumbnail

        Returns:
            Tuple of (thumbnail_bytes, content_type)

        Raises:
            FileNotFoundError: If image_source is a Path that doesn't exist
            Exception: If image cannot be processed
        """
        # Load image
        if isinstance(image_source, Path):
            if not image_source.exists():
                raise FileNotFoundError(f"Image not found: {image_source}")
            img = Image.open(image_source)
        elif isinstance(image_source, bytes):
            try:
                img = Image.open(io.BytesIO(image_source))
            except Exception as e:
                raise Exception(f"Invalid image data: {e}")
        else:
            raise TypeError(f"Expected Path or bytes, got {type(image_source)}")

        # Get original dimensions
        width, height = img.size

        # Only resize if needed (don't upscale)
        if width > size or height > size:
            # Calculate new dimensions preserving aspect ratio
            if width > height:
                new_width = size
                new_height = int((size / width) * height)
            else:
                new_height = size
                new_width = int((size / height) * width)

            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Convert to RGB if needed (handles RGBA, grayscale, etc.)
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Encode as JPEG
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)

        return buffer.getvalue(), "image/jpeg"

    def get_or_generate(
        self, image_path: str, size: int = DEFAULT_SIZE
    ) -> Tuple[bytes, str]:
        """Get thumbnail from cache or generate and cache it.

        This is the main interface for getting thumbnails.

        Args:
            image_path: Path to the original image
            size: Maximum dimension for thumbnail (default 64)

        Returns:
            Tuple of (thumbnail_bytes, content_type)

        Raises:
            FileNotFoundError: If image file doesn't exist
            Exception: If image cannot be processed
        """
        # Try cache first
        cached = self.get_cached_thumbnail(image_path, size)
        if cached is not None:
            return cached, "image/jpeg"

        # Generate thumbnail
        thumb_bytes, content_type = self.generate_thumbnail(Path(image_path), size)

        # Cache it
        self.save_thumbnail(image_path, size, thumb_bytes)

        return thumb_bytes, content_type


# Singleton instance with default cache directory
thumbnail_cache = ThumbnailCache()
