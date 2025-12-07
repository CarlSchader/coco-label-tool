"""Tests for S3 state management module."""

import threading
from unittest.mock import patch

# Patch config to avoid loading real dataset during tests
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from app.s3_state import S3State, s3_state


class TestS3StateInitialization:
    """Tests for S3State initialization."""

    def test_initial_state_is_clean(self):
        """Initial state is not dirty."""
        state = S3State()
        assert state.is_dirty is False

    def test_initial_local_path_is_none(self):
        """Initial local path is None."""
        state = S3State()
        assert state.local_json_path is None


class TestS3StateLocalPath:
    """Tests for local path management."""

    def test_set_local_path_stores_path(self):
        """set_local_path stores the path."""
        from pathlib import Path

        state = S3State()
        test_path = Path("/tmp/test.json")

        state.set_local_path(test_path)

        assert state.get_local_path() == test_path

    def test_set_local_path_marks_clean(self):
        """set_local_path marks state as clean."""
        from pathlib import Path

        state = S3State()
        state.is_dirty = True  # Make dirty first

        state.set_local_path(Path("/tmp/test.json"))

        assert state.is_dirty is False

    def test_get_local_path_returns_stored_path(self):
        """get_local_path returns the stored path."""
        from pathlib import Path

        state = S3State()
        test_path = Path("/data/dataset.json")

        state.set_local_path(test_path)
        result = state.get_local_path()

        assert result == test_path


class TestS3StateDirtyTracking:
    """Tests for dirty state tracking."""

    def test_mark_dirty_sets_flag(self):
        """mark_dirty sets the dirty flag."""
        state = S3State()
        assert state.is_dirty is False

        state.mark_dirty()

        assert state.is_dirty is True

    def test_mark_clean_clears_flag(self):
        """mark_clean clears the dirty flag."""
        state = S3State()
        state.mark_dirty()
        assert state.is_dirty is True

        state.mark_clean()

        assert state.is_dirty is False

    def test_get_dirty_status_returns_current_state(self):
        """get_dirty_status returns current dirty state."""
        state = S3State()

        assert state.get_dirty_status() is False

        state.mark_dirty()
        assert state.get_dirty_status() is True

        state.mark_clean()
        assert state.get_dirty_status() is False

    def test_multiple_dirty_clean_cycles(self):
        """Multiple dirty/clean cycles work correctly."""
        state = S3State()

        for _ in range(5):
            state.mark_dirty()
            assert state.is_dirty is True

            state.mark_clean()
            assert state.is_dirty is False


class TestS3StateThreadSafety:
    """Tests for thread safety."""

    def test_concurrent_mark_dirty_calls(self):
        """Concurrent mark_dirty calls don't corrupt state."""
        state = S3State()
        errors = []

        def mark_dirty_many_times():
            try:
                for _ in range(100):
                    state.mark_dirty()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=mark_dirty_many_times) for _ in range(10)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert state.is_dirty is True

    def test_concurrent_get_operations(self):
        """Concurrent get operations are safe."""
        from pathlib import Path

        state = S3State()
        state.set_local_path(Path("/tmp/test.json"))
        state.mark_dirty()

        results = []
        errors = []

        def get_many_times():
            try:
                for _ in range(100):
                    results.append(state.get_dirty_status())
                    results.append(state.get_local_path())
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=get_many_times) for _ in range(10)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        # All dirty status results should be True
        dirty_results = [r for r in results if isinstance(r, bool)]
        assert all(r is True for r in dirty_results)


class TestS3StateSingleton:
    """Tests for singleton instance."""

    def test_singleton_exists(self):
        """Module-level singleton s3_state exists."""
        assert s3_state is not None

    def test_singleton_is_s3_state_instance(self):
        """Singleton is an S3State instance."""
        assert isinstance(s3_state, S3State)
