"""S3 state management - avoids module-level mutable globals.

This module follows the same pattern as cache.py, using a class to
encapsulate state instead of module-level mutable variables.
"""

import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class S3State:
    """Manages S3 dataset state. Thread-safe singleton pattern.

    Attributes:
        local_json_path: Path to the local working copy (cache or original file)
        is_dirty: Whether there are unsaved local changes
    """

    # Path to the local working copy (cache file or original local file)
    local_json_path: Optional[Path] = None

    # Whether there are unsaved local changes (dirty flag)
    is_dirty: bool = False

    # Lock for thread-safe operations
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def set_local_path(self, path: Path) -> None:
        """Set the local JSON path after loading.

        Args:
            path: Path to the local JSON file

        Note:
            Also marks state as clean (no unsaved changes)
        """
        with self._lock:
            self.local_json_path = path
            self.is_dirty = False

    def mark_dirty(self) -> None:
        """Mark dataset as having unsaved changes."""
        with self._lock:
            self.is_dirty = True

    def mark_clean(self) -> None:
        """Mark dataset as saved (no unsaved changes)."""
        with self._lock:
            self.is_dirty = False

    def get_dirty_status(self) -> bool:
        """Get current dirty status (thread-safe).

        Returns:
            True if there are unsaved changes
        """
        with self._lock:
            return self.is_dirty

    def get_local_path(self) -> Optional[Path]:
        """Get current local path (thread-safe).

        Returns:
            Path to local JSON file or None if not loaded
        """
        with self._lock:
            return self.local_json_path


# Singleton instance - matches pattern used by ImageCache in cache.py
s3_state = S3State()
