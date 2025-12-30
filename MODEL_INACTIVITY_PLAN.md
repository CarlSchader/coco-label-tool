# Model Inactivity Auto-Unload Plan

## Overview

Implement automatic model unloading after 5 minutes of model-related inactivity, with lazy reloading when models are needed again. The frontend shows the loading animation only when the model is actually loading.

## Goals

1. **Memory management**: Free GPU memory when models aren't being used
2. **Lazy loading**: Models load on-demand when needed
3. **Smart UI**: Loading animation only shows when model needs to load
4. **Manual control**: Button to manually unload models for debugging/testing
5. **Logging**: Clear log messages for load/unload events

## Design Decisions

### Inactivity Tracking: Global (not per-model)

- Single timer - ANY model activity resets it
- If SAM2 was used, all models stay loaded for 5 more minutes
- When timeout fires, ALL loaded models are unloaded
- Simpler implementation, covers main use case (freeing memory when idle)

### Tracked Endpoints (Reset Inactivity Timer)

Only endpoints that actually USE the model reset the timer. Model-info endpoints do NOT reset the timer or load models.

| Endpoint                            | Model        | Resets Timer | Loads Model |
| ----------------------------------- | ------------ | ------------ | ----------- |
| `POST /api/segment`                 | SAM2         | Yes          | Yes         |
| `POST /api/segment-sam3`            | SAM3 Tracker | Yes          | Yes         |
| `POST /api/segment-sam3-pcs`        | SAM3 PCS     | Yes          | Yes         |
| `GET /api/model-info`               | SAM2         | No           | No          |
| `GET /api/model-info-sam3`          | SAM3 Tracker | No           | No          |
| `GET /api/model-info-sam3-pcs`      | SAM3 PCS     | No           | No          |
| `POST /api/set-model-size`          | SAM2         | Yes          | Yes         |
| `POST /api/set-model-size-sam3`     | SAM3 Tracker | Yes          | Yes         |
| `POST /api/set-model-size-sam3-pcs` | SAM3 PCS     | Yes          | Yes         |

**Key change**: `model-info` endpoints now return static configuration data without loading models, enabling true lazy loading.

### Configuration

| Setting            | Environment Variable       | Default     | Description                       |
| ------------------ | -------------------------- | ----------- | --------------------------------- |
| Inactivity timeout | `MODEL_INACTIVITY_TIMEOUT` | 300 (5 min) | Seconds before unloading          |
| Check interval     | `MODEL_CHECK_INTERVAL`     | 30          | How often to check for inactivity |

## New API Endpoints

### `GET /api/model-status`

Returns which models are currently loaded WITHOUT triggering loading.

**Response:**

```json
{
  "sam2": true,
  "sam3": false,
  "sam3_pcs": false
}
```

### `POST /api/unload-models`

Manually unloads all models to free GPU memory.

**Response:**

```json
{
  "success": true,
  "unloaded": {
    "sam2": true,
    "sam3": false,
    "sam3_pcs": false
  }
}
```

## Files to Create

### 1. `app/model_manager.py`

Central model management with:

- Activity tracking (`record_activity()`)
- Status checking (`get_loaded_models()`)
- Unload function (`unload_all_models()`)
- Background monitor task (`start_monitor()`, `stop_monitor()`)
- Model registration (`register_model()`)

### 2. `tests/test_model_manager.py`

Unit tests for:

- `ModelManager` initialization
- `record_activity()` updates timestamp
- `get_loaded_models()` returns correct status
- `unload_all_models()` calls clear functions
- `register_model()` adds checkers/clearers
- Inactivity monitor timing logic

## Files to Modify

### 1. `app/config.py`

Add configuration constants:

```python
MODEL_INACTIVITY_TIMEOUT = int(os.environ.get("MODEL_INACTIVITY_TIMEOUT", "300"))
MODEL_CHECK_INTERVAL = int(os.environ.get("MODEL_CHECK_INTERVAL", "30"))
```

### 2. `app/sam2.py`

Add status check and current model ID functions:

```python
def is_sam2_loaded() -> bool:
    """Check if SAM2 service is currently loaded."""
    return _sam2_service is not None

def get_sam2_current_model_id() -> str:
    """Get the current model ID without loading the model."""
    if _sam2_service is not None:
        return _sam2_service.model_id
    return SAM2_MODEL_ID  # Return default from config
```

### 3. `app/sam3.py`

Add status check function:

```python
def is_sam3_tracker_loaded() -> bool:
    """Check if SAM3 Tracker service is currently loaded."""
    return _sam3_tracker_service is not None
```

### 4. `app/sam3_pcs.py`

Add status check function:

```python
def is_sam3_pcs_loaded() -> bool:
    """Check if SAM3 PCS service is currently loaded."""
    return _sam3_pcs_service is not None
```

### 5. `app/routes.py`

Changes:

- Import model manager and is_loaded functions
- Register models in `startup_event()`
- Start monitor in `startup_event()`
- Stop monitor in `shutdown_event()`
- Add `model_manager.record_activity()` to all tracked endpoints
- Add `GET /api/model-status` endpoint
- Add `POST /api/unload-models` endpoint

### 6. `templates/index.html`

Add "Unload Models" button in navigation bar (`.nav-links`):

```html
<button id="btn-unload-models" class="nav-btn nav-btn-warning">
  Unload Models
</button>
```

### 7. `static/css/styles.css`

Add warning button variant:

```css
.nav-btn-warning {
  color: #f0ad4e;
  border-color: #f0ad4e;
}

.nav-btn-warning:hover {
  background: rgba(240, 173, 78, 0.15);
  box-shadow: 0 0 10px rgba(240, 173, 78, 0.3);
}
```

### 8. `static/js/app.js`

Changes:

- Add `checkModelStatus()` function
- Add `getModelStatusKey()` helper
- Modify `loadModelInfo()` to check status before showing loading
- Modify `runSegmentation()` to check status before showing loading
- Add `handleUnloadModels()` function
- Add event listener for unload button in `setupEventListeners()`

## Frontend Behavior Changes

### Smart Loading Animation

Before calling model endpoints, check `/api/model-status`:

1. If model is already loaded → no loading animation
2. If model needs loading → show loading animation

### Unload Button

- Yellow button in nav bar (warning color)
- Calls `POST /api/unload-models`
- Shows toast notification:
  - Success: "Models unloaded: SAM2, SAM3" (lists which were unloaded)
  - Info: "No models were loaded" (if nothing to unload)

## Sequence Diagrams

### User segments after inactivity timeout

```
User clicks to segment after 5+ min inactivity:

Frontend                    Backend
   |                           |
   |-- GET /api/model-status --|
   |<-- {sam2: false, ...} ----|
   |                           |
   | [Show loading animation]  |
   |                           |
   |-- POST /api/segment ------|
   |     model_manager.record_activity()
   |     get_sam2_service() → loads model
   |<-- {segmentation: [...]} -|
   |                           |
   | [Hide loading animation]  |
```

### Background inactivity monitor

```
Every 30 seconds:

ModelManager._inactivity_monitor()
   |
   |-- Check: time.time() - last_activity >= 300?
   |
   |-- If YES and any models loaded:
   |      |-- Log: "Model inactivity timeout..."
   |      |-- unload_all_models()
   |      |-- Reset last_activity to 0
   |
   |-- If NO:
   |      |-- Continue sleeping
```

## Testing Checklist

### Backend Tests (`tests/test_model_manager.py`)

- [ ] `ModelManager.__init__` sets default values
- [ ] `record_activity()` updates `last_activity` timestamp
- [ ] `get_loaded_models()` returns dict with correct status
- [ ] `unload_all_models()` calls registered clear functions
- [ ] `unload_all_models()` only clears loaded models
- [ ] `register_model()` adds functions to internal dicts
- [ ] Inactivity check logic (elapsed time calculation)

### Integration Tests

- [ ] `GET /api/model-status` returns correct status
- [ ] `POST /api/unload-models` unloads models and returns result
- [ ] Activity tracking on segment endpoints
- [ ] Activity tracking on model-info endpoints
- [ ] Activity tracking on set-model-size endpoints

### Manual Testing

- [ ] Loading animation shows only when model needs loading
- [ ] Loading animation doesn't show for already-loaded model
- [ ] Unload button shows toast on success
- [ ] Unload button shows appropriate message when no models loaded
- [ ] Models auto-unload after 5 minutes of inactivity
- [ ] Models reload correctly after auto-unload

## Implementation Order

1. Add config constants to `app/config.py`
2. Add `is_loaded()` functions to `sam2.py`, `sam3.py`, `sam3_pcs.py`
3. Create `app/model_manager.py`
4. Update `app/routes.py` with endpoints and integration
5. Add button to `templates/index.html`
6. Add CSS styles to `static/css/styles.css`
7. Update `static/js/app.js` with frontend logic
8. Write tests in `tests/test_model_manager.py`
9. Run `./scripts/check.sh` to verify all changes
