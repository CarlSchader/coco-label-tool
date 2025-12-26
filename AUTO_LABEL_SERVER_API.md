# Auto-Label Server API Contract

This document describes the API contract that external auto-labeling servers must implement to integrate with the coco-label-tool.

## Overview

The auto-label feature sends images to external object detection servers and receives COCO-format annotations in response. These annotations are displayed as unsaved masks in the labeling tool, allowing users to review and save them.

---

## Client Configuration

The auto-label feature is configured via a YAML file passed at server startup.

### Starting the Server

```bash
# Via CLI argument
python server.py /path/to/dataset.json --auto-label-config /path/to/auto_label_config.yaml

# Or via environment variable
AUTO_LABEL_CONFIG=/path/to/config.yaml python server.py /path/to/dataset.json
```

### Configuration File Format

**File: `auto_label_config.yaml`**

```yaml
endpoints:
  # Each key is an endpoint name (shown in UI dropdown)
  <endpoint-name>:
    url: "<server-url>" # Required: Full URL to the detection endpoint
    auth_token: "<token>" # Optional: Authorization header value
    category_mapping: # Required: Maps server category IDs to dataset category IDs
      <server_id>: <dataset_id>
```

### Configuration Fields

| Field              | Type     | Required | Description                                                                |
| ------------------ | -------- | -------- | -------------------------------------------------------------------------- |
| `endpoints`        | `object` | **Yes**  | Map of endpoint names to their configurations                              |
| `url`              | `string` | **Yes**  | Full URL to the server's detection endpoint                                |
| `auth_token`       | `string` | No       | Value sent in `Authorization` header (e.g., `Bearer sk-xxx`, `ApiKey xxx`) |
| `category_mapping` | `object` | **Yes**  | Maps server category IDs (int) to local dataset category IDs (int)         |

### Example Configuration

```yaml
# auto_label_config.yaml

endpoints:
  # YOLO-based detector with API key auth
  yolo-v8:
    url: "https://my-ml-server.com/api/detect"
    auth_token: "Bearer sk-abc123def456"
    category_mapping:
      # Server's COCO categories -> Your dataset's categories
      1: 5 # person -> your_person_category
      2: 12 # car -> your_vehicle_category
      3: 12 # truck -> your_vehicle_category (multiple can map to same)
      7: 8 # bus -> your_bus_category

  # Local Florence model (no auth needed)
  florence-local:
    url: "http://localhost:8080/segment"
    auth_token: ""
    category_mapping:
      0: 1
      1: 2
      2: 3

  # External service with simple API key
  cloud-detector:
    url: "https://api.detector.io/v1/detect"
    auth_token: "ApiKey my-secret-key-here"
    category_mapping:
      100: 1
      101: 2
```

### Authentication

The `auth_token` field is sent as-is in the `Authorization` HTTP header. Common formats:

| Auth Type    | `auth_token` Value          | Header Sent                         |
| ------------ | --------------------------- | ----------------------------------- |
| Bearer Token | `Bearer sk-abc123`          | `Authorization: Bearer sk-abc123`   |
| API Key      | `ApiKey my-key`             | `Authorization: ApiKey my-key`      |
| Basic Auth   | `Basic dXNlcjpwYXNz`        | `Authorization: Basic dXNlcjpwYXNz` |
| Custom       | `Token xyz`                 | `Authorization: Token xyz`          |
| None         | `""` (empty string) or omit | No `Authorization` header sent      |

### Category Mapping

The `category_mapping` translates between the server's category IDs and your dataset's category IDs:

- **Keys**: Category IDs returned by the external server
- **Values**: Category IDs in your local COCO dataset
- **Unmapped categories are silently skipped** - the server can return all detections, and the client filters to only the categories you care about

---

## Server API Endpoint

**Method:** `POST`

**URL:** Configured in `auto_label_config.yaml` (e.g., `https://your-server.com/api/detect`)

---

## Request

### Headers

| Header          | Value              | Notes                                                                   |
| --------------- | ------------------ | ----------------------------------------------------------------------- |
| `Content-Type`  | `application/json` | Always JSON                                                             |
| `Authorization` | `<auth_token>`     | Only if `auth_token` is configured (can be Bearer token, API key, etc.) |

### Body

```json
{
  "image": "<base64-encoded-image-data>"
}
```

| Field   | Type     | Required | Description                                 |
| ------- | -------- | -------- | ------------------------------------------- |
| `image` | `string` | Yes      | Base64-encoded image data (JPEG, PNG, etc.) |

### Example Request

```json
{
  "image": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwME..."
}
```

---

## Response

### Success Response

**Status Code:** `200 OK`

```json
{
  "annotations": [
    {
      "category_id": 1,
      "segmentation": [[x1, y1, x2, y2, x3, y3, ...]],
      "bbox": [x, y, width, height],
      "area": 12345.0
    }
  ]
}
```

### Annotation Fields

| Field          | Type                  | Required | Description                                                                                                   |
| -------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `category_id`  | `integer`             | **Yes**  | Server's category ID (will be mapped to local dataset category via config)                                    |
| `segmentation` | `array[array[float]]` | **Yes**  | Array of polygons in COCO format. Each polygon is a flat array of coordinates `[x1, y1, x2, y2, x3, y3, ...]` |
| `bbox`         | `array[float]`        | **Yes**  | Bounding box in COCO format: `[x, y, width, height]` where (x, y) is top-left corner                          |
| `area`         | `float`               | **Yes**  | Area of the segmentation in pixels                                                                            |
| `iscrowd`      | `integer`             | No       | COCO crowd flag (0 or 1). Defaults to 0 if not provided                                                       |

### Segmentation Format

The `segmentation` field must be an array of polygons in COCO polygon format:

```json
{
  "segmentation": [
    [x1, y1, x2, y2, x3, y3, x4, y4, ...],
    [x1, y1, x2, y2, x3, y3, ...]
  ]
}
```

**Requirements:**

- Each polygon is a flat array of alternating x, y coordinates
- Each polygon must have at least 3 points (6 coordinates minimum)
- Coordinates are in pixels, relative to the original image dimensions
- Multiple polygons represent a single object with disconnected parts (e.g., occluded object)

**Example - Single polygon (simple object):**

```json
{
  "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]]
}
```

**Example - Multiple polygons (object with hole or disconnected parts):**

```json
{
  "segmentation": [
    [100, 100, 200, 100, 200, 200, 100, 200],
    [300, 300, 400, 300, 400, 400, 300, 400]
  ]
}
```

### Bounding Box Format

The `bbox` field follows COCO format:

```json
{
  "bbox": [x, y, width, height]
}
```

Where:

- `x` - X coordinate of top-left corner
- `y` - Y coordinate of top-left corner
- `width` - Width of bounding box
- `height` - Height of bounding box

### Example Response

```json
{
  "annotations": [
    {
      "category_id": 1,
      "segmentation": [
        [150.5, 200.0, 250.5, 200.0, 250.5, 350.0, 150.5, 350.0]
      ],
      "bbox": [150.5, 200.0, 100.0, 150.0],
      "area": 15000.0
    },
    {
      "category_id": 2,
      "segmentation": [
        [400.0, 100.0, 500.0, 100.0, 500.0, 200.0, 400.0, 200.0]
      ],
      "bbox": [400.0, 100.0, 100.0, 100.0],
      "area": 10000.0
    }
  ]
}
```

---

## Error Responses

The server should return appropriate HTTP status codes for errors:

| Status Code | Meaning                           | Example                                    |
| ----------- | --------------------------------- | ------------------------------------------ |
| `400`       | Bad Request - Invalid input       | Malformed base64, unsupported image format |
| `401`       | Unauthorized - Invalid auth token | Missing or invalid Authorization header    |
| `413`       | Payload Too Large - Image too big | Image exceeds server's size limit          |
| `500`       | Internal Server Error             | Model inference failed                     |
| `503`       | Service Unavailable               | Model not loaded, server overloaded        |

Error response body (optional but recommended):

```json
{
  "error": "Description of what went wrong"
}
```

---

## Timeout

The client has a **60 second timeout** for requests. Ensure your server responds within this time for typical images.

---

## Example Server Implementation (Python/FastAPI)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
from io import BytesIO
from PIL import Image

app = FastAPI()

class DetectRequest(BaseModel):
    image: str  # Base64 encoded

class Annotation(BaseModel):
    category_id: int
    segmentation: list[list[float]]
    bbox: list[float]
    area: float

class DetectResponse(BaseModel):
    annotations: list[Annotation]

@app.post("/api/detect", response_model=DetectResponse)
async def detect(request: DetectRequest):
    # Decode image
    try:
        image_data = base64.b64decode(request.image)
        image = Image.open(BytesIO(image_data))
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}")

    # Run your detection model here
    # detections = your_model.detect(image)

    # Convert detections to COCO format
    # Apply any confidence filtering here on the server side
    annotations = []
    for det in detections:
        if det.confidence < 0.5:  # Server-side confidence filtering
            continue
        annotations.append(Annotation(
            category_id=det.class_id,
            segmentation=[det.polygon],  # Flat list of x,y coords
            bbox=[det.x, det.y, det.width, det.height],
            area=det.width * det.height
        ))

    return DetectResponse(annotations=annotations)
```

---

## Validation Errors

The coco-label-tool validates all annotations and will show an error if:

1. **Missing required field** - `category_id`, `segmentation`, `bbox`, or `area` is missing
2. **Empty segmentation** - `segmentation` is an empty array `[]`
3. **Invalid polygon** - A polygon has fewer than 6 coordinates (3 points)
4. **Non-list segmentation** - `segmentation` is not an array

Example error shown to user:

```
Invalid response: missing 'segmentation'
Invalid response: Polygon 0 needs at least 3 points (6 coords)
```

---

## Testing Your Server

You can test your server with curl:

```bash
# Encode an image to base64
IMAGE_B64=$(base64 -w 0 test_image.jpg)

# Send request
curl -X POST https://your-server.com/api/detect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d "{\"image\": \"$IMAGE_B64\"}"
```

Expected response:

```json
{
  "annotations": [
    {
      "category_id": 1,
      "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],
      "bbox": [100, 100, 100, 100],
      "area": 10000
    }
  ]
}
```
