"""Unit tests for DatasetManager with timer-based auto-save."""

import json
import threading
import time
from unittest.mock import patch

import pytest

# Mock environment and path before importing
with patch.dict("os.environ", {"DATASET_PATH": "/tmp/test-dataset/dataset.json"}):
    with patch("pathlib.Path.exists", return_value=True):
        with patch("pathlib.Path.is_file", return_value=True):
            from coco_label_tool.app.dataset_manager import (
                ChangeTracker,
                DatasetManager,
            )


MOCK_DATASET = {
    "info": {"description": "Test dataset"},
    "licenses": [],
    "images": [
        {"id": 1, "file_name": "image1.jpg", "width": 640, "height": 480},
        {"id": 2, "file_name": "image2.jpg", "width": 800, "height": 600},
    ],
    "annotations": [
        {
            "id": 1,
            "image_id": 1,
            "category_id": 1,
            "segmentation": [[10, 10, 20, 20, 30, 10]],
            "bbox": [10, 10, 20, 10],
            "area": 100,
            "iscrowd": 0,
        },
        {
            "id": 2,
            "image_id": 1,
            "category_id": 2,
            "segmentation": [[50, 50, 60, 60, 70, 50]],
            "bbox": [50, 50, 20, 10],
            "area": 100,
            "iscrowd": 0,
        },
    ],
    "categories": [
        {"id": 1, "name": "dog", "supercategory": "animal"},
        {"id": 2, "name": "cat", "supercategory": "animal"},
    ],
}


@pytest.fixture
def manager():
    """Create a fresh DatasetManager instance for each test."""
    return DatasetManager()


@pytest.fixture
def loaded_manager(manager, tmp_path):
    """Create a DatasetManager loaded with mock data."""
    json_path = tmp_path / "dataset.json"
    json_path.write_text(json.dumps(MOCK_DATASET))
    manager.load(json_path)
    return manager


# =============================================================================
# ChangeTracker Tests
# =============================================================================


class TestChangeTracker:
    def test_initial_state(self):
        """Test ChangeTracker starts with all zeros."""
        tracker = ChangeTracker()
        assert tracker.annotations_added == 0
        assert tracker.annotations_updated == 0
        assert tracker.annotations_deleted == 0
        assert tracker.categories_added == 0
        assert tracker.categories_updated == 0
        assert tracker.categories_deleted == 0
        assert tracker.images_deleted == 0

    def test_has_changes_false_initially(self):
        """Test has_changes returns False when no changes."""
        tracker = ChangeTracker()
        assert tracker.has_changes() is False

    def test_has_changes_true_after_annotation_added(self):
        """Test has_changes returns True after incrementing a counter."""
        tracker = ChangeTracker()
        tracker.annotations_added = 1
        assert tracker.has_changes() is True

    def test_has_changes_true_after_category_deleted(self):
        """Test has_changes returns True for category changes."""
        tracker = ChangeTracker()
        tracker.categories_deleted = 1
        assert tracker.has_changes() is True

    def test_reset_clears_all_counters(self):
        """Test reset sets all counters to zero."""
        tracker = ChangeTracker()
        tracker.annotations_added = 5
        tracker.annotations_deleted = 3
        tracker.categories_updated = 2
        tracker.images_deleted = 1

        tracker.reset()

        assert tracker.annotations_added == 0
        assert tracker.annotations_deleted == 0
        assert tracker.categories_updated == 0
        assert tracker.images_deleted == 0
        assert tracker.has_changes() is False

    def test_summary_no_changes(self):
        """Test summary returns 'no changes' when empty."""
        tracker = ChangeTracker()
        assert tracker.summary() == "no changes"

    def test_summary_single_change(self):
        """Test summary with single change type."""
        tracker = ChangeTracker()
        tracker.annotations_added = 3
        assert tracker.summary() == "3 annotation(s) added"

    def test_summary_multiple_changes(self):
        """Test summary with multiple change types."""
        tracker = ChangeTracker()
        tracker.annotations_added = 2
        tracker.categories_deleted = 1

        summary = tracker.summary()
        assert "2 annotation(s) added" in summary
        assert "1 category(ies) deleted" in summary

    def test_summary_all_change_types(self):
        """Test summary includes all change types when present."""
        tracker = ChangeTracker()
        tracker.annotations_added = 1
        tracker.annotations_updated = 2
        tracker.annotations_deleted = 3
        tracker.categories_added = 4
        tracker.categories_updated = 5
        tracker.categories_deleted = 6
        tracker.images_deleted = 7

        summary = tracker.summary()
        assert "1 annotation(s) added" in summary
        assert "2 annotation(s) updated" in summary
        assert "3 annotation(s) deleted" in summary
        assert "4 category(ies) added" in summary
        assert "5 category(ies) updated" in summary
        assert "6 category(ies) deleted" in summary
        assert "7 image(s) deleted" in summary


# =============================================================================
# DatasetManager Lifecycle Tests
# =============================================================================


class TestDatasetManagerLifecycle:
    def test_is_loaded_false_initially(self, manager):
        """Test is_loaded returns False before load."""
        assert manager.is_loaded() is False

    def test_load_reads_file_into_memory(self, manager, tmp_path):
        """Test load reads JSON file into memory."""
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(MOCK_DATASET))

        manager.load(json_path)

        assert manager.is_loaded() is True
        assert manager._data is not None
        assert manager._data["info"]["description"] == "Test dataset"

    def test_load_resets_change_tracker(self, manager, tmp_path):
        """Test load resets the change tracker."""
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(MOCK_DATASET))

        # Simulate some prior changes
        manager._changes.annotations_added = 5

        manager.load(json_path)

        assert manager._changes.has_changes() is False

    def test_load_sets_local_path(self, manager, tmp_path):
        """Test load stores the file path."""
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(MOCK_DATASET))

        manager.load(json_path)

        assert manager._local_path == json_path

    def test_save_writes_to_disk_when_dirty(self, loaded_manager, tmp_path):
        """Test save writes data to disk when there are changes."""
        # Make a change
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        # Save
        result = loaded_manager.save()

        assert result is True
        # Verify file was written
        json_path = tmp_path / "dataset.json"
        saved_data = json.loads(json_path.read_text())
        assert any(a["id"] == 99 for a in saved_data["annotations"])

    def test_save_returns_false_when_clean(self, loaded_manager):
        """Test save returns False when no changes to save."""
        result = loaded_manager.save()
        assert result is False

    def test_save_resets_change_tracker(self, loaded_manager):
        """Test save resets change counters after saving."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        assert loaded_manager._changes.has_changes() is True

        loaded_manager.save()

        assert loaded_manager._changes.has_changes() is False

    def test_save_logs_summary(self, loaded_manager, caplog):
        """Test save logs a summary of changes."""
        import logging

        caplog.set_level(logging.INFO)

        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        loaded_manager.add_annotation({"id": 100, "image_id": 1, "category_id": 1})
        loaded_manager.save()

        assert "2 annotation(s) added" in caplog.text

    def test_flush_saves_and_cancels_timer(self, loaded_manager):
        """Test flush saves immediately and cancels pending timer."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        # Timer should be scheduled
        assert loaded_manager._save_timer is not None

        result = loaded_manager.flush()

        assert result is True
        assert loaded_manager._save_timer is None
        assert loaded_manager._changes.has_changes() is False

    def test_flush_returns_false_when_clean(self, loaded_manager):
        """Test flush returns False when nothing to save."""
        result = loaded_manager.flush()
        assert result is False

    def test_shutdown_saves_if_dirty(self, loaded_manager, tmp_path):
        """Test shutdown saves pending changes."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        loaded_manager.shutdown()

        # Verify saved
        json_path = tmp_path / "dataset.json"
        saved_data = json.loads(json_path.read_text())
        assert any(a["id"] == 99 for a in saved_data["annotations"])

    def test_shutdown_cancels_timer(self, loaded_manager):
        """Test shutdown cancels the auto-save timer."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        assert loaded_manager._save_timer is not None

        loaded_manager.shutdown()

        assert loaded_manager._save_timer is None

    def test_data_property_raises_if_not_loaded(self, manager):
        """Test accessing data before load raises RuntimeError."""
        with pytest.raises(RuntimeError, match="Dataset not loaded"):
            _ = manager.data


# =============================================================================
# Timer Tests
# =============================================================================


class TestDatasetManagerTimer:
    def test_timer_schedules_on_first_mutation(self, loaded_manager):
        """Test timer is scheduled after first mutation."""
        assert loaded_manager._save_timer is None

        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        assert loaded_manager._save_timer is not None
        assert loaded_manager._save_timer.is_alive()

        # Cleanup
        loaded_manager._cancel_timer()

    def test_timer_does_not_double_schedule(self, loaded_manager):
        """Test multiple mutations don't create multiple timers."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        first_timer = loaded_manager._save_timer

        loaded_manager.add_annotation({"id": 100, "image_id": 1, "category_id": 1})
        second_timer = loaded_manager._save_timer

        # Same timer instance
        assert first_timer is second_timer

        # Cleanup
        loaded_manager._cancel_timer()

    def test_timer_fires_and_saves(self, tmp_path):
        """Test timer callback saves data."""
        # Use a short interval for testing
        with patch(
            "coco_label_tool.app.dataset_manager.DATASET_AUTO_SAVE_INTERVAL", 0.1
        ):
            manager = DatasetManager()
            json_path = tmp_path / "dataset.json"
            json_path.write_text(json.dumps(MOCK_DATASET))
            manager.load(json_path)

            manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

            # Wait for timer to fire
            time.sleep(0.2)

            # Verify saved
            saved_data = json.loads(json_path.read_text())
            assert any(a["id"] == 99 for a in saved_data["annotations"])

            # Timer should be cleared after firing
            assert manager._save_timer is None

    def test_timer_stops_after_save(self, loaded_manager):
        """Test timer is cleared after save completes."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        assert loaded_manager._save_timer is not None

        # Manually save (simulating timer callback)
        loaded_manager.save()

        # Timer reference should still exist but we cleared changes
        # The actual timer clearing happens in the callback
        assert loaded_manager._changes.has_changes() is False

    def test_cancel_timer_stops_pending_save(self, loaded_manager):
        """Test _cancel_timer stops a pending timer."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
        timer = loaded_manager._save_timer
        assert timer is not None

        loaded_manager._cancel_timer()

        assert loaded_manager._save_timer is None
        # Original timer should be cancelled (not alive after a moment)
        time.sleep(0.05)
        assert not timer.is_alive()


# =============================================================================
# Read Operation Tests
# =============================================================================


class TestDatasetManagerRead:
    def test_get_images(self, loaded_manager):
        """Test get_images returns all images."""
        images = loaded_manager.get_images()
        assert len(images) == 2
        assert images[0]["id"] == 1
        assert images[1]["id"] == 2

    def test_get_images_returns_copy(self, loaded_manager):
        """Test get_images returns a copy, not the original."""
        images = loaded_manager.get_images()
        images.append({"id": 99})

        # Original should be unchanged
        assert len(loaded_manager.get_images()) == 2

    def test_get_annotations(self, loaded_manager):
        """Test get_annotations returns all annotations."""
        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 2
        assert annotations[0]["id"] == 1
        assert annotations[1]["id"] == 2

    def test_get_categories(self, loaded_manager):
        """Test get_categories returns all categories."""
        categories = loaded_manager.get_categories()
        assert len(categories) == 2
        assert categories[0]["name"] == "dog"
        assert categories[1]["name"] == "cat"

    def test_get_info(self, loaded_manager):
        """Test get_info returns dataset info."""
        info = loaded_manager.get_info()
        assert info["description"] == "Test dataset"

    def test_get_licenses(self, loaded_manager):
        """Test get_licenses returns licenses list."""
        licenses = loaded_manager.get_licenses()
        assert licenses == []

    def test_get_next_annotation_id(self, loaded_manager):
        """Test get_next_annotation_id returns max + 1."""
        next_id = loaded_manager.get_next_annotation_id()
        assert next_id == 3  # Max is 2, so next is 3

    def test_get_next_annotation_id_empty(self, manager, tmp_path):
        """Test get_next_annotation_id returns 1 when no annotations."""
        empty_dataset = {**MOCK_DATASET, "annotations": []}
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(empty_dataset))
        manager.load(json_path)

        next_id = manager.get_next_annotation_id()
        assert next_id == 1

    def test_get_next_category_id(self, loaded_manager):
        """Test get_next_category_id returns max + 1."""
        next_id = loaded_manager.get_next_category_id()
        assert next_id == 3  # Max is 2, so next is 3

    def test_get_next_category_id_empty(self, manager, tmp_path):
        """Test get_next_category_id returns 1 when no categories."""
        empty_dataset = {**MOCK_DATASET, "categories": []}
        json_path = tmp_path / "dataset.json"
        json_path.write_text(json.dumps(empty_dataset))
        manager.load(json_path)

        next_id = manager.get_next_category_id()
        assert next_id == 1


# =============================================================================
# Annotation Mutation Tests
# =============================================================================


class TestDatasetManagerAnnotations:
    def test_add_annotation_updates_memory(self, loaded_manager):
        """Test add_annotation adds to in-memory data."""
        new_ann = {"id": 99, "image_id": 1, "category_id": 1}
        loaded_manager.add_annotation(new_ann)

        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 3
        assert any(a["id"] == 99 for a in annotations)

        # Cleanup
        loaded_manager._cancel_timer()

    def test_add_annotation_increments_counter(self, loaded_manager):
        """Test add_annotation increments the change counter."""
        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        assert loaded_manager._changes.annotations_added == 1

        loaded_manager.add_annotation({"id": 100, "image_id": 1, "category_id": 1})

        assert loaded_manager._changes.annotations_added == 2

        # Cleanup
        loaded_manager._cancel_timer()

    def test_add_annotation_schedules_timer(self, loaded_manager):
        """Test add_annotation schedules the auto-save timer."""
        assert loaded_manager._save_timer is None

        loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})

        assert loaded_manager._save_timer is not None

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_annotation_modifies_in_place(self, loaded_manager):
        """Test update_annotation modifies existing annotation."""
        result = loaded_manager.update_annotation(1, {"category_id": 2})

        assert result is not None
        assert result["category_id"] == 2

        # Verify in data
        annotations = loaded_manager.get_annotations()
        ann = next(a for a in annotations if a["id"] == 1)
        assert ann["category_id"] == 2

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_annotation_increments_counter(self, loaded_manager):
        """Test update_annotation increments the change counter."""
        loaded_manager.update_annotation(1, {"category_id": 2})

        assert loaded_manager._changes.annotations_updated == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_annotation_not_found(self, loaded_manager):
        """Test update_annotation returns None for non-existent ID."""
        result = loaded_manager.update_annotation(999, {"category_id": 2})

        assert result is None
        assert loaded_manager._changes.annotations_updated == 0

    def test_delete_annotation_removes_from_memory(self, loaded_manager):
        """Test delete_annotation removes annotation from data."""
        result = loaded_manager.delete_annotation(1)

        assert result is True
        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 1
        assert not any(a["id"] == 1 for a in annotations)

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_annotation_increments_counter(self, loaded_manager):
        """Test delete_annotation increments the change counter."""
        loaded_manager.delete_annotation(1)

        assert loaded_manager._changes.annotations_deleted == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_annotation_not_found(self, loaded_manager):
        """Test delete_annotation returns False for non-existent ID."""
        result = loaded_manager.delete_annotation(999)

        assert result is False
        assert loaded_manager._changes.annotations_deleted == 0


# =============================================================================
# Category Mutation Tests
# =============================================================================


class TestDatasetManagerCategories:
    def test_add_category_updates_memory(self, loaded_manager):
        """Test add_category adds to in-memory data."""
        new_cat = {"id": 99, "name": "bird", "supercategory": "animal"}
        loaded_manager.add_category(new_cat)

        categories = loaded_manager.get_categories()
        assert len(categories) == 3
        assert any(c["id"] == 99 for c in categories)

        # Cleanup
        loaded_manager._cancel_timer()

    def test_add_category_increments_counter(self, loaded_manager):
        """Test add_category increments the change counter."""
        loaded_manager.add_category(
            {"id": 99, "name": "bird", "supercategory": "animal"}
        )

        assert loaded_manager._changes.categories_added == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_category_modifies_in_place(self, loaded_manager):
        """Test update_category modifies existing category."""
        result = loaded_manager.update_category(1, {"name": "puppy"})

        assert result is not None
        assert result["name"] == "puppy"

        # Verify in data
        categories = loaded_manager.get_categories()
        cat = next(c for c in categories if c["id"] == 1)
        assert cat["name"] == "puppy"

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_category_increments_counter(self, loaded_manager):
        """Test update_category increments the change counter."""
        loaded_manager.update_category(1, {"name": "puppy"})

        assert loaded_manager._changes.categories_updated == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_update_category_not_found(self, loaded_manager):
        """Test update_category returns None for non-existent ID."""
        result = loaded_manager.update_category(999, {"name": "ghost"})

        assert result is None
        assert loaded_manager._changes.categories_updated == 0

    def test_delete_category_removes_from_memory(self, loaded_manager):
        """Test delete_category removes category from data."""
        result = loaded_manager.delete_category(1)

        assert result is True
        categories = loaded_manager.get_categories()
        assert len(categories) == 1
        assert not any(c["id"] == 1 for c in categories)

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_category_increments_counter(self, loaded_manager):
        """Test delete_category increments the change counter."""
        loaded_manager.delete_category(1)

        assert loaded_manager._changes.categories_deleted == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_category_not_found(self, loaded_manager):
        """Test delete_category returns False for non-existent ID."""
        result = loaded_manager.delete_category(999)

        assert result is False
        assert loaded_manager._changes.categories_deleted == 0


# =============================================================================
# Image Mutation Tests
# =============================================================================


class TestDatasetManagerImages:
    def test_delete_image_removes_from_memory(self, loaded_manager):
        """Test delete_image removes image from data."""
        result = loaded_manager.delete_image(1)

        assert result is True
        images = loaded_manager.get_images()
        assert len(images) == 1
        assert not any(img["id"] == 1 for img in images)

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_image_removes_associated_annotations(self, loaded_manager):
        """Test delete_image also removes annotations for that image."""
        # Image 1 has 2 annotations
        loaded_manager.delete_image(1)

        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 0  # Both annotations were for image 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_image_increments_counter(self, loaded_manager):
        """Test delete_image increments the change counter."""
        loaded_manager.delete_image(1)

        assert loaded_manager._changes.images_deleted == 1

        # Cleanup
        loaded_manager._cancel_timer()

    def test_delete_image_not_found(self, loaded_manager):
        """Test delete_image returns False for non-existent ID."""
        result = loaded_manager.delete_image(999)

        assert result is False
        assert loaded_manager._changes.images_deleted == 0

    def test_set_images_replaces_all(self, loaded_manager):
        """Test set_images replaces entire images list."""
        new_images = [{"id": 100, "file_name": "new.jpg"}]
        loaded_manager.set_images(new_images)

        images = loaded_manager.get_images()
        assert len(images) == 1
        assert images[0]["id"] == 100

    def test_set_annotations_replaces_all(self, loaded_manager):
        """Test set_annotations replaces entire annotations list."""
        new_annotations = [{"id": 100, "image_id": 1, "category_id": 1}]
        loaded_manager.set_annotations(new_annotations)

        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 1
        assert annotations[0]["id"] == 100


# =============================================================================
# Thread Safety Tests
# =============================================================================


class TestDatasetManagerThreadSafety:
    def test_concurrent_mutations_safe(self, loaded_manager):
        """Test concurrent mutations don't corrupt data."""
        errors = []

        def add_annotations(start_id):
            try:
                for i in range(10):
                    loaded_manager.add_annotation(
                        {"id": start_id + i, "image_id": 1, "category_id": 1}
                    )
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=add_annotations, args=(100,)),
            threading.Thread(target=add_annotations, args=(200,)),
            threading.Thread(target=add_annotations, args=(300,)),
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0

        # Should have original 2 + 30 new = 32
        annotations = loaded_manager.get_annotations()
        assert len(annotations) == 32

        # Cleanup
        loaded_manager._cancel_timer()

    def test_read_during_write(self, loaded_manager):
        """Test reading while writing is safe."""
        errors = []
        results = []

        def writer():
            try:
                for i in range(20):
                    loaded_manager.add_annotation(
                        {"id": 100 + i, "image_id": 1, "category_id": 1}
                    )
                    time.sleep(0.001)
            except Exception as e:
                errors.append(e)

        def reader():
            try:
                for _ in range(20):
                    count = len(loaded_manager.get_annotations())
                    results.append(count)
                    time.sleep(0.001)
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=writer),
            threading.Thread(target=reader),
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        # All reads should have returned valid counts
        assert all(r >= 2 for r in results)  # At least original 2

        # Cleanup
        loaded_manager._cancel_timer()


# =============================================================================
# S3 Integration Tests
# =============================================================================


class TestDatasetManagerS3:
    def test_save_marks_s3_dirty(self, tmp_path):
        """Test save marks S3 state as dirty when DATASET_IS_S3 is True."""
        with patch("coco_label_tool.app.dataset_manager.DATASET_IS_S3", True):
            with patch("coco_label_tool.app.dataset_manager.s3_state") as mock_s3_state:
                manager = DatasetManager()
                json_path = tmp_path / "dataset.json"
                json_path.write_text(json.dumps(MOCK_DATASET))
                manager.load(json_path)

                manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
                manager.save()

                mock_s3_state.mark_dirty.assert_called_once()

    def test_save_does_not_mark_s3_dirty_for_local(self, loaded_manager):
        """Test save does not mark S3 dirty for local datasets."""
        with patch("coco_label_tool.app.dataset_manager.s3_state") as mock_s3_state:
            loaded_manager.add_annotation({"id": 99, "image_id": 1, "category_id": 1})
            loaded_manager.save()

            mock_s3_state.mark_dirty.assert_not_called()
