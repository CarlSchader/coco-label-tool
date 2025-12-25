"""Tests for graceful shutdown functionality."""

import signal
from unittest.mock import MagicMock, patch

# Import the shutdown module directly (avoiding app/__init__.py which triggers config validation)
# We use patches to mock the dependent modules

# First set up environment and patches for importing
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            # Import the shutdown module (now at top-level of coco_label_tool package)
            from coco_label_tool import shutdown
            from coco_label_tool.app import sam2, sam3, sam3_pcs


class TestClearModelFromGPU:
    """Tests for clearing individual model services from GPU memory."""

    def test_clear_sam2_service_when_loaded(self):
        """Clearing SAM2 service should delete model and clear GPU cache."""
        # Create a mock service
        mock_model = MagicMock()
        mock_processor = MagicMock()
        mock_service = MagicMock()
        mock_service.model = mock_model
        mock_service.processor = mock_processor

        # Set the global service
        sam2._sam2_service = mock_service

        # Clear it
        sam2.clear_sam2_service()

        # Verify service is cleared
        assert sam2._sam2_service is None

    def test_clear_sam2_service_when_not_loaded(self):
        """Clearing SAM2 service when not loaded should be a no-op."""
        # Ensure service is not loaded
        sam2._sam2_service = None

        # Should not raise
        sam2.clear_sam2_service()

        # Still None
        assert sam2._sam2_service is None

    def test_clear_sam3_tracker_service_when_loaded(self):
        """Clearing SAM3 Tracker service should delete model and clear GPU cache."""
        # Create a mock service
        mock_service = MagicMock()
        sam3._sam3_tracker_service = mock_service

        # Clear it
        sam3.clear_sam3_tracker_service()

        # Verify service is cleared
        assert sam3._sam3_tracker_service is None

    def test_clear_sam3_tracker_service_when_not_loaded(self):
        """Clearing SAM3 Tracker service when not loaded should be a no-op."""
        sam3._sam3_tracker_service = None
        sam3.clear_sam3_tracker_service()
        assert sam3._sam3_tracker_service is None

    def test_clear_sam3_pcs_service_when_loaded(self):
        """Clearing SAM3 PCS service should delete model and clear GPU cache."""
        mock_service = MagicMock()
        sam3_pcs._sam3_pcs_service = mock_service

        sam3_pcs.clear_sam3_pcs_service()

        assert sam3_pcs._sam3_pcs_service is None

    def test_clear_sam3_pcs_service_when_not_loaded(self):
        """Clearing SAM3 PCS service when not loaded should be a no-op."""
        sam3_pcs._sam3_pcs_service = None
        sam3_pcs.clear_sam3_pcs_service()
        assert sam3_pcs._sam3_pcs_service is None


class TestClearAllModels:
    """Tests for clearing all models from GPU memory."""

    def test_clear_all_models_clears_all_services(self):
        """clear_all_models should clear SAM2, SAM3 Tracker, and SAM3 PCS."""
        # Set up mock services
        sam2._sam2_service = MagicMock()
        sam3._sam3_tracker_service = MagicMock()
        sam3_pcs._sam3_pcs_service = MagicMock()

        # Clear all
        shutdown.clear_all_models()

        # All should be None
        assert sam2._sam2_service is None
        assert sam3._sam3_tracker_service is None
        assert sam3_pcs._sam3_pcs_service is None

    def test_clear_all_models_when_none_loaded(self):
        """clear_all_models should work when no models are loaded."""
        # Ensure none are loaded
        sam2._sam2_service = None
        sam3._sam3_tracker_service = None
        sam3_pcs._sam3_pcs_service = None

        # Should not raise
        shutdown.clear_all_models()

        # Still None
        assert sam2._sam2_service is None
        assert sam3._sam3_tracker_service is None
        assert sam3_pcs._sam3_pcs_service is None

    @patch.object(shutdown, "torch")
    def test_clear_all_models_clears_cuda_cache(self, mock_torch):
        """clear_all_models should clear CUDA cache if available."""
        mock_torch.cuda.is_available.return_value = True

        shutdown.clear_all_models()

        mock_torch.cuda.empty_cache.assert_called_once()

    @patch.object(shutdown, "torch")
    def test_clear_all_models_skips_cuda_when_not_available(self, mock_torch):
        """clear_all_models should skip CUDA cache clear if not available."""
        mock_torch.cuda.is_available.return_value = False

        shutdown.clear_all_models()

        mock_torch.cuda.empty_cache.assert_not_called()


class TestKillProcessesOnPort:
    """Tests for killing processes on a specific port."""

    @patch.object(shutdown, "subprocess")
    @patch.object(shutdown, "sys")
    def test_kill_processes_on_port_linux(self, mock_sys, mock_subprocess):
        """On Linux, should use fuser to kill processes on port."""
        mock_sys.platform = "linux"
        mock_subprocess.run.return_value = MagicMock(returncode=0)

        shutdown.kill_processes_on_port(8000)

        # Should try fuser
        mock_subprocess.run.assert_called()
        call_args = mock_subprocess.run.call_args_list[0]
        assert "fuser" in call_args[0][0]

    @patch.object(shutdown, "subprocess")
    @patch.object(shutdown, "sys")
    def test_kill_processes_on_port_darwin(self, mock_sys, mock_subprocess):
        """On macOS, should use lsof to find and kill processes."""
        mock_sys.platform = "darwin"
        # First call returns PID, second call kills it
        mock_subprocess.run.side_effect = [
            MagicMock(returncode=0, stdout="12345\n"),
            MagicMock(returncode=0),
        ]

        shutdown.kill_processes_on_port(8000)

        # Should have been called (at least once for lsof)
        assert mock_subprocess.run.called

    def test_kill_processes_on_port_handles_no_processes(self):
        """Should handle case where no processes are on the port."""
        # Should not raise even if no processes found
        # Use a port that's unlikely to be in use
        shutdown.kill_processes_on_port(59999)


class TestGracefulShutdown:
    """Tests for the complete graceful shutdown process."""

    @patch.object(shutdown, "kill_processes_on_port")
    @patch.object(shutdown, "clear_all_models")
    def test_graceful_shutdown_clears_models_first(
        self, mock_clear_models, mock_kill_port
    ):
        """Graceful shutdown should clear models before killing port."""
        call_order = []
        mock_clear_models.side_effect = lambda: call_order.append("clear_models")
        mock_kill_port.side_effect = lambda p: call_order.append("kill_port")

        shutdown.graceful_shutdown(8000)

        assert call_order == ["clear_models", "kill_port"]

    @patch.object(shutdown, "kill_processes_on_port")
    @patch.object(shutdown, "clear_all_models")
    def test_graceful_shutdown_with_port(self, mock_clear_models, mock_kill_port):
        """Graceful shutdown should pass correct port to kill_processes_on_port."""
        shutdown.graceful_shutdown(9000)

        mock_clear_models.assert_called_once()
        mock_kill_port.assert_called_once_with(9000)

    @patch.object(shutdown, "kill_processes_on_port")
    @patch.object(shutdown, "clear_all_models")
    def test_graceful_shutdown_continues_on_model_clear_error(
        self, mock_clear_models, mock_kill_port
    ):
        """Graceful shutdown should continue even if model clearing fails."""
        mock_clear_models.side_effect = Exception("GPU error")

        # Should not raise
        shutdown.graceful_shutdown(8000)

        # Should still try to kill port
        mock_kill_port.assert_called_once_with(8000)


class TestSignalHandler:
    """Tests for SIGTERM signal handler setup."""

    def test_setup_signal_handlers_registers_sigterm(self):
        """setup_signal_handlers should register handler for SIGTERM."""
        original_handler = signal.getsignal(signal.SIGTERM)

        try:
            shutdown.setup_signal_handlers(8000)

            current_handler = signal.getsignal(signal.SIGTERM)
            # Handler should be registered (not the default)
            assert current_handler is not None
            assert callable(current_handler)
        finally:
            # Restore original handler
            signal.signal(signal.SIGTERM, original_handler)

    def test_setup_signal_handlers_registers_sigint(self):
        """setup_signal_handlers should register handler for SIGINT (Ctrl+C)."""
        original_handler = signal.getsignal(signal.SIGINT)

        try:
            shutdown.setup_signal_handlers(8000)

            current_handler = signal.getsignal(signal.SIGINT)
            assert current_handler is not None
            assert callable(current_handler)
        finally:
            signal.signal(signal.SIGINT, original_handler)

    @patch.object(shutdown, "graceful_shutdown")
    @patch.object(shutdown.sys, "exit")
    def test_signal_handler_calls_graceful_shutdown(
        self, mock_exit, mock_graceful_shutdown
    ):
        """Signal handler should call graceful_shutdown with correct port."""
        original_handler = signal.getsignal(signal.SIGTERM)

        try:
            shutdown.setup_signal_handlers(8000)

            # Get the registered handler and call it
            handler = signal.getsignal(signal.SIGTERM)
            handler(signal.SIGTERM, None)

            mock_graceful_shutdown.assert_called_once_with(8000)
            mock_exit.assert_called_once_with(0)
        finally:
            signal.signal(signal.SIGTERM, original_handler)
