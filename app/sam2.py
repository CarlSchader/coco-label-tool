"""SAM2 model operations for image segmentation."""

import torch
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from typing import List


if not hasattr(torch.compiler, "is_compiling"):
    torch.compiler.is_compiling = lambda: False

from transformers import Sam2Model, Sam2Processor

from .config import SAM2_MODEL_ID, SAM2_DEVICE


class SAM2Service:
    """Handles SAM2 model operations."""

    def __init__(self, model_id: str = SAM2_MODEL_ID):
        print(f"Loading SAM2 model ({model_id})...")
        self.device = SAM2_DEVICE
        self.model_id = model_id
        self.model = Sam2Model.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam2Processor.from_pretrained(model_id)
        print(f"SAM2 model loaded on {self.device}")

    def reload_model(self, model_id: str) -> None:
        print(f"Reloading SAM2 model ({model_id})...")
        self.model_id = model_id
        self.model = Sam2Model.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam2Processor.from_pretrained(model_id)
        print(f"SAM2 model reloaded on {self.device}")

    def segment_image(
        self,
        image_path: Path,
        points: List[List[float]] | None = None,
        labels: List[int] | None = None,
        box: List[float] | None = None,
    ) -> List[List[float]]:
        print("=" * 80)
        print("🟢 SAM2 INFERENCE STARTING")
        print(f"📁 Image: {image_path}")
        print(
            f"📍 Points: {points} (labels: {labels})" if points else "📍 Points: None"
        )
        print(f"📦 Box: {box}" if box else "📦 Box: None")
        print("=" * 80)

        segmentation = []
        try:
            raw_image = Image.open(image_path).convert("RGB")

            processor_kwargs = {"images": raw_image, "return_tensors": "pt"}

            if points and len(points) > 0:
                processor_kwargs["input_points"] = [[points]]
                processor_kwargs["input_labels"] = [[labels]]
                print(f"✅ Added {len(points)} points to processor")

            if box:
                processor_kwargs["input_boxes"] = [[box]]
                print("✅ Added 1 box to processor")

            print("🔄 Running inference...")
            inputs = self.processor(**processor_kwargs).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs, multimask_output=False)

            masks = self.processor.post_process_masks(
                outputs.pred_masks.cpu(), inputs["original_sizes"]
            )[0]

            mask = masks[0][0].numpy()

            contours, _ = cv2.findContours(
                (mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            for contour in contours:
                if len(contour) >= 3:
                    points_list = contour.squeeze().tolist()
                    if isinstance(points_list[0], list):
                        flat_points = [
                            coord for point in points_list for coord in point
                        ]
                    else:
                        flat_points = points_list
                    segmentation.append(flat_points)

            print("✅ SAM2 INFERENCE COMPLETE")
            print(f"📊 Generated {len(segmentation)} contours")
            print("=" * 80)
        except Exception as e:
            print(f"❌ SAM2 INFERENCE FAILED: {e}")
            print("=" * 80)
        return segmentation


# Lazy initialization - service is created on first access
_sam2_service = None


def get_sam2_service() -> SAM2Service:
    """Get or create SAM2 service instance (lazy initialization)."""
    global _sam2_service
    if _sam2_service is None:
        _sam2_service = SAM2Service()
    return _sam2_service
