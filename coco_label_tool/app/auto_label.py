"""Auto-labeling service for external object detection servers."""

import base64
from pathlib import Path
from typing import Dict, List, Optional

import httpx
import yaml
from pydantic import BaseModel, Field


class EndpointConfig(BaseModel):
    """Configuration for a single auto-label endpoint."""

    url: str
    auth_token: str = ""
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    category_mapping: Dict[int, int]  # server_cat_id -> local_cat_id


class AutoLabelConfig(BaseModel):
    """Top-level auto-label configuration."""

    endpoints: Dict[str, EndpointConfig]


class AutoLabelService:
    """Handles communication with external auto-labeling servers."""

    def __init__(self, config: AutoLabelConfig):
        self.config = config
        self.http_client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client (lazy initialization)."""
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(timeout=60.0)
        return self.http_client

    def get_endpoint_names(self) -> List[str]:
        """Return list of configured endpoint names for UI."""
        return list(self.config.endpoints.keys())

    async def auto_label_image(
        self, endpoint_name: str, image_path: Path
    ) -> List[Dict]:
        """Send image to auto-label server and return mapped annotations."""
        if endpoint_name not in self.config.endpoints:
            raise ValueError(f"Unknown endpoint: {endpoint_name}")

        endpoint = self.config.endpoints[endpoint_name]

        # Read and encode image as base64
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        # Build request headers
        headers = {"Content-Type": "application/json"}
        if endpoint.auth_token:
            headers["Authorization"] = endpoint.auth_token

        # Send request
        client = self._get_client()
        response = await client.post(
            endpoint.url, json={"image": image_data}, headers=headers
        )
        response.raise_for_status()

        # Parse response
        result = response.json()
        annotations = result.get("annotations", [])

        # Validate and map annotations
        mapped = []
        for ann in annotations:
            # Validate required fields
            self._validate_annotation(ann)

            # Filter by confidence if present
            score = ann.get("score", 1.0)
            if score < endpoint.min_confidence:
                continue

            # Map category (skip if unmapped)
            mapped_ann = self._map_annotation(ann, endpoint.category_mapping)
            if mapped_ann:
                mapped.append(mapped_ann)

        return mapped

    def _validate_annotation(self, ann: Dict) -> None:
        """Validate annotation has required COCO fields."""
        required = ["category_id", "segmentation", "bbox", "area"]
        for field in required:
            if field not in ann:
                raise ValueError(f"Invalid annotation: missing '{field}'")

        # Validate segmentation is polygon format
        seg = ann["segmentation"]
        if not isinstance(seg, list):
            raise ValueError("segmentation must be a list of polygons")

        if len(seg) == 0:
            raise ValueError("segmentation cannot be empty")

        # Each polygon needs at least 3 points (6 coordinates)
        for i, poly in enumerate(seg):
            if not isinstance(poly, list):
                raise ValueError(f"Polygon {i} must be a list of coordinates")
            if len(poly) < 6:
                raise ValueError(f"Polygon {i} needs at least 3 points (6 coords)")

    def _map_annotation(self, ann: Dict, mapping: Dict[int, int]) -> Optional[Dict]:
        """Map server category ID to local. Returns None if unmapped."""
        server_cat = ann["category_id"]
        local_cat = mapping.get(server_cat)

        if local_cat is None:
            return None  # Silently skip unmapped categories

        return {
            "category_id": local_cat,
            "segmentation": ann["segmentation"],
            "bbox": ann["bbox"],
            "area": ann["area"],
        }

    async def close(self):
        """Close HTTP client."""
        if self.http_client is not None:
            await self.http_client.aclose()
            self.http_client = None


def load_auto_label_config(path: str) -> AutoLabelConfig:
    """Load and validate auto-label config from YAML file."""
    with open(path, "r") as f:
        data = yaml.safe_load(f)
    return AutoLabelConfig(**data)


# Lazy singleton
_auto_label_service: Optional[AutoLabelService] = None


def get_auto_label_service() -> Optional[AutoLabelService]:
    """Get or create auto-label service singleton. Returns None if not configured."""
    global _auto_label_service
    from .config import AUTO_LABEL_CONFIG_PATH

    if AUTO_LABEL_CONFIG_PATH is None:
        return None

    if _auto_label_service is None:
        config = load_auto_label_config(AUTO_LABEL_CONFIG_PATH)
        _auto_label_service = AutoLabelService(config)

    return _auto_label_service


def clear_auto_label_service() -> None:
    """Clear the singleton (for testing)."""
    global _auto_label_service
    _auto_label_service = None
