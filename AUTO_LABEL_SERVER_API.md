# Auto-Label Server API Contract

This document describes the API contract that external auto-labeling servers must implement to integrate with the coco-label-tool.

## Overview

The auto-label feature sends images to external object detection servers and receives COCO-format annotations in response. These annotations are displayed as unsaved masks in the labeling tool, allowing users to review and save them.

---

## Endpoint

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

## Category Mapping

The `category_id` in the response is the server's internal category ID. This is mapped to the local dataset's category ID via the configuration file:

```yaml
endpoints:
  my-detector:
    url: "https://example.com/detect"
    category_mapping:
      1: 5 # Server's category 1 -> Dataset's category 5
      2: 12 # Server's category 2 -> Dataset's category 12
```

**Important:**

- Annotations with unmapped category IDs are **silently skipped**
- This allows the server to return all detected objects, and the client filters to relevant categories
- Any confidence filtering should be done by the server before returning annotations

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
