"""Unit tests for SAM2Service."""

from unittest.mock import patch, MagicMock
from pathlib import Path
import numpy as np

with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            with patch("coco_label_tool.app.sam2.Sam2Model"):
                with patch("coco_label_tool.app.sam2.Sam2Processor"):
                    from coco_label_tool.app.sam2 import SAM2Service


class TestSAM2ServiceInit:
    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    def test_init_default_model(self, mock_processor_cls, mock_model_cls):
        """Test initialization with default model."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM2Service()

        assert service.device == "cpu"
        assert service.model_id == "facebook/sam2-hiera-tiny"
        mock_model_cls.from_pretrained.assert_called_once_with(
            "facebook/sam2-hiera-tiny"
        )
        mock_processor_cls.from_pretrained.assert_called_once_with(
            "facebook/sam2-hiera-tiny"
        )

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cuda")
    def test_init_custom_model(self, mock_processor_cls, mock_model_cls):
        """Test initialization with custom model_id."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM2Service("facebook/sam2-hiera-large")

        assert service.model_id == "facebook/sam2-hiera-large"
        mock_model_cls.from_pretrained.assert_called_once_with(
            "facebook/sam2-hiera-large"
        )

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cuda")
    def test_init_device_assignment(self, mock_processor_cls, mock_model_cls):
        """Test device assignment."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM2Service()

        assert service.device == "cuda"
        mock_model.to.assert_called_once_with("cuda")


class TestSAM2ServiceReloadModel:
    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    def test_reload_model(self, mock_processor_cls, mock_model_cls):
        """Test reloading with different model_id."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM2Service()
        initial_calls = mock_model_cls.from_pretrained.call_count

        service.reload_model("facebook/sam2-hiera-large")

        assert service.model_id == "facebook/sam2-hiera-large"
        assert mock_model_cls.from_pretrained.call_count == initial_calls + 1

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    def test_reload_preserves_device(self, mock_processor_cls, mock_model_cls):
        """Test device persistence after reload."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        service = SAM2Service()
        original_device = service.device

        service.reload_model("facebook/sam2-hiera-large")

        assert service.device == original_device


class TestSAM2ServiceSegmentImage:
    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    @patch("coco_label_tool.app.sam2.Image")
    @patch("coco_label_tool.app.sam2.cv2")
    @patch("coco_label_tool.app.sam2.torch")
    def test_segment_with_points_only(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with points only."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {"original_sizes": [[100, 100]]}

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [[[[np.ones((100, 100))]]]]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM2Service()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1]
        )

        assert isinstance(result, list)
        mock_image.open.assert_called_once()

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    @patch("coco_label_tool.app.sam2.Image")
    @patch("coco_label_tool.app.sam2.cv2")
    @patch("coco_label_tool.app.sam2.torch")
    def test_segment_with_box_only(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with box only."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {"original_sizes": [[100, 100]]}

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [[[[np.ones((100, 100))]]]]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM2Service()
        result = service.segment_image(Path("/tmp/test.jpg"), box=[10, 10, 20, 20])

        assert isinstance(result, list)

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    @patch("coco_label_tool.app.sam2.Image")
    @patch("coco_label_tool.app.sam2.cv2")
    @patch("coco_label_tool.app.sam2.torch")
    def test_segment_with_points_and_box(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test segmentation with points + box."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {"original_sizes": [[100, 100]]}

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [[[[np.ones((100, 100))]]]]
        mock_cv2.findContours.return_value = (
            [np.array([[10, 10], [20, 10], [20, 20], [10, 20]])],
            None,
        )

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM2Service()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1], box=[5, 5, 25, 25]
        )

        assert isinstance(result, list)

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    @patch("coco_label_tool.app.sam2.Image")
    def test_segment_exception_handling(
        self, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test exception handling returns empty list."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model
        mock_processor_cls.from_pretrained.return_value = MagicMock()

        mock_image.open.side_effect = Exception("File not found")

        service = SAM2Service()
        result = service.segment_image(Path("/tmp/test.jpg"))

        assert result == []

    @patch("coco_label_tool.app.sam2.Sam2Model")
    @patch("coco_label_tool.app.sam2.Sam2Processor")
    @patch("coco_label_tool.app.sam2.SAM2_DEVICE", "cpu")
    @patch("coco_label_tool.app.sam2.SAM2_MODEL_ID", "facebook/sam2-hiera-tiny")
    @patch("coco_label_tool.app.sam2.Image")
    @patch("coco_label_tool.app.sam2.cv2")
    @patch("coco_label_tool.app.sam2.torch")
    def test_segment_filters_small_contours(
        self, mock_torch, mock_cv2, mock_image, mock_processor_cls, mock_model_cls
    ):
        """Test contours with < 3 points are filtered."""
        mock_model = MagicMock()
        mock_model.to.return_value = mock_model
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_processor = MagicMock()
        mock_processor_cls.from_pretrained.return_value = mock_processor
        mock_processor.return_value.to.return_value = {"original_sizes": [[100, 100]]}

        mock_outputs = MagicMock()
        mock_outputs.pred_masks.cpu.return_value = MagicMock()
        mock_model.return_value = mock_outputs

        mock_processor.post_process_masks.return_value = [[[[np.ones((100, 100))]]]]
        mock_cv2.findContours.return_value = ([np.array([[10, 10], [20, 10]])], None)

        mock_pil_image = MagicMock()
        mock_image.open.return_value.convert.return_value = mock_pil_image
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()

        service = SAM2Service()
        result = service.segment_image(
            Path("/tmp/test.jpg"), points=[[10, 10]], labels=[1]
        )

        assert len(result) == 0
