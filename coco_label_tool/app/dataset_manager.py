"""In-memory dataset manager with timer-based auto-save.

This module provides a DatasetManager class that keeps the COCO dataset
in memory and periodically saves changes to disk. This improves performance
for large datasets by avoiding disk I/O on every operation.
"""

import json
import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import DATASET_AUTO_SAVE_INTERVAL, DATASET_IS_S3
from .s3_state import s3_state

logger = logging.getLogger(__name__)


@dataclass
class ChangeTracker:
    """Tracks counts of changes since last save.

    Used to generate informative log messages when saving.
    """

    annotations_added: int = 0
    annotations_updated: int = 0
    annotations_deleted: int = 0
    categories_added: int = 0
    categories_updated: int = 0
    categories_deleted: int = 0
    images_deleted: int = 0

    def reset(self) -> None:
        """Reset all counters to zero."""
        self.annotations_added = 0
        self.annotations_updated = 0
        self.annotations_deleted = 0
        self.categories_added = 0
        self.categories_updated = 0
        self.categories_deleted = 0
        self.images_deleted = 0

    def has_changes(self) -> bool:
        """Check if any changes were tracked."""
        return any(
            [
                self.annotations_added,
                self.annotations_updated,
                self.annotations_deleted,
                self.categories_added,
                self.categories_updated,
                self.categories_deleted,
                self.images_deleted,
            ]
        )

    def summary(self) -> str:
        """Generate human-readable summary of changes."""
        parts = []
        if self.annotations_added:
            parts.append(f"{self.annotations_added} annotation(s) added")
        if self.annotations_updated:
            parts.append(f"{self.annotations_updated} annotation(s) updated")
        if self.annotations_deleted:
            parts.append(f"{self.annotations_deleted} annotation(s) deleted")
        if self.categories_added:
            parts.append(f"{self.categories_added} category(ies) added")
        if self.categories_updated:
            parts.append(f"{self.categories_updated} category(ies) updated")
        if self.categories_deleted:
            parts.append(f"{self.categories_deleted} category(ies) deleted")
        if self.images_deleted:
            parts.append(f"{self.images_deleted} image(s) deleted")
        return ", ".join(parts) if parts else "no changes"


@dataclass
class DatasetManager:
    """Manages COCO dataset in memory with timer-based auto-save.

    Thread-safe singleton that:
    - Loads dataset once at startup
    - Keeps all data in memory for fast mutations
    - Auto-saves to disk every DATASET_AUTO_SAVE_INTERVAL seconds when dirty
    - Timer only runs when dirty, stops after save
    - Tracks change counts for informative logging

    Usage:
        manager = DatasetManager()
        manager.load(Path("/path/to/dataset.json"))

        # All mutations are instant (memory only)
        manager.add_annotation({"id": 1, ...})

        # Disk write happens automatically via timer, or explicitly:
        manager.flush()  # Before S3 upload
        manager.shutdown()  # On app shutdown
    """

    _data: Optional[Dict[str, Any]] = None
    _local_path: Optional[Path] = None
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _save_timer: Optional[threading.Timer] = None
    _changes: ChangeTracker = field(default_factory=ChangeTracker)

    # =========================================================================
    # Lifecycle Methods
    # =========================================================================

    def load(self, path: Path) -> None:
        """Load dataset from disk into memory. Called once at startup.

        Args:
            path: Path to the COCO JSON file
        """
        with self._lock:
            self._local_path = path
            with open(path, "r") as f:
                self._data = json.load(f)
            self._changes.reset()
        logger.info(f"Dataset loaded into memory from {path}")

    def save(self) -> bool:
        """Save dataset to disk if there are changes.

        Returns:
            True if data was saved, False if no changes to save
        """
        with self._lock:
            if not self._changes.has_changes():
                return False
            if self._data is None or self._local_path is None:
                return False

            # Write to disk
            with open(self._local_path, "w") as f:
                json.dump(self._data, f, indent=2)

            # Log with change summary
            summary = self._changes.summary()
            logger.info(f"Auto-saved dataset to {self._local_path} ({summary})")

            # Reset change tracking
            self._changes.reset()

            # Mark S3 as dirty if applicable
            if DATASET_IS_S3:
                s3_state.mark_dirty()

            return True

    def flush(self) -> bool:
        """Force immediate save, cancel pending timer.

        Called before S3 upload to ensure all changes are persisted.

        Returns:
            True if data was saved, False if no changes to save
        """
        self._cancel_timer()
        return self.save()

    def shutdown(self) -> None:
        """Clean shutdown: cancel timer, save if dirty.

        Called on application shutdown to persist any pending changes.
        """
        self._cancel_timer()
        if self.save():
            logger.info("Dataset saved on shutdown")

    # =========================================================================
    # Timer Management
    # =========================================================================

    def _schedule_auto_save(self) -> None:
        """Schedule auto-save timer. Only starts if not already running."""
        # Check if timer is already running
        if self._save_timer is not None and self._save_timer.is_alive():
            return

        self._save_timer = threading.Timer(
            DATASET_AUTO_SAVE_INTERVAL, self._auto_save_callback
        )
        self._save_timer.daemon = True
        self._save_timer.start()
        logger.debug(f"Auto-save timer scheduled ({DATASET_AUTO_SAVE_INTERVAL}s)")

    def _auto_save_callback(self) -> None:
        """Timer callback: save to disk and clear timer reference."""
        self._save_timer = None  # Timer has fired, clear reference
        self.save()

    def _cancel_timer(self) -> None:
        """Cancel pending auto-save timer if running."""
        if self._save_timer is not None:
            self._save_timer.cancel()
            self._save_timer = None

    # =========================================================================
    # Data Access (Read)
    # =========================================================================

    @property
    def data(self) -> Dict[str, Any]:
        """Get raw dataset. Raises if not loaded."""
        if self._data is None:
            raise RuntimeError("Dataset not loaded. Call load() first.")
        return self._data

    def is_loaded(self) -> bool:
        """Check if dataset is loaded."""
        with self._lock:
            return self._data is not None

    def get_images(self) -> List[Dict]:
        """Get all images (returns a copy)."""
        with self._lock:
            return list(self.data.get("images", []))

    def get_image_by_id(self, image_id: int) -> Optional[Dict]:
        """Get image by ID, or None if not found."""
        with self._lock:
            for img in self.data.get("images", []):
                if img.get("id") == image_id:
                    return dict(img)
            return None

    def get_annotations(self) -> List[Dict]:
        """Get all annotations (returns a copy)."""
        with self._lock:
            return list(self.data.get("annotations", []))

    def get_categories(self) -> List[Dict]:
        """Get all categories (returns a copy)."""
        with self._lock:
            return list(self.data.get("categories", []))

    def get_info(self) -> Dict:
        """Get dataset info (returns a copy)."""
        with self._lock:
            return dict(self.data.get("info", {}))

    def get_licenses(self) -> List[Dict]:
        """Get dataset licenses (returns a copy)."""
        with self._lock:
            return list(self.data.get("licenses", []))

    def get_next_annotation_id(self) -> int:
        """Get next available annotation ID."""
        with self._lock:
            annotations = self.data.get("annotations", [])
            return max([a["id"] for a in annotations], default=0) + 1

    def get_next_category_id(self) -> int:
        """Get next available category ID."""
        with self._lock:
            categories = self.data.get("categories", [])
            return max([c["id"] for c in categories], default=0) + 1

    # =========================================================================
    # Mutations (Write) - Annotations
    # =========================================================================

    def add_annotation(self, annotation: Dict) -> None:
        """Add an annotation to the dataset.

        Args:
            annotation: Full annotation dict with id, image_id, category_id, etc.
        """
        with self._lock:
            self.data.setdefault("annotations", []).append(annotation)
            self._changes.annotations_added += 1
        self._schedule_auto_save()

    def update_annotation(self, annotation_id: int, updates: Dict) -> Optional[Dict]:
        """Update an annotation's fields.

        Args:
            annotation_id: ID of annotation to update
            updates: Dict of fields to update

        Returns:
            Updated annotation dict, or None if not found
        """
        with self._lock:
            for ann in self.data.get("annotations", []):
                if ann["id"] == annotation_id:
                    ann.update(updates)
                    self._changes.annotations_updated += 1
                    self._schedule_auto_save()
                    return ann
            return None

    def delete_annotation(self, annotation_id: int) -> bool:
        """Delete an annotation.

        Args:
            annotation_id: ID of annotation to delete

        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            annotations = self.data.get("annotations", [])
            original_len = len(annotations)
            self.data["annotations"] = [
                a for a in annotations if a["id"] != annotation_id
            ]
            if len(self.data["annotations"]) < original_len:
                self._changes.annotations_deleted += 1
                self._schedule_auto_save()
                return True
            return False

    # =========================================================================
    # Mutations (Write) - Categories
    # =========================================================================

    def add_category(self, category: Dict) -> None:
        """Add a category to the dataset.

        Args:
            category: Full category dict with id, name, supercategory
        """
        with self._lock:
            self.data.setdefault("categories", []).append(category)
            self._changes.categories_added += 1
        self._schedule_auto_save()

    def update_category(self, category_id: int, updates: Dict) -> Optional[Dict]:
        """Update a category's fields.

        Args:
            category_id: ID of category to update
            updates: Dict of fields to update

        Returns:
            Updated category dict, or None if not found
        """
        with self._lock:
            for cat in self.data.get("categories", []):
                if cat["id"] == category_id:
                    cat.update(updates)
                    self._changes.categories_updated += 1
                    self._schedule_auto_save()
                    return cat
            return None

    def delete_category(self, category_id: int) -> bool:
        """Delete a category.

        Args:
            category_id: ID of category to delete

        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            categories = self.data.get("categories", [])
            original_len = len(categories)
            self.data["categories"] = [c for c in categories if c["id"] != category_id]
            if len(self.data["categories"]) < original_len:
                self._changes.categories_deleted += 1
                self._schedule_auto_save()
                return True
            return False

    # =========================================================================
    # Mutations (Write) - Images
    # =========================================================================

    def delete_image(self, image_id: int) -> bool:
        """Delete an image and its associated annotations.

        Args:
            image_id: ID of image to delete

        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            images = self.data.get("images", [])
            original_len = len(images)
            self.data["images"] = [img for img in images if img["id"] != image_id]
            if len(self.data["images"]) < original_len:
                # Also delete associated annotations
                self.data["annotations"] = [
                    a
                    for a in self.data.get("annotations", [])
                    if a["image_id"] != image_id
                ]
                self._changes.images_deleted += 1
                self._schedule_auto_save()
                return True
            return False

    def set_images(self, images: List[Dict]) -> None:
        """Replace all images (used by save_dataset for bulk operations).

        Note: Does not track changes since this is a bulk operation.
        """
        with self._lock:
            self.data["images"] = images

    def set_annotations(self, annotations: List[Dict]) -> None:
        """Replace all annotations (used by save_dataset for bulk operations).

        Note: Does not track changes since this is a bulk operation.
        """
        with self._lock:
            self.data["annotations"] = annotations


# Singleton instance
dataset_manager = DatasetManager()
