"""S3 URI utilities and caching logic.

IMPORTANT: This module must have NO imports from other app modules to avoid circular imports.
The functions here are intentionally self-contained.
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar

# Cached S3 client (singleton for connection pooling)
_s3_client = None

# Cached cache directory
_cache_dir: Optional[Path] = None

T = TypeVar("T")


def detect_uri_type(uri: Optional[str]) -> str:
    """Detect URI type. NO EXTERNAL DEPENDENCIES - safe to import anywhere.

    Args:
        uri: The URI to check (can be None)

    Returns:
        "s3" for S3 URIs, "local" for local paths
    """
    if uri is None:
        return "local"
    if not uri:
        return "local"
    uri_lower = uri.lower()
    if uri_lower.startswith("s3://") or uri_lower.startswith("s3a://"):
        return "s3"
    return "local"


def parse_s3_uri(uri: Optional[str]) -> Tuple[str, str]:
    """Parse S3 URI into (bucket, key).

    Args:
        uri: S3 URI in format s3://bucket/key or s3a://bucket/key

    Returns:
        Tuple of (bucket, key)

    Raises:
        ValueError: If URI is invalid
    """
    if not uri:
        raise ValueError("Empty URI")

    s3_path = uri.replace("s3://", "").replace("s3a://", "")
    s3_path = s3_path.replace("S3://", "").replace("S3A://", "")

    if "/" not in s3_path:
        raise ValueError(f"Invalid S3 URI (no key): {uri}")

    bucket, key = s3_path.split("/", 1)

    if not bucket:
        raise ValueError(f"Invalid S3 URI (empty bucket): {uri}")
    if not key:
        raise ValueError(f"Invalid S3 URI (empty key): {uri}")

    return bucket, key


def get_cache_dir() -> Path:
    """Get platform-appropriate cache directory.

    Uses XDG_CACHE_HOME on Linux, LOCALAPPDATA on Windows,
    falls back to ~/.cache/coco-label-tool/datasets.

    Returns:
        Path to cache directory (created if needed)
    """
    global _cache_dir

    if _cache_dir is not None:
        return _cache_dir

    # Use XDG_CACHE_HOME on Linux, fallback to ~/.cache
    if os.name == "posix":
        cache_base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    else:
        # Windows: use LOCALAPPDATA or fallback
        cache_base = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache"))

    cache_dir = cache_base / "coco-label-tool" / "datasets"
    cache_dir.mkdir(parents=True, exist_ok=True)

    _cache_dir = cache_dir
    return cache_dir


def get_cache_key(uri: str) -> str:
    """Generate cache key from URI using MD5 hash.

    Args:
        uri: The URI to generate key for

    Returns:
        32-character hex string (MD5 hash)
    """
    return hashlib.md5(uri.encode()).hexdigest()


def get_cached_json_path(uri: str) -> Path:
    """Get path to cached JSON file.

    Args:
        uri: S3 URI

    Returns:
        Path to cached JSON file
    """
    return get_cache_dir() / f"{get_cache_key(uri)}.json"


def get_cache_metadata_path(uri: str) -> Path:
    """Get path to cache metadata file.

    Args:
        uri: S3 URI

    Returns:
        Path to metadata file
    """
    return get_cache_dir() / f"{get_cache_key(uri)}.metadata"


def load_cache_metadata(uri: str) -> Optional[Dict[str, Any]]:
    """Load cache metadata from file.

    Args:
        uri: S3 URI

    Returns:
        Metadata dict or None if not found/corrupted
    """
    metadata_path = get_cache_metadata_path(uri)

    if not metadata_path.exists():
        return None

    try:
        with open(metadata_path) as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def save_cache_metadata(uri: str, s3_metadata: Dict[str, Any]) -> None:
    """Save cache metadata to file.

    Args:
        uri: S3 URI
        s3_metadata: S3 response metadata (ETag, ContentLength, etc.)
    """
    metadata_path = get_cache_metadata_path(uri)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    # Extract relevant fields
    metadata = {
        "etag": s3_metadata.get("ETag", "").strip('"'),
        "content_length": s3_metadata.get("ContentLength"),
        "cached_at": time.time(),
        "source_uri": uri,
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)


def get_s3_client():
    """Get or create cached S3 client (singleton for connection pooling).

    Supports custom S3-compatible endpoints via S3_ENDPOINT_URL env var
    (e.g., MinIO, DigitalOcean Spaces, Backblaze B2, Cloudflare R2).

    Returns:
        boto3 S3 client
    """
    global _s3_client

    if _s3_client is None:
        import boto3

        # Region priority: AWS_REGION > AWS_DEFAULT_REGION > us-east-1
        region = (
            os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
        )

        # Custom endpoint for S3-compatible services (MinIO, DigitalOcean, etc.)
        endpoint_url = os.getenv("AWS_ENDPOINT_URL_S3")

        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=region,
            endpoint_url=endpoint_url,  # None for standard AWS S3
        )

        if endpoint_url:
            print(f"Using custom S3 endpoint: {endpoint_url}")

    return _s3_client


def _retry_with_backoff(
    func: Callable[[], T], max_retries: int = 3, base_delay: float = 1.0
) -> T:
    """Execute function with exponential backoff retry.

    Args:
        func: Function to execute
        max_retries: Maximum number of attempts
        base_delay: Base delay in seconds (doubles each retry)

    Returns:
        Result of func()

    Raises:
        Exception: Last exception if all retries fail
    """
    last_exception = None

    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                delay = base_delay * (2**attempt)
                print(f"  Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                time.sleep(delay)

    raise last_exception  # type: ignore


def is_cache_valid(uri: str) -> bool:
    """Check if cached file is up-to-date by comparing ETag.

    Args:
        uri: S3 URI

    Returns:
        True if cache is valid, False if needs refresh
    """
    cached_json = get_cached_json_path(uri)
    if not cached_json.exists():
        return False

    metadata = load_cache_metadata(uri)
    if not metadata:
        return False

    try:
        bucket, key = parse_s3_uri(uri)

        # Get current ETag from S3 (HEAD request only)
        s3_client = get_s3_client()
        s3_metadata = s3_client.head_object(Bucket=bucket, Key=key)
        current_etag = s3_metadata.get("ETag", "").strip('"')

        # Compare
        if current_etag != metadata.get("etag"):
            print("  S3 file changed (ETag mismatch), cache invalidated")
            return False

        print(f"  Cache valid (ETag: {current_etag[:8]}...)")
        return True
    except Exception as e:
        # If we can't verify, warn user and DON'T silently use stale cache
        print(f"  Cannot verify cache: {e}")
        print("  Re-downloading to ensure fresh data...")
        return False


def _download_json_from_s3(uri: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Download JSON from S3 with retry logic.

    Args:
        uri: S3 URI

    Returns:
        Tuple of (parsed JSON data, S3 metadata)
    """
    bucket, key = parse_s3_uri(uri)
    s3_client = get_s3_client()

    def do_download():
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response["Body"].read()
        data = json.loads(content.decode("utf-8"))
        return data, {
            "ETag": response.get("ETag", ""),
            "ContentLength": response.get("ContentLength"),
        }

    return _retry_with_backoff(do_download)


def load_json_from_uri(uri: str) -> Tuple[Dict[str, Any], Path]:
    """Load JSON from URI with caching for S3.

    Args:
        uri: Local path or S3 URI

    Returns:
        Tuple of (parsed JSON data, path to local file)
    """
    uri_type = detect_uri_type(uri)

    if uri_type == "local":
        # Local file - just load directly
        local_path = Path(uri).expanduser()
        with open(local_path) as f:
            data = json.load(f)
        return data, local_path

    # S3 URI - use caching
    cached_path = get_cached_json_path(uri)

    if is_cache_valid(uri):
        # Use cached version
        print(f"  Using cached dataset: {cached_path}")
        with open(cached_path) as f:
            data = json.load(f)
        return data, cached_path

    # Download from S3
    print(f"  Downloading from S3: {uri}")
    data, s3_metadata = _download_json_from_s3(uri)

    # Cache locally
    cached_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cached_path, "w") as f:
        json.dump(data, f, indent=2)

    # Save metadata
    save_cache_metadata(uri, s3_metadata)

    print(f"  Cached to: {cached_path}")
    return data, cached_path


def get_cached_image_path(uri: str) -> Path:
    """Get path to cached image file.

    Args:
        uri: S3 URI for image

    Returns:
        Path to cached image file (preserves original extension)
    """
    # Extract extension from original URI
    _, key = parse_s3_uri(uri)
    ext = Path(key).suffix or ".jpg"

    return get_cache_dir() / "images" / f"{get_cache_key(uri)}{ext}"


def download_s3_image(uri: str) -> Path:
    """Download S3 image to local cache for processing.

    Uses simple caching (no ETag validation for images to keep it fast).
    Images are cached by URI hash with original extension preserved.

    Args:
        uri: S3 URI for image

    Returns:
        Path to local cached image file
    """
    cached_path = get_cached_image_path(uri)

    # If already cached, return immediately
    if cached_path.exists():
        return cached_path

    # Download from S3
    bucket, key = parse_s3_uri(uri)
    s3_client = get_s3_client()

    def do_download():
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    print(f"  Downloading S3 image: {uri}")
    image_data = _retry_with_backoff(do_download)

    # Cache locally
    cached_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cached_path, "wb") as f:
        f.write(image_data)

    print(f"  Cached image to: {cached_path}")
    return cached_path


def upload_json_to_s3(uri: str, local_path: Path) -> Dict[str, Any]:
    """Upload JSON file to S3 with retry logic.

    Args:
        uri: S3 URI destination
        local_path: Path to local JSON file

    Returns:
        S3 upload response metadata
    """
    bucket, key = parse_s3_uri(uri)
    s3_client = get_s3_client()

    def do_upload():
        with open(local_path, "rb") as f:
            content = f.read()

        response = s3_client.put_object(
            Bucket=bucket, Key=key, Body=content, ContentType="application/json"
        )
        return response

    return _retry_with_backoff(do_upload)


def resolve_image_uri(file_name: str, dataset_uri: str) -> str:
    """Resolve image path/URI from file_name relative to dataset URI.

    Args:
        file_name: Image file name (absolute or relative)
        dataset_uri: Dataset URI (local path or S3 URI)

    Returns:
        Absolute path or full S3 URI for the image
    """
    # Handle absolute paths
    if file_name.startswith("/"):
        return file_name

    # Handle home directory
    if file_name.startswith("~"):
        return str(Path(file_name).expanduser())

    # Handle absolute S3 URIs
    if detect_uri_type(file_name) == "s3":
        return file_name

    # Relative path - resolve relative to dataset location
    dataset_type = detect_uri_type(dataset_uri)

    if dataset_type == "s3":
        # Get directory part of S3 URI
        bucket, key = parse_s3_uri(dataset_uri)
        # Remove filename from key to get directory
        if "/" in key:
            dir_key = key.rsplit("/", 1)[0]
        else:
            dir_key = ""

        # Construct full S3 URI
        if dir_key:
            return f"s3://{bucket}/{dir_key}/{file_name}"
        else:
            return f"s3://{bucket}/{file_name}"
    else:
        # Local path - resolve relative to dataset directory
        dataset_path = Path(dataset_uri).expanduser()
        dataset_dir = dataset_path.parent
        return str(dataset_dir / file_name)
