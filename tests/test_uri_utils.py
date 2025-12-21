"""Tests for S3 URI utilities module."""

import hashlib
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Patch config to avoid loading real dataset during tests
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.uri_utils import (
                _retry_with_backoff,
                detect_uri_type,
                download_s3_image,
                get_cache_dir,
                get_cache_key,
                get_cache_metadata_path,
                get_cached_image_path,
                get_cached_json_path,
                get_s3_client,
                is_cache_valid,
                load_cache_metadata,
                load_json_from_uri,
                parse_s3_uri,
                resolve_image_uri,
                save_cache_metadata,
                upload_json_to_s3,
            )
            import coco_label_tool.app.uri_utils


class TestURIDetection:
    """Tests for detect_uri_type function."""

    def test_detects_s3_uri(self):
        """S3 URI with s3:// prefix is detected."""
        assert detect_uri_type("s3://bucket/key") == "s3"

    def test_detects_s3a_uri(self):
        """S3A URI with s3a:// prefix is detected."""
        assert detect_uri_type("s3a://bucket/key") == "s3"

    def test_detects_local_absolute_path(self):
        """Absolute local path is detected."""
        assert detect_uri_type("/path/to/file.json") == "local"

    def test_detects_local_relative_path(self):
        """Relative local path is detected."""
        assert detect_uri_type("data/file.json") == "local"

    def test_handles_none_input(self):
        """None input returns local."""
        assert detect_uri_type(None) == "local"

    def test_handles_empty_string(self):
        """Empty string returns local."""
        assert detect_uri_type("") == "local"

    def test_case_insensitive(self):
        """URI detection is case insensitive."""
        assert detect_uri_type("S3://bucket/key") == "s3"
        assert detect_uri_type("S3A://bucket/key") == "s3"


class TestS3URIParsing:
    """Tests for parse_s3_uri function."""

    def test_parses_valid_s3_uri(self):
        """Valid S3 URI is parsed correctly."""
        bucket, key = parse_s3_uri("s3://my-bucket/path/to/file.json")
        assert bucket == "my-bucket"
        assert key == "path/to/file.json"

    def test_parses_s3a_uri(self):
        """S3A URI is parsed correctly."""
        bucket, key = parse_s3_uri("s3a://my-bucket/file.json")
        assert bucket == "my-bucket"
        assert key == "file.json"

    def test_raises_for_no_key(self):
        """Raises ValueError if no key in URI."""
        with pytest.raises(ValueError, match="no key"):
            parse_s3_uri("s3://bucket")

    def test_raises_for_empty_bucket(self):
        """Raises ValueError if bucket is empty."""
        with pytest.raises(ValueError, match="empty bucket"):
            parse_s3_uri("s3:///key")

    def test_raises_for_empty_key(self):
        """Raises ValueError if key is empty."""
        with pytest.raises(ValueError, match="empty key"):
            parse_s3_uri("s3://bucket/")

    def test_raises_for_empty_uri(self):
        """Raises ValueError for empty URI."""
        with pytest.raises(ValueError, match="Empty URI"):
            parse_s3_uri("")

    def test_raises_for_none_uri(self):
        """Raises ValueError for None URI."""
        with pytest.raises(ValueError, match="Empty URI"):
            parse_s3_uri(None)


class TestCacheKeyGeneration:
    """Tests for get_cache_key function."""

    def test_generates_deterministic_key(self):
        """Same URI produces same key."""
        key1 = get_cache_key("s3://bucket/file.json")
        key2 = get_cache_key("s3://bucket/file.json")
        assert key1 == key2

    def test_key_is_md5_format(self):
        """Key is 32 character hex string (MD5)."""
        key = get_cache_key("s3://bucket/file.json")
        assert len(key) == 32
        assert all(c in "0123456789abcdef" for c in key)

    def test_different_uris_produce_different_keys(self):
        """Different URIs produce different keys."""
        key1 = get_cache_key("s3://bucket/file1.json")
        key2 = get_cache_key("s3://bucket/file2.json")
        assert key1 != key2

    def test_key_matches_expected_md5(self):
        """Key matches expected MD5 hash."""
        uri = "s3://bucket/file.json"
        expected = hashlib.md5(uri.encode()).hexdigest()
        assert get_cache_key(uri) == expected


class TestCachePaths:
    """Tests for cache path functions."""

    def test_get_cache_dir_creates_directory(self):
        """Cache directory is created if it doesn't exist."""
        with patch.dict(os.environ, {"XDG_CACHE_HOME": "/tmp/test-cache"}):
            # Reset the cached value
            coco_label_tool.app.uri_utils._cache_dir = None

            cache_dir = get_cache_dir()
            assert "coco-label-tool" in str(cache_dir)
            assert "datasets" in str(cache_dir)

    def test_cached_json_path_uses_cache_key(self):
        """Cached JSON path uses MD5 cache key."""
        uri = "s3://bucket/file.json"
        path = get_cached_json_path(uri)
        assert get_cache_key(uri) in str(path)
        assert str(path).endswith(".json")

    def test_metadata_path_uses_cache_key(self):
        """Metadata path uses MD5 cache key."""
        uri = "s3://bucket/file.json"
        path = get_cache_metadata_path(uri)
        assert get_cache_key(uri) in str(path)
        assert str(path).endswith(".metadata")

    def test_cached_image_path_preserves_jpg_extension(self):
        """Cached image path preserves .jpg extension."""
        uri = "s3://bucket/images/photo.jpg"
        path = get_cached_image_path(uri)
        assert get_cache_key(uri) in str(path)
        assert str(path).endswith(".jpg")
        assert "images" in str(path)

    def test_cached_image_path_preserves_png_extension(self):
        """Cached image path preserves .png extension."""
        uri = "s3://bucket/images/photo.png"
        path = get_cached_image_path(uri)
        assert str(path).endswith(".png")

    def test_cached_image_path_default_extension(self):
        """Cached image path uses .jpg as default when no extension."""
        uri = "s3://bucket/images/photo"
        path = get_cached_image_path(uri)
        assert str(path).endswith(".jpg")


class TestImageDownload:
    """Tests for S3 image download functionality."""

    def test_download_s3_image_caches_file(self):
        """Downloaded image is cached to local file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                mock_client = MagicMock()
                mock_client.get_object.return_value = {
                    "Body": MagicMock(read=lambda: b"fake image data"),
                }

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    uri = "s3://bucket/images/test.jpg"
                    result_path = download_s3_image(uri)

                    # Check file was created
                    assert result_path.exists()
                    assert result_path.read_bytes() == b"fake image data"

    def test_download_s3_image_returns_cached(self):
        """Returns cached file without re-downloading."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/images/test.jpg"
                cached_path = get_cached_image_path(uri)
                cached_path.parent.mkdir(parents=True, exist_ok=True)
                cached_path.write_bytes(b"existing cached data")

                mock_client = MagicMock()
                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    result_path = download_s3_image(uri)

                    # Should return cached file without calling S3
                    assert result_path == cached_path
                    mock_client.get_object.assert_not_called()

    def test_download_s3_image_retries_on_failure(self):
        """Retries download on transient failures."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                mock_client = MagicMock()
                # Fail first call, succeed second
                mock_client.get_object.side_effect = [
                    Exception("Network error"),
                    {"Body": MagicMock(read=lambda: b"success data")},
                ]

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    with patch("time.sleep"):  # Skip actual sleep
                        uri = "s3://bucket/images/test.jpg"
                        result_path = download_s3_image(uri)

                        assert result_path.exists()
                        assert mock_client.get_object.call_count == 2


class TestCacheMetadata:
    """Tests for cache metadata operations."""

    def test_save_metadata_creates_file(self):
        """Saving metadata creates a file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"
                metadata = {"etag": "abc123", "size": 1000}

                save_cache_metadata(uri, metadata)

                # Verify file was created
                metadata_path = get_cache_metadata_path(uri)
                assert metadata_path.exists()

    def test_load_existing_metadata(self):
        """Loading existing metadata returns dict."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"
                # Use ETag (with capital T) to match S3 response format
                metadata = {"ETag": "abc123", "ContentLength": 1000}

                save_cache_metadata(uri, metadata)
                loaded = load_cache_metadata(uri)

                assert loaded["etag"] == "abc123"

    def test_load_nonexistent_metadata_returns_none(self):
        """Loading non-existent metadata returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                result = load_cache_metadata("s3://bucket/nonexistent.json")
                assert result is None

    def test_load_corrupted_metadata_returns_none(self):
        """Loading corrupted metadata returns None gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"
                metadata_path = get_cache_metadata_path(uri)
                metadata_path.parent.mkdir(parents=True, exist_ok=True)

                # Write corrupted JSON
                with open(metadata_path, "w") as f:
                    f.write("not valid json {{{")

                result = load_cache_metadata(uri)
                assert result is None


class TestCacheValidation:
    """Tests for cache validation."""

    def test_invalid_when_no_cache_file(self):
        """Cache is invalid when no cache file exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                assert is_cache_valid("s3://bucket/file.json") is False

    def test_valid_when_etag_matches(self):
        """Cache is valid when ETag matches S3."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"

                # Create cache file
                cache_path = get_cached_json_path(uri)
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump({"test": "data"}, f)

                # Create metadata with matching ETag
                save_cache_metadata(uri, {"ETag": "abc123"})

                # Mock S3 client to return matching ETag
                mock_client = MagicMock()
                mock_client.head_object.return_value = {"ETag": '"abc123"'}

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    assert is_cache_valid(uri) is True

    def test_invalid_when_etag_mismatches(self):
        """Cache is invalid when ETag doesn't match S3."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"

                # Create cache file
                cache_path = get_cached_json_path(uri)
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump({"test": "data"}, f)

                # Create metadata with old ETag
                save_cache_metadata(uri, {"ETag": "old-etag"})

                # Mock S3 client to return new ETag
                mock_client = MagicMock()
                mock_client.head_object.return_value = {"ETag": '"new-etag"'}

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    assert is_cache_valid(uri) is False

    def test_returns_false_on_s3_error(self):
        """Returns False (re-download) when S3 check fails."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"

                # Create cache file
                cache_path = get_cached_json_path(uri)
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump({"test": "data"}, f)

                save_cache_metadata(uri, {"ETag": "abc123"})

                # Mock S3 client to raise error
                mock_client = MagicMock()
                mock_client.head_object.side_effect = Exception("Network error")

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    # Should return False to force re-download
                    assert is_cache_valid(uri) is False


class TestImageURIResolution:
    """Tests for resolve_image_uri function."""

    def test_absolute_s3_uri_unchanged(self):
        """Absolute S3 URI in file_name is returned unchanged."""
        result = resolve_image_uri(
            "s3://other-bucket/image.jpg", "s3://bucket/dataset.json"
        )
        assert result == "s3://other-bucket/image.jpg"

    def test_absolute_local_path_unchanged(self):
        """Absolute local path in file_name is returned unchanged."""
        result = resolve_image_uri("/absolute/path/image.jpg", "/data/dataset.json")
        assert result == "/absolute/path/image.jpg"

    def test_relative_path_with_s3_dataset(self):
        """Relative path with S3 dataset produces S3 URI."""
        result = resolve_image_uri("images/001.jpg", "s3://bucket/datasets/coco.json")
        assert result == "s3://bucket/datasets/images/001.jpg"

    def test_nested_directories_preserved(self):
        """Nested directory structure is preserved."""
        result = resolve_image_uri(
            "train/images/subdir/001.jpg", "s3://bucket/data/coco.json"
        )
        assert result == "s3://bucket/data/train/images/subdir/001.jpg"

    def test_relative_path_with_local_dataset(self):
        """Relative path with local dataset produces local path."""
        result = resolve_image_uri("images/001.jpg", "/data/datasets/coco.json")
        assert result == "/data/datasets/images/001.jpg"

    def test_tilde_expansion(self):
        """Tilde in file_name is expanded."""
        result = resolve_image_uri("~/images/001.jpg", "/data/dataset.json")
        assert result.startswith(str(Path.home()))
        assert "images/001.jpg" in result


class TestJSONLoading:
    """Tests for JSON loading functions."""

    def test_load_from_local_path(self):
        """Loading from local path works without S3."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"test": "data"}, f)
            f.flush()

            try:
                data, local_path = load_json_from_uri(f.name)
                assert data == {"test": "data"}
                assert str(local_path) == f.name
            finally:
                os.unlink(f.name)

    def test_load_from_s3_with_caching(self):
        """Loading from S3 downloads and caches."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"
                test_data = {"test": "s3-data"}

                # Mock S3 download
                mock_client = MagicMock()
                mock_body = MagicMock()
                mock_body.read.return_value = json.dumps(test_data).encode()
                mock_client.get_object.return_value = {
                    "Body": mock_body,
                    "ETag": '"etag123"',
                    "ContentLength": 100,
                }

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    with patch.object(
                        coco_label_tool.app.uri_utils,
                        "is_cache_valid",
                        return_value=False,
                    ):
                        data, local_path = load_json_from_uri(uri)

                        assert data == test_data
                        assert local_path == get_cached_json_path(uri)

    def test_load_from_s3_uses_valid_cache(self):
        """Loading from S3 uses cache when valid."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(
                coco_label_tool.app.uri_utils,
                "get_cache_dir",
                return_value=Path(tmpdir),
            ):
                uri = "s3://bucket/file.json"
                cached_data = {"cached": "data"}

                # Create cache file
                cache_path = get_cached_json_path(uri)
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump(cached_data, f)

                # Mock cache as valid
                with patch.object(
                    coco_label_tool.app.uri_utils, "is_cache_valid", return_value=True
                ):
                    data, local_path = load_json_from_uri(uri)

                    assert data == cached_data
                    assert local_path == cache_path


class TestS3Upload:
    """Tests for S3 upload functions."""

    def test_successful_upload_returns_metadata(self):
        """Successful upload returns S3 metadata."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"test": "data"}, f)
            f.flush()

            try:
                mock_client = MagicMock()
                mock_client.put_object.return_value = {
                    "ETag": '"new-etag"',
                }

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    result = upload_json_to_s3("s3://bucket/file.json", Path(f.name))

                    assert result["ETag"] == '"new-etag"'
                    mock_client.put_object.assert_called_once()
            finally:
                os.unlink(f.name)

    def test_upload_with_retry_on_transient_failure(self):
        """Upload retries on transient failure."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"test": "data"}, f)
            f.flush()

            try:
                mock_client = MagicMock()
                # Fail first time, succeed second time
                mock_client.put_object.side_effect = [
                    Exception("Network error"),
                    {"ETag": '"success-etag"'},
                ]

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    with patch("time.sleep"):  # Don't actually sleep in tests
                        result = upload_json_to_s3(
                            "s3://bucket/file.json", Path(f.name)
                        )

                        assert result["ETag"] == '"success-etag"'
                        assert mock_client.put_object.call_count == 2
            finally:
                os.unlink(f.name)

    def test_upload_fails_after_max_retries(self):
        """Upload raises after max retries exhausted."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"test": "data"}, f)
            f.flush()

            try:
                mock_client = MagicMock()
                mock_client.put_object.side_effect = Exception("Persistent error")

                with patch.object(
                    coco_label_tool.app.uri_utils,
                    "get_s3_client",
                    return_value=mock_client,
                ):
                    with patch("time.sleep"):  # Don't actually sleep in tests
                        with pytest.raises(Exception, match="Persistent error"):
                            upload_json_to_s3("s3://bucket/file.json", Path(f.name))
            finally:
                os.unlink(f.name)


class TestS3Client:
    """Tests for S3 client creation."""

    def test_default_region(self):
        """Default region is us-east-1."""
        # Reset cached client
        coco_label_tool.app.uri_utils._s3_client = None

        with patch.dict(os.environ, {}, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                mock_boto.assert_called_once()
                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["region_name"] == "us-east-1"

        # Reset for other tests
        coco_label_tool.app.uri_utils._s3_client = None

    def test_aws_region_env_var(self):
        """AWS_REGION environment variable is respected."""
        coco_label_tool.app.uri_utils._s3_client = None

        with patch.dict(os.environ, {"AWS_REGION": "eu-west-1"}, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["region_name"] == "eu-west-1"

        coco_label_tool.app.uri_utils._s3_client = None

    def test_aws_default_region_env_var(self):
        """AWS_DEFAULT_REGION environment variable is respected."""
        coco_label_tool.app.uri_utils._s3_client = None

        with patch.dict(os.environ, {"AWS_DEFAULT_REGION": "ap-south-1"}, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["region_name"] == "ap-south-1"

        coco_label_tool.app.uri_utils._s3_client = None

    def test_region_priority(self):
        """AWS_REGION takes priority over AWS_DEFAULT_REGION."""
        coco_label_tool.app.uri_utils._s3_client = None

        env = {"AWS_REGION": "us-west-2", "AWS_DEFAULT_REGION": "eu-central-1"}
        with patch.dict(os.environ, env, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["region_name"] == "us-west-2"

        coco_label_tool.app.uri_utils._s3_client = None

    def test_client_is_cached(self):
        """S3 client is cached (singleton)."""
        coco_label_tool.app.uri_utils._s3_client = None

        with patch("boto3.client") as mock_boto:
            mock_boto.return_value = MagicMock()

            client1 = get_s3_client()
            client2 = get_s3_client()

            # Should only create client once
            assert mock_boto.call_count == 1
            assert client1 is client2

        coco_label_tool.app.uri_utils._s3_client = None

    def test_custom_endpoint_url(self):
        """AWS_ENDPOINT_URL_S3 environment variable is used for custom endpoints."""
        coco_label_tool.app.uri_utils._s3_client = None

        env = {"AWS_ENDPOINT_URL_S3": "http://localhost:9000"}
        with patch.dict(os.environ, env, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["endpoint_url"] == "http://localhost:9000"

        coco_label_tool.app.uri_utils._s3_client = None

    def test_no_endpoint_url_by_default(self):
        """Without AWS_ENDPOINT_URL_S3, endpoint_url is None (standard AWS)."""
        coco_label_tool.app.uri_utils._s3_client = None

        with patch.dict(os.environ, {}, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert call_kwargs["endpoint_url"] is None

        coco_label_tool.app.uri_utils._s3_client = None

    def test_custom_endpoint_with_credentials(self):
        """Custom endpoint works with AWS credentials."""
        coco_label_tool.app.uri_utils._s3_client = None

        env = {
            "AWS_ENDPOINT_URL_S3": "https://nyc3.digitaloceanspaces.com",
            "AWS_ACCESS_KEY_ID": "my-access-key",
            "AWS_SECRET_ACCESS_KEY": "my-secret-key",
            "AWS_REGION": "nyc3",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch("boto3.client") as mock_boto:
                mock_boto.return_value = MagicMock()
                get_s3_client()

                call_kwargs = mock_boto.call_args[1]
                assert (
                    call_kwargs["endpoint_url"] == "https://nyc3.digitaloceanspaces.com"
                )
                assert call_kwargs["aws_access_key_id"] == "my-access-key"
                assert call_kwargs["aws_secret_access_key"] == "my-secret-key"
                assert call_kwargs["region_name"] == "nyc3"

        coco_label_tool.app.uri_utils._s3_client = None


class TestRetryLogic:
    """Tests for retry with backoff logic."""

    def test_success_on_first_attempt(self):
        """No retry when first attempt succeeds."""
        call_count = 0

        def succeeds():
            nonlocal call_count
            call_count += 1
            return "success"

        result = _retry_with_backoff(succeeds)
        assert result == "success"
        assert call_count == 1

    def test_success_on_second_attempt(self):
        """Retries and succeeds on second attempt."""
        call_count = 0

        def fails_then_succeeds():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Transient error")
            return "success"

        with patch("time.sleep"):
            result = _retry_with_backoff(fails_then_succeeds)

        assert result == "success"
        assert call_count == 2

    def test_success_on_third_attempt(self):
        """Retries and succeeds on third attempt."""
        call_count = 0

        def fails_twice():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Transient error")
            return "success"

        with patch("time.sleep"):
            result = _retry_with_backoff(fails_twice)

        assert result == "success"
        assert call_count == 3

    def test_failure_after_max_retries(self):
        """Raises last exception after max retries."""

        def always_fails():
            raise ValueError("Persistent error")

        with patch("time.sleep"):
            with pytest.raises(ValueError, match="Persistent error"):
                _retry_with_backoff(always_fails, max_retries=3)
