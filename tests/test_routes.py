"""Integration tests for API routes."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, mock_open
import json
import sys

MOCK_DATASET = {
    "info": {},
    "licenses": [],
    "images": [{"id": 1, "file_name": "test.jpg", "width": 640, "height": 480}],
    "annotations": [{"id": 1, "image_id": 1, "category_id": 1}],
    "categories": [{"id": 1, "name": "dog", "supercategory": "animal"}],
}


@pytest.fixture
def client():
    """Create test client with mocked dependencies."""
    with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
        with patch("pathlib.Path.exists", return_value=True):
            with patch("pathlib.Path.is_file", return_value=True):
                with patch("os.path.isdir", return_value=True):
                    with patch(
                        "builtins.open", mock_open(read_data=json.dumps(MOCK_DATASET))
                    ):
                        mock_torch = MagicMock()
                        mock_torch.compiler.is_compiling = lambda: False
                        mock_torch.cuda.is_available.return_value = False
                        mock_torch.backends.mps.is_available.return_value = False

                        with patch.dict(
                            sys.modules,
                            {
                                "transformers": MagicMock(),
                                "torch": mock_torch,
                                "torchvision": MagicMock(),
                                "cv2": MagicMock(),
                            },
                        ):
                            from app.routes import app, cache

                            # Manually populate cache for tests (startup event isn't triggered by TestClient)
                            cache.update(
                                MOCK_DATASET["images"],
                                {1: MOCK_DATASET["images"][0]},
                                {1: MOCK_DATASET["annotations"]},
                                {0},
                            )

                            yield TestClient(app)


class TestRootEndpoint:
    def test_root_returns_html(self, client):
        """Test / endpoint returns HTML."""
        with patch("builtins.open", mock_open(read_data="<html></html>")):
            response = client.get("/")
            assert response.status_code == 200
            assert "html" in response.text


class TestDatasetEndpoint:
    def test_get_dataset(self, client):
        """Test /api/dataset returns cache."""
        response = client.get("/api/dataset")
        assert response.status_code == 200
        data = response.json()
        assert "images" in data
        assert "annotations_by_image" in data
        assert "total_images" in data


class TestLoadRangeEndpoint:
    def test_load_range_success(self, client):
        """Test /api/load-range loads images."""
        with patch("app.dataset.load_images_range") as mock_load:
            mock_load.return_value = ([], {}, {}, set())

            response = client.post("/api/load-range", json={"start": 0, "end": 10})
            assert response.status_code == 200
            assert response.json()["success"] is True


class TestDeleteImageEndpoint:
    def test_delete_image_not_confirmed(self, client):
        """Test delete image requires confirmation."""
        response = client.post(
            "/api/delete-image", json={"image_id": 1, "confirmed": False}
        )
        assert response.status_code == 400
        assert "not confirmed" in response.json()["detail"].lower()

    def test_delete_image_confirmed(self, client):
        """Test delete image when confirmed."""
        with patch("app.dataset.delete_image") as mock_delete:
            response = client.post(
                "/api/delete-image", json={"image_id": 1, "confirmed": True}
            )
            assert response.status_code == 200
            assert response.json()["success"] is True
            mock_delete.assert_called_once_with(1)


class TestSegmentEndpoint:
    def test_segment_image_not_found(self, client):
        """Test segment returns 404 when image not in cache."""
        response = client.post("/api/segment", json={"image_id": 999})
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_segment_file_not_found(self, client):
        """Test segment returns 404 when file doesn't exist."""
        with patch("pathlib.Path.exists", return_value=False):
            response = client.post("/api/segment", json={"image_id": 1})
            assert response.status_code == 404

    def test_segment_success(self, client):
        """Test successful segmentation."""
        with patch("pathlib.Path.exists", return_value=True):
            with patch("app.routes.get_sam2_service") as mock_get_service:
                mock_service = MagicMock()
                mock_service.segment_image.return_value = [[10, 10, 20, 20]]
                mock_get_service.return_value = mock_service

                response = client.post(
                    "/api/segment",
                    json={"image_id": 1, "points": [[10, 10]], "labels": [1]},
                )
                assert response.status_code == 200
                assert "segmentation" in response.json()


class TestCategoriesEndpoint:
    def test_get_categories(self, client):
        """Test /api/categories returns categories."""
        with patch("app.dataset.get_categories") as mock_get:
            mock_get.return_value = [{"id": 1, "name": "dog"}]

            response = client.get("/api/categories")
            assert response.status_code == 200
            assert len(response.json()["categories"]) == 1


class TestSaveAnnotationEndpoint:
    def test_save_annotation_success(self, client):
        """Test saving annotation."""
        with patch("app.dataset.add_annotation") as mock_add:
            mock_add.return_value = {"id": 2, "image_id": 1, "category_id": 1}

            response = client.post(
                "/api/save-annotation",
                json={
                    "image_id": 1,
                    "category_id": 1,
                    "segmentation": [[10, 10, 20, 20]],
                },
            )
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert "annotation" in response.json()


class TestAddCategoryEndpoint:
    def test_add_category_success(self, client):
        """Test adding category."""
        with patch("app.dataset.add_category") as mock_add:
            mock_add.return_value = {"id": 2, "name": "cat", "supercategory": "animal"}

            response = client.post(
                "/api/add-category", json={"name": "cat", "supercategory": "animal"}
            )
            assert response.status_code == 200
            assert response.json()["success"] is True


class TestUpdateCategoryEndpoint:
    def test_update_category_success(self, client):
        """Test updating category."""
        with patch("app.dataset.update_category"):
            response = client.post(
                "/api/update-category",
                json={"id": 1, "name": "puppy", "supercategory": "animal"},
            )
            assert response.status_code == 200
            assert response.json()["success"] is True


class TestDeleteCategoryEndpoint:
    def test_delete_category_in_use(self, client):
        """Test deleting category in use returns 400."""
        with patch("app.dataset.delete_category") as mock_delete:
            from app.exceptions import CategoryInUseError

            mock_delete.side_effect = CategoryInUseError("Category is in use")

            response = client.post("/api/delete-category", json={"id": 1})
            assert response.status_code == 400
            assert "in use" in response.json()["detail"].lower()

    def test_delete_category_success(self, client):
        """Test successful category deletion."""
        with patch("app.dataset.delete_category"):
            response = client.post("/api/delete-category", json={"id": 1})
            assert response.status_code == 200


class TestUpdateAnnotationEndpoint:
    def test_update_annotation_not_found(self, client):
        """Test updating non-existent annotation returns 404."""
        with patch("app.dataset.update_annotation") as mock_update:
            from app.exceptions import AnnotationNotFoundError

            mock_update.side_effect = AnnotationNotFoundError("Not found")

            response = client.post(
                "/api/update-annotation", json={"annotation_id": 999, "category_id": 1}
            )
            assert response.status_code == 404

    def test_update_annotation_success(self, client):
        """Test successful annotation update."""
        with patch("app.dataset.update_annotation") as mock_update:
            mock_update.return_value = {"id": 1, "category_id": 2}

            response = client.post(
                "/api/update-annotation", json={"annotation_id": 1, "category_id": 2}
            )
            assert response.status_code == 200
            assert response.json()["success"] is True


class TestDeleteAnnotationEndpoint:
    def test_delete_annotation_not_confirmed(self, client):
        """Test delete annotation requires confirmation."""
        response = client.post(
            "/api/delete-annotation", json={"annotation_id": 1, "confirmed": False}
        )
        assert response.status_code == 400

    def test_delete_annotation_success(self, client):
        """Test successful annotation deletion."""
        with patch("app.dataset.delete_annotation"):
            response = client.post(
                "/api/delete-annotation", json={"annotation_id": 1, "confirmed": True}
            )
            assert response.status_code == 200


class TestModelInfoEndpoint:
    def test_get_model_info(self, client):
        """Test /api/model-info returns model details."""
        with patch("app.routes.get_sam2_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.model_id = "facebook/sam2-hiera-tiny"
            mock_service.device = "cpu"
            mock_get_service.return_value = mock_service

            response = client.get("/api/model-info")
            assert response.status_code == 200
            data = response.json()
            assert "current_model" in data
            assert "available_sizes" in data
            assert "device" in data


class TestSetModelSizeEndpoint:
    def test_set_model_size_invalid(self, client):
        """Test setting invalid model size returns 400."""
        response = client.post("/api/set-model-size", json={"model_size": "invalid"})
        assert response.status_code == 400
        assert "Invalid model size" in response.json()["detail"]

    def test_set_model_size_success(self, client):
        """Test successful model size change."""
        with patch("app.routes.get_sam2_service") as mock_get_service:
            mock_service = MagicMock()
            mock_get_service.return_value = mock_service

            response = client.post("/api/set-model-size", json={"model_size": "small"})
            assert response.status_code == 200
            assert response.json()["success"] is True
            mock_service.reload_model.assert_called_once()


class TestCacheHeaders:
    """Test Cache-Control headers prevent browser caching."""

    def test_dataset_endpoint_no_cache(self, client):
        """Test /api/dataset has no-cache headers."""
        response = client.get("/api/dataset")
        assert response.status_code == 200
        assert "Cache-Control" in response.headers
        cache_control = response.headers["Cache-Control"]
        assert "no-store" in cache_control
        assert "no-cache" in cache_control
        assert "must-revalidate" in cache_control

    def test_categories_endpoint_no_cache(self, client):
        """Test /api/categories has no-cache headers."""
        with patch("app.dataset.get_categories") as mock_get:
            mock_get.return_value = [{"id": 1, "name": "dog"}]

            response = client.get("/api/categories")
            assert response.status_code == 200
            assert "Cache-Control" in response.headers
            cache_control = response.headers["Cache-Control"]
            assert "no-store" in cache_control
            assert "no-cache" in cache_control
            assert "must-revalidate" in cache_control

    def test_annotations_endpoint_no_cache(self, client):
        """Test /api/annotations/{image_id} has no-cache headers."""
        with patch("app.dataset.get_annotations_by_image") as mock_get:
            mock_get.return_value = [{"id": 1, "image_id": 1, "category_id": 1}]

            response = client.get("/api/annotations/1")
            assert response.status_code == 200
            assert "Cache-Control" in response.headers
            cache_control = response.headers["Cache-Control"]
            assert "no-store" in cache_control
            assert "no-cache" in cache_control
            assert "must-revalidate" in cache_control

    def test_s3_image_endpoint_no_cache(self, client):
        """Test /api/image/{image_id} returns no-cache headers for S3 images."""
        # Create a minimal valid JPEG image
        from PIL import Image
        import io as io_module

        img = Image.new("RGB", (100, 100), color="red")
        img_buffer = io_module.BytesIO()
        img.save(img_buffer, format="JPEG")
        img_bytes = img_buffer.getvalue()

        # Mock S3 response with valid JPEG data
        mock_s3_response = MagicMock()
        mock_body = MagicMock()
        mock_body.read = MagicMock(return_value=img_bytes)
        mock_s3_response.return_value = {
            "Body": mock_body,
            "ContentType": "image/jpeg",
            "ContentLength": len(img_bytes),
        }

        with patch("app.routes.detect_uri_type", return_value="s3"):
            with patch("app.routes.get_s3_client") as mock_get_client:
                mock_client = MagicMock()
                mock_client.get_object = mock_s3_response
                mock_get_client.return_value = mock_client

                with patch("app.routes.parse_s3_uri", return_value=("bucket", "key")):
                    response = client.get("/api/image/1")
                    assert response.status_code == 200
                    assert "Cache-Control" in response.headers
                    cache_control = response.headers["Cache-Control"]
                    assert "no-store" in cache_control
                    assert "no-cache" in cache_control
                    assert "must-revalidate" in cache_control
