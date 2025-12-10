"""Image resizing utilities for serving optimized images."""

import io
from pathlib import Path
from typing import Union

from PIL import Image


def resize_image_if_needed(
    image_source: Union[Path, bytes], max_dimension: int = 1024
) -> tuple[bytes, str]:
    """Resize image if any dimension exceeds max_dimension.

    Args:
        image_source: Either a Path to an image file or bytes of image data
        max_dimension: Maximum allowed dimension (default 1024)

    Returns:
        Tuple of (image_bytes, content_type)
        - image_bytes: JPEG-encoded image data (resized if needed)
        - content_type: MIME type (always "image/jpeg" for resized images)

    Note:
        - Preserves aspect ratio
        - Only resizes if needed (if both dimensions <= max_dimension, returns original)
        - Always returns JPEG for consistent output
        - Original file is NOT modified
    """
    # Load image
    if isinstance(image_source, Path):
        img = Image.open(image_source)
    else:
        img = Image.open(io.BytesIO(image_source))

    # Get original dimensions
    width, height = img.size

    # Check if resizing needed
    if width <= max_dimension and height <= max_dimension:
        # No resize needed - return original
        buffer = io.BytesIO()
        # Convert to RGB if needed (handles RGBA, grayscale, etc.)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(buffer, format="JPEG", quality=90, optimize=True)
        return buffer.getvalue(), "image/jpeg"

    # Calculate new dimensions preserving aspect ratio
    if width > height:
        # Width is larger
        new_width = max_dimension
        new_height = int((max_dimension / width) * height)
    else:
        # Height is larger (or equal)
        new_height = max_dimension
        new_width = int((max_dimension / height) * width)

    # Resize image
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Convert to RGB if needed (handles RGBA, grayscale, etc.)
    if img_resized.mode != "RGB":
        img_resized = img_resized.convert("RGB")

    # Encode as JPEG
    buffer = io.BytesIO()
    img_resized.save(buffer, format="JPEG", quality=90, optimize=True)

    return buffer.getvalue(), "image/jpeg"


def get_resized_dimensions(
    width: int, height: int, max_dimension: int = 1024
) -> tuple[int, int]:
    """Calculate resized dimensions preserving aspect ratio.

    Args:
        width: Original width
        height: Original height
        max_dimension: Maximum allowed dimension

    Returns:
        Tuple of (new_width, new_height)
    """
    if width <= max_dimension and height <= max_dimension:
        return width, height

    if width > height:
        new_width = max_dimension
        new_height = int((max_dimension / width) * height)
    else:
        new_height = max_dimension
        new_width = int((max_dimension / height) * width)

    return new_width, new_height
