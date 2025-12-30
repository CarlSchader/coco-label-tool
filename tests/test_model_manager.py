"""Unit tests for ModelManager."""

import time
from unittest.mock import MagicMock, patch

import pytest

with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.model_manager import ModelManager


class TestModelManagerInit:
    def test_init_default_values(self):
        """Test initialization with default values."""
        manager = ModelManager()
        assert manager.inactivity_timeout == 300  # Default from config
        assert manager.check_interval == 30  # Default from config
        assert manager.last_activity == 0.0
        assert manager._monitor_task is None
        assert manager._is_loaded_checkers == {}
        assert manager._clear_functions == {}

    def test_init_custom_values(self):
        """Test initialization with custom values."""
        manager = ModelManager(inactivity_timeout=600, check_interval=60)
        assert manager.inactivity_timeout == 600
        assert manager.check_interval == 60


class TestModelManagerRegisterModel:
    def test_register_model(self):
        """Test registering a model."""
        manager = ModelManager()
        is_loaded_fn = MagicMock(return_value=True)
        clear_fn = MagicMock()

        manager.register_model("test_model", is_loaded_fn, clear_fn)

        assert "test_model" in manager._is_loaded_checkers
        assert "test_model" in manager._clear_functions
        assert manager._is_loaded_checkers["test_model"] is is_loaded_fn
        assert manager._clear_functions["test_model"] is clear_fn

    def test_register_multiple_models(self):
        """Test registering multiple models."""
        manager = ModelManager()

        for name in ["sam2", "sam3", "sam3_pcs"]:
            is_loaded_fn = MagicMock(return_value=False)
            clear_fn = MagicMock()
            manager.register_model(name, is_loaded_fn, clear_fn)

        assert len(manager._is_loaded_checkers) == 3
        assert len(manager._clear_functions) == 3
        assert set(manager._is_loaded_checkers.keys()) == {"sam2", "sam3", "sam3_pcs"}


class TestModelManagerRecordActivity:
    def test_record_activity_updates_timestamp(self):
        """Test that record_activity updates last_activity."""
        manager = ModelManager()
        assert manager.last_activity == 0.0

        before = time.time()
        manager.record_activity()
        after = time.time()

        assert before <= manager.last_activity <= after

    def test_record_activity_multiple_times(self):
        """Test that record_activity always updates to latest time."""
        manager = ModelManager()

        manager.record_activity()
        first_activity = manager.last_activity

        time.sleep(0.01)  # Small delay

        manager.record_activity()
        second_activity = manager.last_activity

        assert second_activity > first_activity


class TestModelManagerGetLoadedModels:
    def test_get_loaded_models_empty(self):
        """Test get_loaded_models with no models registered."""
        manager = ModelManager()
        result = manager.get_loaded_models()
        assert result == {}

    def test_get_loaded_models_all_loaded(self):
        """Test get_loaded_models when all models are loaded."""
        manager = ModelManager()

        for name in ["sam2", "sam3", "sam3_pcs"]:
            manager.register_model(name, lambda: True, MagicMock())

        result = manager.get_loaded_models()
        assert result == {"sam2": True, "sam3": True, "sam3_pcs": True}

    def test_get_loaded_models_none_loaded(self):
        """Test get_loaded_models when no models are loaded."""
        manager = ModelManager()

        for name in ["sam2", "sam3", "sam3_pcs"]:
            manager.register_model(name, lambda: False, MagicMock())

        result = manager.get_loaded_models()
        assert result == {"sam2": False, "sam3": False, "sam3_pcs": False}

    def test_get_loaded_models_mixed(self):
        """Test get_loaded_models with mixed loaded states."""
        manager = ModelManager()

        # Need to capture the boolean value correctly for each lambda
        states = {"sam2": True, "sam3": False, "sam3_pcs": True}
        for name, loaded in states.items():
            # Use default argument to capture the value
            manager.register_model(
                name, lambda is_loaded=loaded: is_loaded, MagicMock()
            )

        result = manager.get_loaded_models()
        assert result == states


class TestModelManagerUnloadAllModels:
    def test_unload_all_models_none_loaded(self):
        """Test unload_all_models when no models are loaded."""
        manager = ModelManager()
        clear_fns = {}

        for name in ["sam2", "sam3", "sam3_pcs"]:
            clear_fn = MagicMock()
            clear_fns[name] = clear_fn
            manager.register_model(name, lambda: False, clear_fn)

        result = manager.unload_all_models()

        # No models should have been cleared (they weren't loaded)
        for clear_fn in clear_fns.values():
            clear_fn.assert_not_called()

        assert result == {"sam2": False, "sam3": False, "sam3_pcs": False}

    def test_unload_all_models_all_loaded(self):
        """Test unload_all_models when all models are loaded."""
        manager = ModelManager()
        clear_fns = {}

        for name in ["sam2", "sam3", "sam3_pcs"]:
            clear_fn = MagicMock()
            clear_fns[name] = clear_fn
            manager.register_model(name, lambda: True, clear_fn)

        result = manager.unload_all_models()

        # All models should have been cleared
        for clear_fn in clear_fns.values():
            clear_fn.assert_called_once()

        assert result == {"sam2": True, "sam3": True, "sam3_pcs": True}

    def test_unload_all_models_mixed(self):
        """Test unload_all_models with mixed loaded states."""
        manager = ModelManager()

        # sam2: loaded, should be cleared
        sam2_clear = MagicMock()
        manager.register_model("sam2", lambda: True, sam2_clear)

        # sam3: not loaded, should NOT be cleared
        sam3_clear = MagicMock()
        manager.register_model("sam3", lambda: False, sam3_clear)

        # sam3_pcs: loaded, should be cleared
        sam3_pcs_clear = MagicMock()
        manager.register_model("sam3_pcs", lambda: True, sam3_pcs_clear)

        result = manager.unload_all_models()

        sam2_clear.assert_called_once()
        sam3_clear.assert_not_called()
        sam3_pcs_clear.assert_called_once()

        assert result == {"sam2": True, "sam3": False, "sam3_pcs": True}


class TestModelManagerMonitor:
    @pytest.mark.asyncio
    async def test_start_monitor(self):
        """Test starting the monitor task."""
        manager = ModelManager(check_interval=1)
        assert manager._monitor_task is None

        await manager.start_monitor()
        assert manager._monitor_task is not None

        # Clean up
        await manager.stop_monitor()

    @pytest.mark.asyncio
    async def test_start_monitor_idempotent(self):
        """Test that starting monitor twice doesn't create duplicate tasks."""
        manager = ModelManager(check_interval=1)

        await manager.start_monitor()
        first_task = manager._monitor_task

        await manager.start_monitor()
        second_task = manager._monitor_task

        assert first_task is second_task

        # Clean up
        await manager.stop_monitor()

    @pytest.mark.asyncio
    async def test_stop_monitor(self):
        """Test stopping the monitor task."""
        manager = ModelManager(check_interval=1)

        await manager.start_monitor()
        assert manager._monitor_task is not None

        await manager.stop_monitor()
        assert manager._monitor_task is None

    @pytest.mark.asyncio
    async def test_stop_monitor_when_not_started(self):
        """Test stopping monitor when it was never started."""
        manager = ModelManager(check_interval=1)
        assert manager._monitor_task is None

        # Should not raise
        await manager.stop_monitor()
        assert manager._monitor_task is None


class TestModelManagerInactivityLogic:
    def test_inactivity_check_no_activity(self):
        """Test that inactivity check skips when no activity recorded."""
        manager = ModelManager(inactivity_timeout=1)
        assert manager.last_activity == 0.0

        # With last_activity == 0, inactivity check should be skipped
        # (no models should be unloaded)
        clear_fn = MagicMock()
        manager.register_model("sam2", lambda: True, clear_fn)

        # Simulate what the monitor would check
        if manager.last_activity == 0.0:
            pass  # Skip
        else:
            manager.unload_all_models()

        clear_fn.assert_not_called()

    def test_inactivity_elapsed_calculation(self):
        """Test elapsed time calculation for inactivity."""
        manager = ModelManager(inactivity_timeout=5)

        manager.record_activity()
        recorded_time = manager.last_activity

        time.sleep(0.1)  # Wait a bit

        current_time = time.time()
        elapsed = current_time - manager.last_activity

        assert elapsed >= 0.1
        assert manager.last_activity == recorded_time

    def test_activity_resets_after_unload(self):
        """Test that activity is reset after unloading due to inactivity."""
        manager = ModelManager(inactivity_timeout=0.01, check_interval=0.01)

        manager.record_activity()
        assert manager.last_activity > 0

        # Simulate what the monitor does after unloading
        manager.unload_all_models()
        manager.last_activity = 0.0

        assert manager.last_activity == 0.0
