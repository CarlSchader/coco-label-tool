"""SAM3 PCS (Promptable Concept Segmentation) model operations for image segmentation."""

import torch
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from typing import List

if not hasattr(torch.compiler, "is_compiling"):
    torch.compiler.is_compiling = lambda: False

from transformers import Sam3Model, Sam3Processor

from .config import SAM3_PCS_MODEL_ID, SAM3_PCS_DEVICE


class SAM3PCSService:
    """Handles SAM3 PCS (Promptable Concept Segmentation) operations.

    PCS finds ALL instances of a concept in an image using:
    - Text prompts (e.g., "laptop", "ear", "handle")
    - Visual prompts (boxes with positive/negative labels)
    - Combined prompts (text + negative boxes for refinement)

    This is different from SAM3 Tracker (PVS) which segments specific object instances.
    """

    def __init__(self, model_id: str = SAM3_PCS_MODEL_ID):
        print(f"Loading SAM3 PCS model ({model_id})...")
        self.device = SAM3_PCS_DEVICE
        self.model_id = model_id
        self.model = Sam3Model.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam3Processor.from_pretrained(model_id)
        print(f"SAM3 PCS model loaded on {self.device}")

    def reload_model(self, model_id: str) -> None:
        """Reload model with different size/variant."""
        print(f"Reloading SAM3 PCS model ({model_id})...")
        self.model_id = model_id
        self.model = Sam3Model.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam3Processor.from_pretrained(model_id)
        print(f"SAM3 PCS model reloaded on {self.device}")

    def segment_image(
        self,
        image_path: Path,
        text: str | None = None,
        boxes: List[List[float]] | None = None,
        box_labels: List[int] | None = None,
    ) -> List[List[float]]:
        """Run SAM3 PCS segmentation to find ALL instances of a concept.

        Args:
            image_path: Path to image file
            text: Text prompt describing concept (e.g., "laptop", "ear")
            boxes: Multiple boxes [[x1, y1, x2, y2], ...] for visual prompts
            box_labels: Labels for boxes (1=positive, 0=negative)

        Returns:
            List of polygon segmentations, one per detected instance

        Note:
            - At least one of text or boxes must be provided
            - Points are NOT supported in PCS mode
            - Returns multiple instances (unlike Tracker which returns one per prompt)
        """
        print("=" * 80)
        print("🟣 SAM3 PCS INFERENCE STARTING")
        print(f"📁 Image: {image_path}")
        print(f"💬 Text: '{text}'" if text else "💬 Text: None")
        print(f"📦 Boxes: {boxes}" if boxes else "📦 Boxes: None")
        print(f"🏷️  Box labels: {box_labels}" if box_labels else "🏷️  Box labels: None")
        print("=" * 80)

        segmentation = []
        try:
            raw_image = Image.open(image_path).convert("RGB")

            processor_kwargs = {"images": raw_image, "return_tensors": "pt"}

            # Add text prompt if provided
            if text:
                processor_kwargs["text"] = text
                print(f"✅ Added text prompt: '{text}'")

            # Add boxes with labels if provided
            if boxes and len(boxes) > 0:
                # PCS format: [[box1, box2, ...]] (single image with multiple boxes)
                processor_kwargs["input_boxes"] = [boxes]
                if box_labels:
                    processor_kwargs["input_boxes_labels"] = [box_labels]
                    positive_count = sum(1 for label in box_labels if label == 1)
                    negative_count = sum(1 for label in box_labels if label == 0)
                    print(
                        f"✅ Added {len(boxes)} boxes ({positive_count} positive, {negative_count} negative)"
                    )
                else:
                    print(f"✅ Added {len(boxes)} boxes (all positive)")

            # Validate inputs
            if not text and not boxes:
                raise ValueError("PCS requires either text or boxes prompt")

            print("🔄 Running inference...")
            inputs = self.processor(**processor_kwargs).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs)

            # Post-process to get instance segmentation
            results = self.processor.post_process_instance_segmentation(
                outputs,
                threshold=0.5,
                mask_threshold=0.5,
                target_sizes=inputs.get("original_sizes").tolist(),
            )[0]

            num_instances = len(results["masks"])
            print(f"🔍 Found {num_instances} instances")

            # Convert each instance mask to COCO polygon format
            for idx, mask in enumerate(results["masks"]):
                mask_np = mask.cpu().numpy().astype(np.uint8)

                # Find contours
                contours, _ = cv2.findContours(
                    mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )

                print(f"  📊 Instance {idx + 1}: {len(contours)} contour(s)")

                # Add each contour as a separate polygon
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

            print("✅ SAM3 PCS INFERENCE COMPLETE")
            print(
                f"📊 Generated {len(segmentation)} polygons from {num_instances} instances"
            )
            print("=" * 80)

        except Exception as e:
            print(f"❌ SAM3 PCS INFERENCE FAILED: {e}")
            print("=" * 80)
            raise

        return segmentation


# Lazy initialization - service is created on first access
_sam3_pcs_service = None


def get_sam3_pcs_service() -> SAM3PCSService:
    """Get or create SAM3 PCS service instance (lazy initialization)."""
    global _sam3_pcs_service
    if _sam3_pcs_service is None:
        _sam3_pcs_service = SAM3PCSService()
    return _sam3_pcs_service


def clear_sam3_pcs_service() -> None:
    """Clear SAM3 PCS service from memory.

    Deletes the model and processor to free GPU memory.
    Safe to call even if service was never initialized.
    """
    global _sam3_pcs_service
    if _sam3_pcs_service is not None:
        print("Clearing SAM3 PCS service from memory...")
        del _sam3_pcs_service.model
        del _sam3_pcs_service.processor
        _sam3_pcs_service = None
        print("SAM3 PCS service cleared")
