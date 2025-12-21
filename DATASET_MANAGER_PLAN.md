# Dataset Manager Implementation Plan

## Overview

Replace the current "load-modify-save on every operation" pattern with a `DatasetManager` singleton that:

- **Loads once** at startup into memory
- **Mutates in-memory** on all CRUD operations (instant, no disk I/O)
- **Auto-saves every 30 seconds** when dirty (timer starts on first mutation, stops after save)
- **Tracks change counts** for informative logging
- **Saves on shutdown** and **before S3 upload**

## Problem Statement

Currently, every annotation save, category update, or deletion triggers:

1. Full JSON file read (`_load_dataset()`)
2. In-memory modification
3. Full JSON file write (`_save_dataset()`)

For large COCO files (tens of thousands of annotations), this is inefficient and slow.

## Solution

Keep the entire dataset in memory and only write to disk:

1. On a timer (every 30 seconds, if there are pending changes)
2. Before S3 upload (to ensure consistency)
3. On server shutdown (graceful exit)

This approach:

- Makes all CRUD operations instant (memory-only)
- Reduces disk I/O dramatically
- Is invisible to the user (no UI changes)
- Prepares for future multi-user support

## Architecture

```
User Action (save annotation)
        │
        ▼
DatasetManager.add_annotation()
        │
        ▼
┌───────────────────────────────────┐
│  Mutate _data in memory           │
│  Increment change counter         │
│  Schedule timer (if not running)  │
└───────────────────────────────────┘
        │
        ▼
    ⏱️ 30 seconds later...
        │
        ▼
┌───────────────────────────────────┐
│  Timer fires → save()             │
│  Write JSON to disk               │
│  Log: "Auto-saved (3 added, 1     │
│        deleted)"                  │
│  Reset change counters            │
│  Timer stops                      │
└───────────────────────────────────┘
```

## Files to Create/Modify

| File                            | Action     | Description                                |
| ------------------------------- | ---------- | ------------------------------------------ |
| `app/config.py`                 | Modify     | Add `DATASET_AUTO_SAVE_INTERVAL = 30`      |
| `app/dataset_manager.py`        | **Create** | New `DatasetManager` class (~250 lines)    |
| `app/dataset.py`                | Modify     | Delegate to `dataset_manager` (~200 lines) |
| `app/routes.py`                 | Modify     | Add startup/shutdown hooks (~15 lines)     |
| `tests/test_dataset_manager.py` | **Create** | Unit tests for manager (~300 lines)        |
| `tests/test_dataset.py`         | Modify     | Update mocking for new architecture        |

**No frontend changes required.**

## Detailed Design

### 1. Configuration (`app/config.py`)

Add a new constant:

```python
# Dataset auto-save settings (seconds)
DATASET_AUTO_SAVE_INTERVAL = int(
    os.environ.get("DATASET_AUTO_SAVE_INTERVAL", "30")
)
```

### 2. Change Tracker

A simple dataclass to track what changed since last save:

```python
@dataclass
class ChangeTracker:
    annotations_added: int = 0
    annotations_updated: int = 0
    annotations_deleted: int = 0
    categories_added: int = 0
    categories_updated: int = 0
    categories_deleted: int = 0
    images_deleted: int = 0

    def reset(self) -> None:
        """Reset all counters to zero."""

    def has_changes(self) -> bool:
        """Check if any changes were tracked."""

    def summary(self) -> str:
        """Generate human-readable summary."""
        # Returns: "3 annotation(s) added, 1 category(ies) deleted"
```

### 3. Dataset Manager Class

```python
@dataclass
class DatasetManager:
    """Manages COCO dataset in memory with timer-based auto-save."""

    _data: Optional[Dict[str, Any]] = None
    _local_path: Optional[Path] = None
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _save_timer: Optional[threading.Timer] = None
    _changes: ChangeTracker = field(default_factory=ChangeTracker)

    # === Lifecycle Methods ===
    def load(self, path: Path) -> None: ...
    def save(self) -> bool: ...
    def flush(self) -> bool: ...
    def shutdown(self) -> None: ...

    # === Timer Management ===
    def _schedule_auto_save(self) -> None: ...
    def _auto_save_callback(self) -> None: ...
    def _cancel_timer(self) -> None: ...

    # === Data Access (Read) ===
    def get_images(self) -> List[Dict]: ...
    def get_annotations(self) -> List[Dict]: ...
    def get_categories(self) -> List[Dict]: ...
    def get_next_annotation_id(self) -> int: ...
    def get_next_category_id(self) -> int: ...

    # === Mutations (Write) ===
    def add_annotation(self, annotation: Dict) -> None: ...
    def update_annotation(self, annotation_id: int, updates: Dict) -> Optional[Dict]: ...
    def delete_annotation(self, annotation_id: int) -> bool: ...
    def add_category(self, category: Dict) -> None: ...
    def update_category(self, category_id: int, updates: Dict) -> Optional[Dict]: ...
    def delete_category(self, category_id: int) -> bool: ...
    def delete_image(self, image_id: int) -> bool: ...

# Singleton instance
dataset_manager = DatasetManager()
```

### 4. Timer Behavior

The timer uses a "start on dirty, stop after save" pattern:

1. **First mutation** → Timer scheduled for 30 seconds
2. **Subsequent mutations (within 30s)** → Timer already running, no action
3. **Timer fires** → `save()` called, timer reference cleared
4. **If still dirty after save** → Should not happen, but timer would not restart automatically

This is more efficient than a continuously running timer that checks dirty state.

### 5. Thread Safety

All public methods acquire `_lock` before accessing/modifying `_data`:

```python
def add_annotation(self, annotation: Dict) -> None:
    with self._lock:
        self.data.setdefault("annotations", []).append(annotation)
        self._changes.annotations_added += 1
    self._schedule_auto_save()  # Outside lock to avoid deadlock
```

The timer callback also acquires the lock when saving.

### 6. Changes to `dataset.py`

Existing functions become thin wrappers:

```python
# BEFORE
def add_annotation(image_id, category_id, segmentation):
    data = _load_dataset()  # File read
    # ... business logic ...
    _save_dataset(data)  # File write
    return new_annotation

# AFTER
def add_annotation(image_id, category_id, segmentation):
    new_id = dataset_manager.get_next_annotation_id()
    # ... business logic (unchanged) ...
    dataset_manager.add_annotation(new_annotation)  # Memory only
    return new_annotation
```

Functions to update:

- `load_full_metadata()` → read from `dataset_manager`
- `load_images_range()` → read from `dataset_manager`
- `get_categories()` → delegate to `dataset_manager.get_categories()`
- `save_dataset()` → delegate to `dataset_manager.set_images/set_annotations`
- `add_category()` → delegate to `dataset_manager.add_category()`
- `update_category()` → delegate to `dataset_manager.update_category()`
- `delete_category()` → delegate to `dataset_manager.delete_category()`
- `get_annotations_by_image()` → filter `dataset_manager.get_annotations()`
- `add_annotation()` → delegate to `dataset_manager.add_annotation()`
- `update_annotation()` → delegate to `dataset_manager.update_annotation()`
- `delete_annotation()` → delegate to `dataset_manager.delete_annotation()`
- `delete_image()` → delegate to `dataset_manager.delete_image()`
- `save_dataset_to_s3()` → call `dataset_manager.flush()` first

### 7. Changes to `routes.py`

```python
from .dataset_manager import dataset_manager

@app.on_event("startup")
async def startup_event():
    global total_images
    cache.clear()

    # Load dataset into memory manager
    local_path = _get_local_json_path()
    dataset_manager.load(local_path)

    # ... existing cache initialization (unchanged) ...

@app.on_event("shutdown")
async def shutdown_event():
    # Save any pending changes before shutdown
    dataset_manager.shutdown()
    cache.clear()
```

S3 upload endpoint update:

```python
@app.post("/api/save-to-s3")
async def save_to_s3():
    if not DATASET_IS_S3:
        raise HTTPException(...)

    # Flush local changes to disk first
    dataset_manager.flush()

    # Then upload to S3
    result = dataset.save_dataset_to_s3()
    return result
```

## Test Plan

### Test Categories

1. **Lifecycle tests**
   - `test_load_reads_file_into_memory`
   - `test_load_resets_change_tracker`
   - `test_save_writes_to_disk_when_dirty`
   - `test_save_returns_false_when_clean`
   - `test_flush_cancels_timer_and_saves`
   - `test_shutdown_saves_if_dirty`

2. **Timer tests**
   - `test_timer_schedules_on_first_mutation`
   - `test_timer_does_not_double_schedule`
   - `test_timer_fires_and_saves`
   - `test_timer_stops_after_save`

3. **Change tracking tests**
   - `test_change_tracker_reset`
   - `test_change_tracker_has_changes`
   - `test_change_tracker_summary_single`
   - `test_change_tracker_summary_multiple`
   - `test_changes_reset_after_save`

4. **Read operation tests**
   - `test_get_images`
   - `test_get_annotations`
   - `test_get_categories`
   - `test_get_next_annotation_id`
   - `test_get_next_annotation_id_empty`

5. **Mutation tests**
   - `test_add_annotation_updates_memory`
   - `test_add_annotation_increments_counter`
   - `test_add_annotation_schedules_timer`
   - `test_update_annotation_modifies_in_place`
   - `test_update_annotation_not_found`
   - `test_delete_annotation_removes_from_memory`
   - `test_delete_annotation_not_found`
   - Similar tests for categories and images

6. **Thread safety tests**
   - `test_concurrent_mutations_safe`
   - `test_save_during_mutation`

7. **S3 integration tests**
   - `test_save_marks_s3_dirty`

## Implementation Order (TDD)

1. **Write `tests/test_dataset_manager.py`** - Full test suite for new manager
2. **Create `app/dataset_manager.py`** - Implement to pass tests
3. **Update `app/config.py`** - Add constant
4. **Update `tests/test_dataset.py`** - Adjust mocking
5. **Update `app/dataset.py`** - Delegate to manager
6. **Update `app/routes.py`** - Add lifecycle hooks
7. **Run `./scripts/check.sh`** - Verify all tests pass

## Behavior Summary

| Event                                      | Action                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Server startup                             | `dataset_manager.load()` - read JSON into memory                                 |
| User saves annotation                      | `add_annotation()` - mutate memory, increment counter, schedule 30s timer        |
| User saves another annotation (within 30s) | `add_annotation()` - mutate memory, increment counter, timer already running     |
| 30 seconds elapse                          | Timer fires → `save()` → write to disk, log summary, reset counters, timer stops |
| User clicks "Save to S3"                   | `flush()` → cancel timer, save to disk immediately, then upload to S3            |
| Server shutdown (Ctrl+C)                   | `shutdown()` → cancel timer, save if dirty, log "Dataset saved on shutdown"      |
| Server crash                               | Up to 30 seconds of work lost (acceptable per requirements)                      |

## Logging

All logs use Python's `logging` module at INFO level:

```
INFO: Dataset loaded into memory from /path/to/dataset.json
INFO: Auto-saved dataset to /path/to/dataset.json (3 annotation(s) added, 1 category(ies) deleted)
INFO: Dataset saved on shutdown
```

Timer scheduling uses DEBUG level:

```
DEBUG: Auto-save timer scheduled (30s)
```

## Future Multi-User Considerations

This design prepares for multi-user support:

1. **Single source of truth** - `DatasetManager` holds authoritative state
2. **Timer decoupled from user actions** - No "which user triggers save?" problem
3. **Thread-safe mutations** - Ready for concurrent access
4. **Potential additions for multi-user:**
   - WebSocket notifications when data changes
   - Conflict resolution (last-write-wins or merge)
   - Per-user change tracking
   - Optimistic locking with version numbers

## Open Questions (Resolved)

1. **Path resolution helper**: Keep `_get_local_json_path()` in `dataset.py`, call from `routes.py` during startup

2. **Logging levels**: DEBUG for timer scheduling, INFO for actual saves

3. **Change tracking**: Track detailed counts (Option B) for informative logging

4. **Timer behavior**: Start on dirty, stop after save (Option B) for efficiency
