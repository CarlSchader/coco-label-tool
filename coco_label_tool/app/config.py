"""Application configuration."""

import os
from pathlib import Path
from typing import Optional


# S3 endpoint URL (for S3-compatible services like MinIO, DigitalOcean Spaces, etc.)
# Set to None for standard AWS S3
AWS_ENDPOINT_URL_S3: Optional[str] = os.environ.get("AWS_ENDPOINT_URL_S3")


# Inlined URI detection to avoid circular imports with uri_utils.py
def _is_s3_uri(uri: Optional[str]) -> bool:
    """Check if URI is an S3 path. Inlined to avoid circular imports."""
    if uri is None:
        return False
    if not uri:
        return False
    uri_lower = uri.lower()
    return uri_lower.startswith("s3://") or uri_lower.startswith("s3a://")


# Dataset URI - can be S3 or local path
DATASET_URI = os.environ.get(
    "DATASET_PATH",
    "",
)

# Detect if remote
DATASET_IS_S3 = _is_s3_uri(DATASET_URI)

# For local paths, validate existence
# For S3 paths, defer validation until load time
if not DATASET_IS_S3:
    DATASET_JSON = Path(DATASET_URI)
    if not DATASET_JSON.exists():
        raise RuntimeError(f"Error: COCO JSON file does not exist: {DATASET_JSON}")
    if not DATASET_JSON.is_file():
        raise RuntimeError(f"Error: DATASET_PATH must point to a file: {DATASET_JSON}")
    DATASET_DIR = DATASET_JSON.parent
else:
    # S3 path - DATASET_DIR set to None, handled specially in __init__.py
    DATASET_JSON = None  # type: ignore
    DATASET_DIR = None  # type: ignore
    print(f"Using S3 dataset: {DATASET_URI}")

# Cache settings
CACHE_SIZE = 64
CACHE_HEAD = 32
CACHE_TAIL = 32

# Image serving settings
MAX_IMAGE_DIMENSION = int(
    os.environ.get("MAX_IMAGE_DIMENSION", "2048")
)  # Resize images larger than this

# SAM2 model settings
SAM2_MODEL_SIZES = {
    "tiny": "facebook/sam2-hiera-tiny",
    "small": "facebook/sam2-hiera-small",
    "base": "facebook/sam2-hiera-base-plus",
    "large": "facebook/sam2-hiera-large",
}
SAM2_DEFAULT_SIZE = os.environ.get("SAM2_MODEL_SIZE", "tiny")
SAM2_MODEL_ID = SAM2_MODEL_SIZES.get(SAM2_DEFAULT_SIZE, SAM2_MODEL_SIZES["tiny"])

# SAM3 Tracker (PVS) model settings
SAM3_MODEL_SIZES = {
    "base": "facebook/sam3",
}
SAM3_DEFAULT_SIZE = os.environ.get("SAM3_MODEL_SIZE", "base")
SAM3_MODEL_ID = SAM3_MODEL_SIZES.get(SAM3_DEFAULT_SIZE, SAM3_MODEL_SIZES["base"])

# SAM3 PCS (Promptable Concept Segmentation) model settings
SAM3_PCS_MODEL_SIZES = {
    "base": "facebook/sam3",
}
SAM3_PCS_DEFAULT_SIZE = os.environ.get("SAM3_PCS_MODEL_SIZE", "base")
SAM3_PCS_MODEL_ID = SAM3_PCS_MODEL_SIZES.get(
    SAM3_PCS_DEFAULT_SIZE, SAM3_PCS_MODEL_SIZES["base"]
)

import torch  # noqa: E402

if os.environ.get("USE_GPU", "").lower() == "false":
    SAM2_DEVICE = "cpu"
    SAM3_DEVICE = "cpu"
    SAM3_PCS_DEVICE = "cpu"
elif torch.cuda.is_available():
    SAM2_DEVICE = "cuda"
    SAM3_DEVICE = "cuda"
    SAM3_PCS_DEVICE = "cuda"
elif torch.backends.mps.is_available():
    SAM2_DEVICE = "mps"
    SAM3_DEVICE = "mps"
    SAM3_PCS_DEVICE = "mps"
else:
    SAM2_DEVICE = "cpu"
    SAM3_DEVICE = "cpu"
    SAM3_PCS_DEVICE = "cpu"
