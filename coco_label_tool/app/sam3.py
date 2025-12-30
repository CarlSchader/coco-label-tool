"""SAM3 Tracker model operations for image segmentation."""

import torch
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from typing import List


if not hasattr(torch.compiler, "is_compiling"):
    torch.compiler.is_compiling = lambda: False

from transformers import Sam3TrackerModel, Sam3TrackerProcessor

from .config import SAM3_MODEL_ID, SAM3_DEVICE
from .sam3_utils import format_points_for_sam3


class SAM3TrackerService:
    """Handles SAM3 Tracker model operations."""

    def __init__(self, model_id: str = SAM3_MODEL_ID):
        print(f"Loading SAM3 Tracker model ({model_id})...")
        self.device = SAM3_DEVICE
        self.model_id = model_id
        self.model = Sam3TrackerModel.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam3TrackerProcessor.from_pretrained(model_id)
        print(f"SAM3 Tracker model loaded on {self.device}")

    def reload_model(self, model_id: str) -> None:
        print(f"Reloading SAM3 Tracker model ({model_id})...")
        self.model_id = model_id
        self.model = Sam3TrackerModel.from_pretrained(model_id)
        self.model = self.model.to(self.device)
        self.processor = Sam3TrackerProcessor.from_pretrained(model_id)
        print(f"SAM3 Tracker model reloaded on {self.device}")

    def segment_image(
        self,
        image_path: Path,
        points: List[List[float]] | None = None,
        labels: List[int] | None = None,
        box: List[float] | None = None,
        boxes: List[List[float]] | None = None,
        box_labels: List[int] | None = None,
    ) -> List[List[float]]:
        """Run SAM3 Tracker segmentation on an image.

        Args:
            image_path: Path to image file
            points: List of point coordinates [[x, y], ...]
            labels: List of point labels (1=positive, 0=negative)
            box: Single box [x1, y1, x2, y2] (backward compatible)
            boxes: Multiple boxes [[x1, y1, x2, y2], ...] (overrides single box)
            box_labels: Labels for multiple boxes (1=positive, 0=negative)
        """
        print("=" * 80)
        print("🔵 SAM3 TRACKER INFERENCE STARTING")
        print(f"📁 Image: {image_path}")
        print(
            f"📍 Points: {points} (labels: {labels})" if points else "📍 Points: None"
        )
        print(f"📦 Single box: {box}" if box else "📦 Single box: None")
        print(f"📦 Multiple boxes: {boxes}" if boxes else "📦 Multiple boxes: None")
        print(
            f"⚠️  Box labels: {box_labels} (IGNORED - SAM3 Tracker doesn't support)"
            if box_labels
            else ""
        )
        print("=" * 80)

        segmentation = []
        inputs = None
        outputs = None
        try:
            raw_image = Image.open(image_path).convert("RGB")

            processor_kwargs = {"images": raw_image, "return_tensors": "pt"}

            # Determine number of objects to segment
            num_objects = 0
            if boxes and len(boxes) > 0:
                num_objects = len(boxes)
            elif box:
                num_objects = 1
            elif points and len(points) > 0:
                num_objects = 1  # Points only = single object refinement

            # Handle multiple boxes (preferred) or single box (backward compatible)
            # NOTE: SAM3 Tracker multiple boxes = multiple objects to segment separately
            # Each box segments one object independently
            if boxes and len(boxes) > 0:
                # For multiple objects: wrap each box individually
                # Format: [[box1, box2]] for 2 objects (3 levels: image, boxes, coords)
                processor_kwargs["input_boxes"] = [boxes]
                print(f"✅ Added {len(boxes)} boxes as separate objects")

            elif box:
                # Single box mode (backward compatible)
                # Format: [[box]] for 1 object (3 levels: image, boxes, coords)
                processor_kwargs["input_boxes"] = [[box]]
                print("✅ Added 1 box")

            # Add points if present, formatted based on num_objects
            if points and len(points) > 0:
                formatted_points, formatted_labels = format_points_for_sam3(
                    points, labels, num_objects
                )
                if formatted_points is not None:
                    processor_kwargs["input_points"] = formatted_points
                    processor_kwargs["input_labels"] = formatted_labels
                    if num_objects == 1:
                        print(
                            f"✅ Added {len(points)} points for refinement (single object)"
                        )
                    else:
                        print(f"✅ Added points for {num_objects} objects")
                else:
                    print("⚠️  Points formatting returned None")

            # Debug: Show formatted inputs
            if "input_points" in processor_kwargs:
                print(f"🔍 Formatted points: {processor_kwargs['input_points']}")
            if "input_labels" in processor_kwargs:
                print(f"🔍 Formatted labels: {processor_kwargs['input_labels']}")
            if "input_boxes" in processor_kwargs:
                print(f"🔍 Formatted boxes: {processor_kwargs['input_boxes']}")

            print("🔄 Running inference...")
            inputs = self.processor(**processor_kwargs).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs, multimask_output=False)

            masks = self.processor.post_process_masks(
                outputs.pred_masks.cpu(), inputs["original_sizes"]
            )[0]

            print(f"🔍 Masks shape: {masks.shape}")
            print(f"🔍 Number of objects: {masks.shape[0]}")

            # Process each object's mask separately
            for obj_idx in range(masks.shape[0]):
                mask = masks[obj_idx][0].numpy()
                print(f"🔍 Processing object {obj_idx + 1}/{masks.shape[0]}")

                contours, _ = cv2.findContours(
                    (mask > 0).astype(np.uint8),
                    cv2.RETR_EXTERNAL,
                    cv2.CHAIN_APPROX_SIMPLE,
                )

                print(f"  📊 Found {len(contours)} contour(s) for object {obj_idx + 1}")

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

            print("✅ SAM3 TRACKER INFERENCE COMPLETE")
            print(f"📊 Generated {len(segmentation)} contours")
            print("=" * 80)
        except Exception as e:
            print(f"❌ SAM3 TRACKER INFERENCE FAILED: {e}")
            print("=" * 80)
        finally:
            # Clean up GPU tensors to free memory
            del inputs
            del outputs
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        return segmentation


# Lazy initialization - service is created on first access
_sam3_tracker_service = None


def is_sam3_tracker_loaded() -> bool:
    """Check if SAM3 Tracker service is currently loaded in memory."""
    return _sam3_tracker_service is not None


def get_sam3_tracker_current_model_id() -> str:
    """Get the current SAM3 Tracker model ID.

    Returns the model ID of the loaded service, or the default from config if not loaded.
    Does NOT trigger model loading.
    """
    if _sam3_tracker_service is not None:
        return _sam3_tracker_service.model_id
    return SAM3_MODEL_ID


def get_sam3_tracker_service() -> SAM3TrackerService:
    """Get or create SAM3 Tracker service instance (lazy initialization)."""
    global _sam3_tracker_service
    if _sam3_tracker_service is None:
        _sam3_tracker_service = SAM3TrackerService()
    return _sam3_tracker_service


def clear_sam3_tracker_service() -> None:
    """Clear SAM3 Tracker service from memory.

    Deletes the model and processor to free GPU memory.
    Safe to call even if service was never initialized.
    """
    import gc

    global _sam3_tracker_service
    if _sam3_tracker_service is not None:
        print("Clearing SAM3 Tracker service from memory...")
        service = _sam3_tracker_service
        _sam3_tracker_service = None  # Clear global reference first

        # Move model to CPU first to help release GPU memory
        try:
            service.model.to("cpu")
        except Exception:
            pass  # Ignore errors during cleanup

        # Delete model and processor attributes
        try:
            del service.model
            del service.processor
        except Exception:
            pass

        # Delete the service object itself
        del service

        # Multiple GC passes to catch circular references
        for _ in range(3):
            gc.collect()

        # Clear CUDA cache after GC
        if torch.cuda.is_available():
            torch.cuda.synchronize()  # Wait for all CUDA operations
            torch.cuda.empty_cache()
            # Reset peak memory stats
            torch.cuda.reset_peak_memory_stats()

        print("SAM3 Tracker service cleared")
