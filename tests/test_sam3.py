"""Unit tests for SAM3TrackerService."""

from unittest.mock import patch, MagicMock
from pathlib import Path
import numpy as np

# Patch transformers classes BEFORE any imports of app.sam3
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            with patch(
                "transformers.models.sam3_tracker.modeling_sam3_tracker.Sam3TrackerModel"
            ):
                with patch(
                    "transformers.models.sam3_tracker.processing_sam3_tracker.Sam3TrackerProcessor"
                ):
                    from app.sam3 import SAM3TrackerService


class TestSAM3TrackerServiceInit:
    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    def test_init_default_model(self, mock_processor_cls, mock_model_cls):
        """Test initialization with default model."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM3TrackerService()

        assert service.device == "cpu"
        assert service.model_id == "facebook/sam3"
        mock_model_cls.from_pretrained.assert_called_once_with("facebook/sam3")
        mock_processor_cls.from_pretrained.assert_called_once_with("facebook/sam3")

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cuda")
    def test_init_custom_model(self, mock_processor_cls, mock_model_cls):
        """Test initialization with custom model_id."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM3TrackerService("facebook/sam3-custom")

        assert service.model_id == "facebook/sam3-custom"
        mock_model_cls.from_pretrained.assert_called_once_with("facebook/sam3-custom")

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cuda")
    def test_init_device_assignment(self, mock_processor_cls, mock_model_cls):
        """Test device assignment."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM3TrackerService()

        assert service.device == "cuda"
        mock_model.to.assert_called_once_with("cuda")


class TestSAM3TrackerServiceReloadModel:
    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    def test_reload_model(self, mock_processor_cls, mock_model_cls):
        """Test reloading with different model_id."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM3TrackerService()
        initial_calls = mock_model_cls.from_pretrained.call_count

        service.reload_model("facebook/sam3-new")

        assert service.model_id == "facebook/sam3-new"
        assert mock_model_cls.from_pretrained.call_count == initial_calls + 1

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    def test_reload_preserves_device(self, mock_processor_cls, mock_model_cls):
        """Test device persistence after reload."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM3TrackerService()
        original_device = service.device

        service.reload_model("facebook/sam3-new")

        assert service.device == original_device


class TestSAM3TrackerServiceSegmentImage:
    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_points_only(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with points only."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[10, 10]]],
            "input_labels": [[1]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1]
        )

        assert isinstance(result, list)
        mock_image.open.assert_called_once()

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_box_only(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with box only."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_boxes": [[10, 10, 20, 20]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(Path("/tmp/test.jpg"), box=[10, 10, 20, 20])

        assert isinstance(result, list)

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_points_and_box(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with points + box."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[10, 10]]],
            "input_labels": [[1]],
            "input_boxes": [[5, 5, 25, 25]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1], box=[5, 5, 25, 25]
        )

        assert isinstance(result, list)

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    def test_segment_exception_handling(
        self, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test exception handling returns empty list."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        mock_image.open.side_effect = Exception("File not found")

        service = SAM3TrackerService()
        result = service.segment_image(Path("/tmp/test.jpg"))

        assert result == []

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_filters_small_contours(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test contours with < 3 points are filtered."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[10, 10]]],
            "input_labels": [[1]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = ([np.array([[10, 10], [20, 10]])], None)

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1]
        )

        assert len(result) == 0

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_multimask_output(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test multimask_output=False is used."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[10, 10]]],
            "input_labels": [[1]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        service.segment_image(Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1])

        mock_model.assert_called_once()
        call_kwargs = mock_model.call_args[1]
        assert call_kwargs.get("multimask_output") is False

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_handles_negative_points(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with negative point labels."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[10, 10], [15, 15]]],
            "input_labels": [[1, 0]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10], [15, 15]], labels=[1, 0]
        )

        assert isinstance(result, list)

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_multiple_boxes(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with multiple boxes."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_boxes": [[[10, 10, 20, 20], [30, 30, 40, 40]]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"),
            boxes=[[10, 10, 20, 20], [30, 30, 40, 40]],
        )

        assert isinstance(result, list)
        # Verify processor was called with boxes array
        call_kwargs = mock_processor.call_args[1]
        assert "input_boxes" in call_kwargs
        assert call_kwargs["input_boxes"] == [[[10, 10, 20, 20], [30, 30, 40, 40]]]

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_multiple_boxes_and_labels(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with multiple boxes and labels.

        NOTE: SAM3 Tracker IGNORES box_labels - all boxes are treated as positive.
        This test verifies that box_labels are accepted but not passed to processor.
        """
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_boxes": [[[10, 10, 20, 20], [30, 30, 40, 40]]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        # Mock returns 2 masks (one per box)
        mask1 = MagicMock()
        mask1.shape = (100, 100)
        mask1.numpy.return_value = np.ones((100, 100))
        mask2 = MagicMock()
        mask2.shape = (100, 100)
        mask2.numpy.return_value = np.ones((100, 100))

        masks_tensor = MagicMock()
        masks_tensor.shape = (2, 1, 100, 100)  # 2 objects, 1 mask each, 100x100
        masks_tensor.__getitem__ = lambda self, idx: MagicMock(
            numpy=lambda: np.ones((100, 100))
        )

        mock_processor.post_process_masks.return_value = [masks_tensor]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"),
            boxes=[[10, 10, 20, 20], [30, 30, 40, 40]],
            box_labels=[1, 0],  # Accepted but IGNORED by SAM3 Tracker
        )

        assert isinstance(result, list)
        # Verify processor was called with boxes but NOT labels
        # (SAM3 Tracker doesn't support box labels)
        call_kwargs = mock_processor.call_args[1]
        assert "input_boxes" in call_kwargs
        assert "input_boxes_labels" not in call_kwargs  # Labels are ignored
        assert call_kwargs["input_boxes"] == [[[10, 10, 20, 20], [30, 30, 40, 40]]]

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_boxes_array_overrides_single_box(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test that boxes array takes precedence over single box parameter."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_boxes": [[[10, 10, 20, 20]]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [
            [[MagicMock(numpy=lambda: np.ones((100, 100)))]]
        ]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"),
            box=[50, 50, 60, 60],  # This should be ignored
            boxes=[[10, 10, 20, 20]],  # This should be used
        )

        assert isinstance(result, list)
        # Verify boxes array was used, not single box
        call_kwargs = mock_processor.call_args[1]
        assert call_kwargs["input_boxes"] == [[[10, 10, 20, 20]]]

    @patch("app.sam3.Sam3TrackerModel")
    @patch("app.sam3.Sam3TrackerProcessor")
    @patch("app.sam3.SAM3_DEVICE", "cpu")
    @patch("app.sam3.SAM3_MODEL_ID", "facebook/sam3")
    @patch("app.sam3.Image")
    @patch("app.sam3.cv2")
    @patch("app.sam3.torch")
    def test_segment_with_points_and_multiple_boxes(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test combined prompts: points + multiple boxes.

        NOTE: Number of points must match number of boxes (one point set per box).
        """
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {
            "original_sizes": [[100, 100]],
            "input_points": [[[5, 5]], [[35, 35]]],  # 2 point sets for 2 boxes
            "input_labels": [[1], [1]],  # 2 label sets for 2 boxes
            "input_boxes": [[[10, 10, 20, 20], [30, 30, 40, 40]]],
        }

        mock_outputs = MagicMock()
        mock_outputs.pred_masks = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        # Mock returns 2 masks (one per box)
        masks_tensor = MagicMock()
        masks_tensor.shape = (2, 1, 100, 100)  # 2 objects, 1 mask each, 100x100
        masks_tensor.__getitem__ = lambda self, idx: MagicMock(
            numpy=lambda: np.ones((100, 100))
        )

        mock_processor.post_process_masks.return_value = [masks_tensor]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM3TrackerService()
        result = service.segment_image(
            Path("/tmp/test.jpg"),
            points=[[5, 5], [35, 35]],  # 2 points for 2 boxes
            labels=[1, 1],  # 2 labels for 2 points
            boxes=[[10, 10, 20, 20], [30, 30, 40, 40]],  # 2 boxes
            box_labels=[1, 0],  # Accepted but IGNORED
        )

        assert isinstance(result, list)
        # Verify both points and boxes were passed
        call_kwargs = mock_processor.call_args[1]
        assert "input_points" in call_kwargs
        assert "input_labels" in call_kwargs
        assert "input_boxes" in call_kwargs
        # box_labels are NOT passed (SAM3 Tracker doesn't support them)
        assert "input_boxes_labels" not in call_kwargs
