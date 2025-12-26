"""Tests for auto-labeling service."""

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Create a temporary COCO JSON file for config validation
_temp_coco = tempfile.NamedTemporaryFile(
    mode="w", suffix=".json", delete=False, prefix="test_coco_"
)
_temp_coco.write('{"images": [], "annotations": [], "categories": []}')
_temp_coco.flush()
_temp_coco.close()

# Set DATASET_PATH before importing modules that depend on config
os.environ["DATASET_PATH"] = _temp_coco.name

from coco_label_tool.app.auto_label import (  # noqa: E402
    AutoLabelConfig,
    AutoLabelService,
    EndpointConfig,
    clear_auto_label_service,
    load_auto_label_config,
)


# =============================================================================
# Config Loading Tests
# =============================================================================


class TestLoadConfig:
    """Tests for loading auto-label configuration."""

    def test_load_valid_config(self):
        """Test loading a valid YAML config."""
        yaml_content = """
endpoints:
  test-endpoint:
    url: "https://example.com/api/detect"
    auth_token: "Bearer token123"
    category_mapping:
      1: 5
      2: 10
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = load_auto_label_config(f.name)

        assert len(config.endpoints) == 1
        assert "test-endpoint" in config.endpoints
        endpoint = config.endpoints["test-endpoint"]
        assert endpoint.url == "https://example.com/api/detect"
        assert endpoint.auth_token == "Bearer token123"
        assert endpoint.category_mapping == {1: 5, 2: 10}

    def test_load_config_with_min_confidence(self):
        """Test loading config with min_confidence field."""
        yaml_content = """
endpoints:
  detector:
    url: "https://example.com/detect"
    min_confidence: 0.75
    category_mapping:
      0: 1
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = load_auto_label_config(f.name)

        assert config.endpoints["detector"].min_confidence == 0.75

    def test_load_config_default_min_confidence(self):
        """Test that min_confidence defaults to 0.0."""
        yaml_content = """
endpoints:
  detector:
    url: "https://example.com/detect"
    category_mapping:
      0: 1
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = load_auto_label_config(f.name)

        assert config.endpoints["detector"].min_confidence == 0.0

    def test_load_config_empty_auth_token(self):
        """Test loading config with empty auth token."""
        yaml_content = """
endpoints:
  detector:
    url: "https://example.com/detect"
    auth_token: ""
    category_mapping:
      0: 1
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = load_auto_label_config(f.name)

        assert config.endpoints["detector"].auth_token == ""

    def test_load_config_missing_file(self):
        """Test loading non-existent config file."""
        with pytest.raises(FileNotFoundError):
            load_auto_label_config("/nonexistent/path/config.yaml")

    def test_load_config_invalid_yaml(self):
        """Test loading invalid YAML."""
        yaml_content = "invalid: yaml: content:"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            with pytest.raises(Exception):
                load_auto_label_config(f.name)

    def test_load_config_multiple_endpoints(self):
        """Test loading config with multiple endpoints."""
        yaml_content = """
endpoints:
  yolo:
    url: "https://yolo.example.com/detect"
    category_mapping:
      1: 1
  florence:
    url: "https://florence.example.com/segment"
    auth_token: "secret"
    min_confidence: 0.5
    category_mapping:
      0: 2
      1: 3
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = load_auto_label_config(f.name)

        assert len(config.endpoints) == 2
        assert "yolo" in config.endpoints
        assert "florence" in config.endpoints


# =============================================================================
# Annotation Validation Tests
# =============================================================================


class TestValidateAnnotation:
    """Tests for annotation validation."""

    def setup_method(self):
        """Set up test service."""
        config = AutoLabelConfig(
            endpoints={
                "test": EndpointConfig(
                    url="https://example.com",
                    category_mapping={1: 10},
                )
            }
        )
        self.service = AutoLabelService(config)

    def test_validate_annotation_valid(self):
        """Test validating a valid COCO annotation."""
        ann = {
            "category_id": 1,
            "segmentation": [[10, 10, 20, 10, 20, 20, 10, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        # Should not raise
        self.service._validate_annotation(ann)

    def test_validate_annotation_missing_category_id(self):
        """Test validation fails without category_id."""
        ann = {
            "segmentation": [[10, 10, 20, 10, 20, 20, 10, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="missing 'category_id'"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_missing_segmentation(self):
        """Test validation fails without segmentation."""
        ann = {
            "category_id": 1,
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="missing 'segmentation'"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_missing_bbox(self):
        """Test validation fails without bbox."""
        ann = {
            "category_id": 1,
            "segmentation": [[10, 10, 20, 10, 20, 20, 10, 20]],
            "area": 100,
        }
        with pytest.raises(ValueError, match="missing 'bbox'"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_missing_area(self):
        """Test validation fails without area."""
        ann = {
            "category_id": 1,
            "segmentation": [[10, 10, 20, 10, 20, 20, 10, 20]],
            "bbox": [10, 10, 10, 10],
        }
        with pytest.raises(ValueError, match="missing 'area'"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_empty_segmentation(self):
        """Test validation fails with empty segmentation."""
        ann = {
            "category_id": 1,
            "segmentation": [],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="cannot be empty"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_segmentation_not_list(self):
        """Test validation fails when segmentation is not a list."""
        ann = {
            "category_id": 1,
            "segmentation": "not a list",
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="must be a list"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_polygon_too_few_points(self):
        """Test validation fails with polygon having < 3 points."""
        ann = {
            "category_id": 1,
            "segmentation": [[10, 10, 20, 20]],  # Only 2 points (4 coords)
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="needs at least 3 points"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_polygon_not_list(self):
        """Test validation fails when polygon is not a list."""
        ann = {
            "category_id": 1,
            "segmentation": ["not a polygon"],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        with pytest.raises(ValueError, match="must be a list of coordinates"):
            self.service._validate_annotation(ann)

    def test_validate_annotation_multiple_polygons(self):
        """Test validation works with multiple polygons."""
        ann = {
            "category_id": 1,
            "segmentation": [
                [10, 10, 20, 10, 20, 20, 10, 20],
                [30, 30, 40, 30, 40, 40, 30, 40],
            ],
            "bbox": [10, 10, 30, 30],
            "area": 200,
        }
        # Should not raise
        self.service._validate_annotation(ann)


# =============================================================================
# Annotation Mapping Tests
# =============================================================================


class TestMapAnnotation:
    """Tests for category mapping."""

    def setup_method(self):
        """Set up test service."""
        config = AutoLabelConfig(
            endpoints={
                "test": EndpointConfig(
                    url="https://example.com",
                    category_mapping={1: 10, 2: 20},
                )
            }
        )
        self.service = AutoLabelService(config)

    def test_map_annotation_valid(self):
        """Test mapping with valid category."""
        ann = {
            "category_id": 1,
            "segmentation": [[10, 10, 20, 10, 20, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        mapping = {1: 10}
        result = self.service._map_annotation(ann, mapping)

        assert result is not None
        assert result["category_id"] == 10
        assert result["segmentation"] == [[10, 10, 20, 10, 20, 20]]
        assert result["bbox"] == [10, 10, 10, 10]
        assert result["area"] == 100

    def test_map_annotation_unmapped_returns_none(self):
        """Test that unmapped categories return None."""
        ann = {
            "category_id": 999,  # Not in mapping
            "segmentation": [[10, 10, 20, 10, 20, 20]],
            "bbox": [10, 10, 10, 10],
            "area": 100,
        }
        mapping = {1: 10}
        result = self.service._map_annotation(ann, mapping)

        assert result is None

    def test_map_annotation_preserves_fields(self):
        """Test that mapping preserves all required fields."""
        ann = {
            "category_id": 2,
            "segmentation": [[1, 2, 3, 4, 5, 6]],
            "bbox": [1, 2, 3, 4],
            "area": 50.5,
        }
        mapping = {2: 20}
        result = self.service._map_annotation(ann, mapping)

        assert result["category_id"] == 20
        assert result["segmentation"] == [[1, 2, 3, 4, 5, 6]]
        assert result["bbox"] == [1, 2, 3, 4]
        assert result["area"] == 50.5


# =============================================================================
# Service Tests
# =============================================================================


class TestAutoLabelService:
    """Tests for AutoLabelService."""

    def test_get_endpoint_names(self):
        """Test getting endpoint names."""
        config = AutoLabelConfig(
            endpoints={
                "yolo": EndpointConfig(url="https://yolo.com", category_mapping={1: 1}),
                "florence": EndpointConfig(
                    url="https://florence.com", category_mapping={1: 1}
                ),
            }
        )
        service = AutoLabelService(config)

        names = service.get_endpoint_names()

        assert len(names) == 2
        assert "yolo" in names
        assert "florence" in names

    def test_get_endpoint_names_empty(self):
        """Test getting endpoint names when none configured."""
        config = AutoLabelConfig(endpoints={})
        service = AutoLabelService(config)

        names = service.get_endpoint_names()

        assert names == []

    @pytest.mark.asyncio
    async def test_auto_label_unknown_endpoint(self):
        """Test that unknown endpoint raises ValueError."""
        config = AutoLabelConfig(
            endpoints={
                "known": EndpointConfig(
                    url="https://example.com", category_mapping={1: 1}
                )
            }
        )
        service = AutoLabelService(config)

        with pytest.raises(ValueError, match="Unknown endpoint"):
            await service.auto_label_image("unknown", Path("/tmp/test.jpg"))

    @pytest.mark.asyncio
    async def test_auto_label_filters_by_confidence(self):
        """Test that low confidence annotations are filtered."""
        config = AutoLabelConfig(
            endpoints={
                "test": EndpointConfig(
                    url="https://example.com",
                    min_confidence=0.5,
                    category_mapping={1: 10},
                )
            }
        )
        service = AutoLabelService(config)

        # Mock HTTP response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "annotations": [
                {
                    "category_id": 1,
                    "segmentation": [[10, 10, 20, 10, 20, 20]],
                    "bbox": [10, 10, 10, 10],
                    "area": 100,
                    "score": 0.3,  # Below threshold
                },
                {
                    "category_id": 1,
                    "segmentation": [[30, 30, 40, 30, 40, 40]],
                    "bbox": [30, 30, 10, 10],
                    "area": 100,
                    "score": 0.8,  # Above threshold
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        # Create mock image file
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            f.write(b"fake image data")
            image_path = Path(f.name)

        with patch.object(service, "_get_client") as mock_client:
            mock_client.return_value.post = AsyncMock(return_value=mock_response)

            result = await service.auto_label_image("test", image_path)

        # Only 1 annotation should pass the confidence filter
        assert len(result) == 1
        assert result[0]["category_id"] == 10

    @pytest.mark.asyncio
    async def test_auto_label_skips_unmapped_categories(self):
        """Test that unmapped categories are silently skipped."""
        config = AutoLabelConfig(
            endpoints={
                "test": EndpointConfig(
                    url="https://example.com",
                    category_mapping={1: 10},  # Only maps category 1
                )
            }
        )
        service = AutoLabelService(config)

        # Mock HTTP response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "annotations": [
                {
                    "category_id": 1,  # Mapped
                    "segmentation": [[10, 10, 20, 10, 20, 20]],
                    "bbox": [10, 10, 10, 10],
                    "area": 100,
                },
                {
                    "category_id": 999,  # NOT mapped
                    "segmentation": [[30, 30, 40, 30, 40, 40]],
                    "bbox": [30, 30, 10, 10],
                    "area": 100,
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        # Create mock image file
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            f.write(b"fake image data")
            image_path = Path(f.name)

        with patch.object(service, "_get_client") as mock_client:
            mock_client.return_value.post = AsyncMock(return_value=mock_response)

            result = await service.auto_label_image("test", image_path)

        # Only 1 annotation should be returned (mapped category)
        assert len(result) == 1
        assert result[0]["category_id"] == 10


# =============================================================================
# Singleton Tests
# =============================================================================


class TestSingleton:
    """Tests for singleton management."""

    def test_clear_auto_label_service(self):
        """Test clearing the singleton."""
        # Just ensure it doesn't raise
        clear_auto_label_service()
