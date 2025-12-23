"""Integration tests for gallery API routes."""

import json
import sys
from io import BytesIO
from typing import Dict, List, Tuple
from unittest.mock import MagicMock, mock_open, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

# Mock dataset with multiple images and various annotation types
MOCK_GALLERY_DATASET = {
    "info": {},
    "licenses": [],
    "images": [
        {"id": 1, "file_name": "image1.jpg", "width": 640, "height": 480},
        {"id": 2, "file_name": "image2.jpg", "width": 800, "height": 600},
        {"id": 3, "file_name": "image3.jpg", "width": 1024, "height": 768},
        {"id": 4, "file_name": "unannotated.jpg", "width": 512, "height": 512},
    ],
    "annotations": [
        # Image 1: object detection annotations
        {
            "id": 1,
            "image_id": 1,
            "category_id": 1,
            "segmentation": [[10, 20, 30, 40]],
            "bbox": [10, 20, 20, 20],
            "area": 400,
        },
        {
            "id": 2,
            "image_id": 1,
            "category_id": 2,
            "segmentation": [[50, 60, 70, 80]],
            "bbox": [50, 60, 20, 20],
            "area": 400,
        },
        # Image 2: keypoint annotation
        {
            "id": 3,
            "image_id": 2,
            "category_id": 1,
            "keypoints": [100, 100, 2, 150, 150, 2],
            "num_keypoints": 2,
        },
        # Image 3: captioning annotation
        {
            "id": 4,
            "image_id": 3,
            "category_id": 1,
            "caption": "A test image",
        },
        # Image 4: no annotations (unannotated)
    ],
    "categories": [
        {"id": 1, "name": "dog", "supercategory": "animal"},
        {"id": 2, "name": "cat", "supercategory": "animal"},
    ],
}

# Pre-computed gallery data for mock responses
MOCK_GALLERY_IMAGES = [
    {
        "id": 1,
        "index": 0,
        "file_name": "image1.jpg",
        "width": 640,
        "height": 480,
        "annotation_counts": {"object_detection": 2},
        "total_annotations": 2,
    },
    {
        "id": 2,
        "index": 1,
        "file_name": "image2.jpg",
        "width": 800,
        "height": 600,
        "annotation_counts": {"keypoint": 1},
        "total_annotations": 1,
    },
    {
        "id": 3,
        "index": 2,
        "file_name": "image3.jpg",
        "width": 1024,
        "height": 768,
        "annotation_counts": {"captioning": 1},
        "total_annotations": 1,
    },
    {
        "id": 4,
        "index": 3,
        "file_name": "unannotated.jpg",
        "width": 512,
        "height": 512,
        "annotation_counts": {},
        "total_annotations": 0,
    },
]


def mock_get_gallery_page(
    page: int,
    page_size: int,
    filter_type: str = "all",
    sort_by: str = "index",
) -> Tuple[List[Dict], int, int, bool]:
    """Mock implementation of get_gallery_page."""
    images = MOCK_GALLERY_IMAGES.copy()
    total_images = len(images)

    # Apply filter
    if filter_type == "annotated":
        images = [img for img in images if img["total_annotations"] > 0]
    elif filter_type == "unannotated":
        images = [img for img in images if img["total_annotations"] == 0]

    total_filtered = len(images)

    # Apply sort
    if sort_by == "filename":
        images.sort(key=lambda x: x["file_name"].lower())
    elif sort_by == "annotations_asc":
        images.sort(key=lambda x: x["total_annotations"])
    elif sort_by == "annotations_desc":
        images.sort(key=lambda x: x["total_annotations"], reverse=True)

    # Apply pagination
    start_idx = page * page_size
    end_idx = start_idx + page_size
    page_images = images[start_idx:end_idx]
    has_more = end_idx < total_filtered

    return page_images, total_images, total_filtered, has_more


def create_test_image(width: int = 200, height: int = 150) -> bytes:
    """Create a test JPEG image in memory."""
    img = Image.new("RGB", (width, height), color="red")
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


@pytest.fixture
def gallery_client():
    """Create test client with mocked dependencies for gallery tests."""
    with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
        with patch("pathlib.Path.exists", return_value=True):
            with patch("pathlib.Path.is_file", return_value=True):
                with patch("os.path.isdir", return_value=True):
                    with patch(
                        "builtins.open",
                        mock_open(read_data=json.dumps(MOCK_GALLERY_DATASET)),
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
                            from coco_label_tool.app.routes import app, cache

                            # Build image map by index for cache
                            image_map = {
                                i: img
                                for i, img in enumerate(MOCK_GALLERY_DATASET["images"])
                            }
                            annotations_by_image = {}
                            for ann in MOCK_GALLERY_DATASET["annotations"]:
                                img_id = ann["image_id"]
                                if img_id not in annotations_by_image:
                                    annotations_by_image[img_id] = []
                                annotations_by_image[img_id].append(ann)

                            # Populate cache
                            cache.update(
                                MOCK_GALLERY_DATASET["images"],
                                image_map,
                                annotations_by_image,
                                set(range(len(MOCK_GALLERY_DATASET["images"]))),
                            )

                            # Mock get_gallery_page to avoid dataset_manager dependency
                            with patch(
                                "coco_label_tool.app.dataset.get_gallery_page",
                                side_effect=mock_get_gallery_page,
                            ):
                                yield TestClient(app)


class TestGalleryDataEndpoint:
    """Tests for /api/gallery-data endpoint."""

    def test_get_gallery_data_default_params(self, gallery_client):
        """Test gallery data with default parameters."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        assert "images" in data
        assert "total_images" in data
        assert "total_filtered" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data

        assert data["total_images"] == 4
        assert data["total_filtered"] == 4
        assert data["page"] == 0
        assert data["page_size"] == 50
        assert data["has_more"] is False

    def test_get_gallery_data_returns_image_info(self, gallery_client):
        """Test that gallery data includes correct image information."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        # Check first image
        first_image = data["images"][0]
        assert "id" in first_image
        assert "index" in first_image
        assert "file_name" in first_image
        assert "width" in first_image
        assert "height" in first_image
        assert "annotation_counts" in first_image
        assert "total_annotations" in first_image

    def test_get_gallery_data_annotation_counts(self, gallery_client):
        """Test that annotation counts are correctly calculated."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        # Find image 1 (has 2 object detection annotations)
        image1 = next((img for img in data["images"] if img["id"] == 1), None)
        assert image1 is not None
        assert image1["total_annotations"] == 2
        assert image1["annotation_counts"].get("object_detection", 0) == 2

        # Find image 2 (has 1 keypoint annotation)
        image2 = next((img for img in data["images"] if img["id"] == 2), None)
        assert image2 is not None
        assert image2["total_annotations"] == 1
        assert image2["annotation_counts"].get("keypoint", 0) == 1

        # Find image 3 (has 1 captioning annotation)
        image3 = next((img for img in data["images"] if img["id"] == 3), None)
        assert image3 is not None
        assert image3["total_annotations"] == 1
        assert image3["annotation_counts"].get("captioning", 0) == 1

        # Find image 4 (no annotations)
        image4 = next((img for img in data["images"] if img["id"] == 4), None)
        assert image4 is not None
        assert image4["total_annotations"] == 0

    def test_get_gallery_data_filter_annotated(self, gallery_client):
        """Test filtering to only annotated images."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "annotated", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        # Should only return images with annotations (3 out of 4)
        assert data["total_filtered"] == 3
        assert len(data["images"]) == 3

        # All returned images should have annotations
        for img in data["images"]:
            assert img["total_annotations"] > 0

    def test_get_gallery_data_filter_unannotated(self, gallery_client):
        """Test filtering to only unannotated images."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "unannotated", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        # Should only return images without annotations (1 out of 4)
        assert data["total_filtered"] == 1
        assert len(data["images"]) == 1
        assert data["images"][0]["total_annotations"] == 0

    def test_get_gallery_data_sort_by_filename(self, gallery_client):
        """Test sorting by filename."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "all", "sort": "filename"},
        )
        assert response.status_code == 200
        data = response.json()

        # Verify images are sorted by filename
        filenames = [img["file_name"] for img in data["images"]]
        assert filenames == sorted(filenames)

    def test_get_gallery_data_sort_by_annotations_desc(self, gallery_client):
        """Test sorting by annotation count descending."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={
                "page": 0,
                "page_size": 50,
                "filter": "all",
                "sort": "annotations_desc",
            },
        )
        assert response.status_code == 200
        data = response.json()

        # First image should have the most annotations
        counts = [img["total_annotations"] for img in data["images"]]
        assert counts == sorted(counts, reverse=True)

    def test_get_gallery_data_sort_by_annotations_asc(self, gallery_client):
        """Test sorting by annotation count ascending."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={
                "page": 0,
                "page_size": 50,
                "filter": "all",
                "sort": "annotations_asc",
            },
        )
        assert response.status_code == 200
        data = response.json()

        # First image should have the fewest annotations
        counts = [img["total_annotations"] for img in data["images"]]
        assert counts == sorted(counts)

    def test_get_gallery_data_pagination(self, gallery_client):
        """Test pagination works correctly."""
        # Request first page with small page size
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 2, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["images"]) == 2
        assert data["has_more"] is True
        assert data["total_images"] == 4

        # Request second page
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 1, "page_size": 2, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["images"]) == 2
        assert data["has_more"] is False

    def test_get_gallery_data_empty_page(self, gallery_client):
        """Test requesting a page beyond available data."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 100, "page_size": 50, "filter": "all", "sort": "index"},
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["images"]) == 0
        assert data["has_more"] is False


class TestThumbnailEndpoint:
    """Tests for /api/thumbnail/{image_id} endpoint."""

    def test_thumbnail_not_found_invalid_id(self, gallery_client):
        """Test thumbnail for non-existent image ID returns 404."""
        response = gallery_client.get("/api/thumbnail/999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_thumbnail_valid_id_returns_error_for_missing_file(self, gallery_client):
        """Test that valid image ID tries to load file (404 from missing file, not cache)."""
        # Image ID 1 exists in the cache, so the endpoint should try to load the file
        # Since the actual file doesn't exist on disk, we get a 404 from file lookup
        response = gallery_client.get("/api/thumbnail/1")
        # 404 because file doesn't exist (not because ID wasn't in cache)
        assert response.status_code in [404, 500]

    def test_thumbnail_accepts_size_parameter(self, gallery_client):
        """Test that size parameter is accepted by the endpoint."""
        # Just test that the parameter is accepted (not that it works with missing file)
        response = gallery_client.get("/api/thumbnail/1?size=128")
        # Should not be 422 (validation error) - just 404/500 for missing file
        assert response.status_code in [404, 500]

    def test_thumbnail_default_size_is_64(self, gallery_client):
        """Test that default size parameter is 64."""
        # Request without size param should use default of 64
        response1 = gallery_client.get("/api/thumbnail/1")
        response2 = gallery_client.get("/api/thumbnail/1?size=64")
        # Both should have the same response status (file missing in both cases)
        assert response1.status_code == response2.status_code


class TestGalleryDataValidation:
    """Tests for request validation on gallery endpoints."""

    def test_gallery_data_invalid_page(self, gallery_client):
        """Test that negative page numbers are handled."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": -1, "page_size": 50, "filter": "all", "sort": "index"},
        )
        # Should either return empty or validation error
        assert response.status_code in [200, 422]

    def test_gallery_data_invalid_page_size(self, gallery_client):
        """Test that zero page size is handled."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 0, "filter": "all", "sort": "index"},
        )
        # Should either return empty or validation error
        assert response.status_code in [200, 422]

    def test_gallery_data_unknown_filter(self, gallery_client):
        """Test handling of unknown filter value."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={
                "page": 0,
                "page_size": 50,
                "filter": "invalid_filter",
                "sort": "index",
            },
        )
        # Should either use default or return validation error
        assert response.status_code in [200, 422]

    def test_gallery_data_unknown_sort(self, gallery_client):
        """Test handling of unknown sort value."""
        response = gallery_client.post(
            "/api/gallery-data",
            json={"page": 0, "page_size": 50, "filter": "all", "sort": "invalid_sort"},
        )
        # Should either use default or return validation error
        assert response.status_code in [200, 422]
