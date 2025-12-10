"""Tests for image resizing utilities."""

import importlib.util
import io
from pathlib import Path

from PIL import Image

# Import module directly to avoid app package initialization issues
spec = importlib.util.spec_from_file_location(
    "image_resize", Path(__file__).parent.parent / "app" / "image_resize.py"
)
if spec and spec.loader:
    image_resize_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(image_resize_module)

    get_resized_dimensions = image_resize_module.get_resized_dimensions
    resize_image_if_needed = image_resize_module.resize_image_if_needed
else:
    raise ImportError("Could not load image_resize module")


def create_test_image(width: int, height: int, format: str = "JPEG") -> bytes:
    """Create a test image in memory."""
    img = Image.new("RGB", (width, height), color="red")
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


class TestGetResizedDimensions:
    def test_no_resize_small_image(self):
        """Test that small images dimensions are unchanged."""
        width, height = get_resized_dimensions(800, 600, max_dimension=1024)
        assert width == 800
        assert height == 600

    def test_no_resize_exact_dimension(self):
        """Test image exactly at max dimension."""
        width, height = get_resized_dimensions(1024, 768, max_dimension=1024)
        assert width == 1024
        assert height == 768

    def test_resize_wide_image(self):
        """Test resizing wide image (width > height)."""
        width, height = get_resized_dimensions(2048, 1536, max_dimension=1024)
        assert width == 1024
        assert height == 768  # 1536 * (1024/2048) = 768

    def test_resize_tall_image(self):
        """Test resizing tall image (height > width)."""
        width, height = get_resized_dimensions(1536, 2048, max_dimension=1024)
        assert width == 768  # 1536 * (1024/2048) = 768
        assert height == 1024

    def test_resize_square_image(self):
        """Test resizing square image."""
        width, height = get_resized_dimensions(2048, 2048, max_dimension=1024)
        assert width == 1024
        assert height == 1024

    def test_resize_very_wide_image(self):
        """Test resizing very wide panorama."""
        width, height = get_resized_dimensions(4096, 1024, max_dimension=1024)
        assert width == 1024
        assert height == 256  # 1024 * (1024/4096) = 256

    def test_custom_max_dimension(self):
        """Test with custom max dimension."""
        width, height = get_resized_dimensions(2048, 1536, max_dimension=512)
        assert width == 512
        assert height == 384  # 1536 * (512/2048) = 384


class TestResizeImageIfNeeded:
    def test_small_image_unchanged(self):
        """Test that small images pass through unchanged (except format)."""
        # Create 800x600 test image
        test_image = create_test_image(800, 600)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        assert content_type == "image/jpeg"
        assert isinstance(image_bytes, bytes)

        # Verify dimensions unchanged
        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (800, 600)

    def test_large_image_resized(self):
        """Test that large images are resized."""
        # Create 2048x1536 test image
        test_image = create_test_image(2048, 1536)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        assert content_type == "image/jpeg"
        assert isinstance(image_bytes, bytes)

        # Verify dimensions resized
        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (1024, 768)

    def test_square_image_resized(self):
        """Test square image resizing."""
        test_image = create_test_image(2048, 2048)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (1024, 1024)

    def test_tall_image_resized(self):
        """Test tall image resizing."""
        test_image = create_test_image(1536, 2048)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (768, 1024)

    def test_custom_max_dimension(self):
        """Test with custom max dimension."""
        test_image = create_test_image(2048, 1536)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=512
        )

        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (512, 384)

    def test_path_input(self, tmp_path):
        """Test with Path input instead of bytes."""
        # Create temp image file
        img_path = tmp_path / "test.jpg"
        img = Image.new("RGB", (2048, 1536), color="blue")
        img.save(img_path, "JPEG")

        image_bytes, content_type = resize_image_if_needed(img_path, max_dimension=1024)

        assert content_type == "image/jpeg"
        img_result = Image.open(io.BytesIO(image_bytes))
        assert img_result.size == (1024, 768)

    def test_png_converted_to_jpeg(self):
        """Test that PNG images are converted to JPEG."""
        # Create PNG image
        img = Image.new("RGB", (2048, 1536), color="green")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        test_image = buffer.getvalue()

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        assert content_type == "image/jpeg"
        img_result = Image.open(io.BytesIO(image_bytes))
        assert img_result.format == "JPEG"
        assert img_result.size == (1024, 768)

    def test_rgba_converted_to_rgb(self):
        """Test that RGBA images are converted to RGB."""
        # Create RGBA image
        img = Image.new("RGBA", (2048, 1536), color=(255, 0, 0, 128))
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        test_image = buffer.getvalue()

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img_result = Image.open(io.BytesIO(image_bytes))
        assert img_result.mode == "RGB"  # Converted from RGBA
        assert img_result.size == (1024, 768)

    def test_very_small_image(self):
        """Test with very small image."""
        test_image = create_test_image(100, 100)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (100, 100)  # Unchanged

    def test_exactly_max_dimension(self):
        """Test image exactly at max dimension."""
        test_image = create_test_image(1024, 768)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        assert img.size == (1024, 768)  # Unchanged

    def test_one_pixel_over(self):
        """Test image just one pixel over max dimension."""
        test_image = create_test_image(1025, 768)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        # Should be resized (768 * 1024/1025 = 767.x, rounds to 767)
        assert img.size[0] == 1024
        assert img.size[1] in (766, 767)  # Allow small rounding difference

    def test_aspect_ratio_preserved(self):
        """Test that aspect ratio is preserved after resize."""
        test_image = create_test_image(3000, 2000)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        # Original aspect ratio: 3000/2000 = 1.5
        # New aspect ratio should be close to 1.5
        aspect_ratio = width / height
        assert abs(aspect_ratio - 1.5) < 0.01

    def test_output_is_valid_jpeg(self):
        """Test that output is valid JPEG."""
        test_image = create_test_image(2048, 1536)

        image_bytes, content_type = resize_image_if_needed(
            test_image, max_dimension=1024
        )

        # Should be able to open as JPEG
        img = Image.open(io.BytesIO(image_bytes))
        assert img.format == "JPEG"
