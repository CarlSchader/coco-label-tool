"""Tests for thumbnail caching system."""

import sys
import tempfile
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

# Add the app directory to path to import directly
sys.path.insert(0, str(Path(__file__).parent.parent / "coco_label_tool" / "app"))

from thumbnail_cache import ThumbnailCache, get_cache_key


def create_test_image(width: int = 200, height: int = 150, color: str = "red") -> bytes:
    """Create a test image in memory."""
    img = Image.new("RGB", (width, height), color=color)
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def create_test_image_file(
    path: Path, width: int = 200, height: int = 150, color: str = "red"
) -> None:
    """Create a test image file on disk."""
    img = Image.new("RGB", (width, height), color=color)
    img.save(path, format="JPEG", quality=85)


class TestGetCacheKey:
    """Tests for cache key generation."""

    def test_deterministic(self):
        """Same inputs should produce same key."""
        key1 = get_cache_key("/path/to/image.jpg", 64)
        key2 = get_cache_key("/path/to/image.jpg", 64)
        assert key1 == key2

    def test_different_paths_different_keys(self):
        """Different paths should produce different keys."""
        key1 = get_cache_key("/path/to/image1.jpg", 64)
        key2 = get_cache_key("/path/to/image2.jpg", 64)
        assert key1 != key2

    def test_different_sizes_different_keys(self):
        """Different sizes should produce different keys."""
        key1 = get_cache_key("/path/to/image.jpg", 64)
        key2 = get_cache_key("/path/to/image.jpg", 128)
        assert key1 != key2

    def test_key_format(self):
        """Key should be a valid filename (hex hash)."""
        key = get_cache_key("/path/to/image.jpg", 64)
        # Should be hex characters only
        assert all(c in "0123456789abcdef" for c in key)
        # Should have reasonable length (SHA256 = 64 chars)
        assert len(key) == 64

    def test_handles_special_characters(self):
        """Should handle paths with special characters."""
        key = get_cache_key("/path/with spaces/image (1).jpg", 64)
        assert all(c in "0123456789abcdef" for c in key)


class TestThumbnailCache:
    """Tests for ThumbnailCache class."""

    def test_init_creates_cache_dir(self):
        """Cache directory should be created on init."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_dir = Path(tmpdir) / "thumbnails"
            assert not cache_dir.exists()
            ThumbnailCache(cache_dir)  # Instantiation creates the directory
            assert cache_dir.exists()

    def test_init_with_existing_dir(self):
        """Should work with existing directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_dir = Path(tmpdir) / "thumbnails"
            cache_dir.mkdir(parents=True)
            ThumbnailCache(cache_dir)  # Should not raise
            assert cache_dir.exists()


class TestThumbnailCacheGetCached:
    """Tests for getting cached thumbnails."""

    def test_cache_miss(self):
        """Should return None for uncached thumbnail."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))
            result = cache.get_cached_thumbnail("/path/to/image.jpg", 64)
            assert result is None

    def test_cache_hit(self):
        """Should return cached thumbnail data."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Manually create a cached file
            key = get_cache_key("/path/to/image.jpg", 64)
            cache_path = Path(tmpdir) / f"{key}.jpg"
            test_data = create_test_image(64, 64)
            cache_path.write_bytes(test_data)

            result = cache.get_cached_thumbnail("/path/to/image.jpg", 64)
            assert result == test_data


class TestThumbnailCacheSave:
    """Tests for saving thumbnails to cache."""

    def test_save_creates_file(self):
        """Saving should create cache file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))
            test_data = create_test_image(64, 64)

            cache_path = cache.save_thumbnail("/path/to/image.jpg", 64, test_data)

            assert cache_path.exists()
            assert cache_path.read_bytes() == test_data

    def test_save_returns_correct_path(self):
        """Saved path should match cache key."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))
            test_data = create_test_image(64, 64)

            cache_path = cache.save_thumbnail("/path/to/image.jpg", 64, test_data)

            expected_key = get_cache_key("/path/to/image.jpg", 64)
            assert cache_path.name == f"{expected_key}.jpg"


class TestThumbnailCacheGenerate:
    """Tests for thumbnail generation."""

    def test_generate_from_file(self):
        """Should generate thumbnail from file path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create a test image file
            img_path = Path(tmpdir) / "test.jpg"
            create_test_image_file(img_path, 400, 300)

            thumb_bytes, content_type = cache.generate_thumbnail(img_path, 64)

            assert isinstance(thumb_bytes, bytes)
            assert content_type == "image/jpeg"

            # Verify dimensions
            img = Image.open(BytesIO(thumb_bytes))
            assert max(img.size) <= 64

    def test_generate_from_bytes(self):
        """Should generate thumbnail from image bytes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            test_image = create_test_image(400, 300)
            thumb_bytes, content_type = cache.generate_thumbnail(test_image, 64)

            assert isinstance(thumb_bytes, bytes)
            assert content_type == "image/jpeg"

            # Verify dimensions
            img = Image.open(BytesIO(thumb_bytes))
            assert max(img.size) <= 64

    def test_generate_preserves_aspect_ratio(self):
        """Thumbnail should preserve aspect ratio."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create wide image (400x200 = 2:1 ratio)
            test_image = create_test_image(400, 200)
            thumb_bytes, _ = cache.generate_thumbnail(test_image, 64)

            img = Image.open(BytesIO(thumb_bytes))
            width, height = img.size

            # Should be 64x32 (2:1 ratio preserved)
            assert width == 64
            assert height == 32

    def test_generate_tall_image(self):
        """Should handle tall images correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create tall image (200x400 = 1:2 ratio)
            test_image = create_test_image(200, 400)
            thumb_bytes, _ = cache.generate_thumbnail(test_image, 64)

            img = Image.open(BytesIO(thumb_bytes))
            width, height = img.size

            # Should be 32x64 (1:2 ratio preserved)
            assert width == 32
            assert height == 64

    def test_generate_small_image_not_upscaled(self):
        """Images smaller than size should not be upscaled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create small image (32x32)
            test_image = create_test_image(32, 32)
            thumb_bytes, _ = cache.generate_thumbnail(test_image, 64)

            img = Image.open(BytesIO(thumb_bytes))
            width, height = img.size

            # Should stay at 32x32
            assert width == 32
            assert height == 32


class TestThumbnailCacheGetOrGenerate:
    """Tests for get_or_generate (main interface)."""

    def test_generates_on_cache_miss(self):
        """Should generate and cache thumbnail on miss."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create a test image file
            img_path = Path(tmpdir) / "test.jpg"
            create_test_image_file(img_path, 400, 300)

            thumb_bytes, content_type = cache.get_or_generate(str(img_path), 64)

            assert isinstance(thumb_bytes, bytes)
            assert content_type == "image/jpeg"

            # Verify it was cached
            cached = cache.get_cached_thumbnail(str(img_path), 64)
            assert cached == thumb_bytes

    def test_returns_cached_on_hit(self):
        """Should return cached thumbnail without regenerating."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create a test image file
            img_path = Path(tmpdir) / "test.jpg"
            create_test_image_file(img_path, 400, 300)

            # First call - generates
            thumb1, _ = cache.get_or_generate(str(img_path), 64)

            # Second call - should use cache
            thumb2, _ = cache.get_or_generate(str(img_path), 64)

            assert thumb1 == thumb2

    def test_different_sizes_cached_separately(self):
        """Different sizes should be cached as separate files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create a test image file
            img_path = Path(tmpdir) / "test.jpg"
            create_test_image_file(img_path, 400, 300)

            # Generate different sizes
            thumb64, _ = cache.get_or_generate(str(img_path), 64)
            thumb128, _ = cache.get_or_generate(str(img_path), 128)

            # Should be different
            assert thumb64 != thumb128

            # Both should be cached
            assert cache.get_cached_thumbnail(str(img_path), 64) == thumb64
            assert cache.get_cached_thumbnail(str(img_path), 128) == thumb128

    def test_handles_rgba_images(self):
        """Should handle RGBA images (convert to RGB)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            # Create RGBA image
            img = Image.new("RGBA", (200, 200), color=(255, 0, 0, 128))
            img_path = Path(tmpdir) / "test.png"
            img.save(img_path, format="PNG")

            thumb_bytes, content_type = cache.get_or_generate(str(img_path), 64)

            assert content_type == "image/jpeg"
            # Should be valid JPEG
            result_img = Image.open(BytesIO(thumb_bytes))
            assert result_img.mode == "RGB"


class TestThumbnailCacheErrors:
    """Tests for error handling."""

    def test_generate_nonexistent_file(self):
        """Should raise error for nonexistent file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            with pytest.raises(FileNotFoundError):
                cache.generate_thumbnail(Path(tmpdir) / "nonexistent.jpg", 64)

    def test_generate_invalid_image(self):
        """Should raise error for invalid image data."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            with pytest.raises(Exception):
                cache.generate_thumbnail(b"not an image", 64)

    def test_get_or_generate_nonexistent_file(self):
        """Should raise error for nonexistent file in get_or_generate."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = ThumbnailCache(Path(tmpdir))

            with pytest.raises(FileNotFoundError):
                cache.get_or_generate(str(Path(tmpdir) / "nonexistent.jpg"), 64)
