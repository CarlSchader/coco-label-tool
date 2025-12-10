"""API route handlers."""

import traceback
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    Response,
)
from fastapi.templating import Jinja2Templates

from . import create_app, dataset
from .cache import ImageCache
from .config import (
    CACHE_HEAD,
    CACHE_SIZE,
    CACHE_TAIL,
    DATASET_IS_S3,
    DATASET_URI,
    MAX_IMAGE_DIMENSION,
    SAM2_MODEL_SIZES,
    SAM3_MODEL_SIZES,
    SAM3_PCS_MODEL_SIZES,
)
from .dataset import resolve_image_path
from .exceptions import AnnotationNotFoundError, CategoryInUseError
from .models import (
    AddCategoryRequest,
    BatchSaveAnnotationsRequest,
    DeleteAnnotationRequest,
    DeleteCategoryRequest,
    DeleteImageRequest,
    LoadRangeRequest,
    SaveAnnotationRequest,
    SegmentRequest,
    SegmentRequestPCS,
    SetModelSizeRequest,
    UpdateAnnotationRequest,
    UpdateCategoryRequest,
)
from .sam2 import get_sam2_service
from .sam3 import get_sam3_tracker_service
from .sam3_pcs import get_sam3_pcs_service
from .uri_utils import detect_uri_type, download_s3_image, get_s3_client, parse_s3_uri

app = create_app()
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))

# Initialize cache (populated on startup)
cache = ImageCache()
total_images = 0


@app.on_event("startup")
async def startup_event():
    """Initialize cache on application startup."""
    global total_images

    # Clear any existing cache (important for reload scenarios)
    cache.clear()

    # Load dataset metadata and populate cache
    metadata = dataset.load_full_metadata()
    total_images = metadata["total_images"]

    if total_images > CACHE_SIZE:
        head_images, head_map, head_annot, head_indices = dataset.load_images_range(
            0, CACHE_HEAD
        )
        tail_images, tail_map, tail_annot, tail_indices = dataset.load_images_range(
            total_images - CACHE_TAIL, total_images
        )
        cache.update(
            head_images + tail_images,
            {**head_map, **tail_map},
            {**head_annot, **tail_annot},
            set(range(CACHE_HEAD))
            | set(range(total_images - CACHE_TAIL, total_images)),
        )
    else:
        images, image_map, annot_by_image, indices = dataset.load_images_range(
            0, total_images
        )
        cache.update(images, image_map, annot_by_image, indices)

    print(
        f"✅ Cache initialized with {len(cache.images)} images from {total_images} total"
    )


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up cache on application shutdown."""
    cache.clear()
    print("✅ Cache cleared on shutdown")


@app.middleware("http")
async def print_exceptions(request, call_next):
    try:
        return await call_next(request)
    except Exception:
        traceback.print_exc()
        raise


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main HTML page."""
    with open(Path(__file__).parent.parent / "templates" / "index.html", "r") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/image/{image_id}")
async def get_image(image_id: int):
    """Serve image file by ID with automatic resizing if needed.

    Images larger than MAX_IMAGE_DIMENSION on any side are resized
    in-memory to fit within MAX_IMAGE_DIMENSION while preserving aspect ratio.
    Original files are NOT modified.
    """
    image_data = cache.get_image_by_id(image_id)
    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    # Resolve to absolute path or URI
    image_uri = resolve_image_path(image_data["file_name"])
    uri_type = detect_uri_type(image_uri)

    if uri_type == "s3":
        return await serve_s3_image(image_uri)
    else:
        # Local file
        image_path = Path(image_uri)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image file not found")

        # Resize image if needed
        try:
            from .image_resize import resize_image_if_needed

            image_bytes, content_type = resize_image_if_needed(
                image_path, MAX_IMAGE_DIMENSION
            )
            return Response(
                content=image_bytes,
                media_type=content_type,
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
                },
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error processing image: {str(e)}"
            )


async def serve_s3_image(s3_uri: str):
    """Serve image from S3 with automatic resizing if needed.

    Images are downloaded from S3, resized in-memory if needed, and served.
    Original S3 files are NOT modified.
    """
    try:
        bucket, key = parse_s3_uri(s3_uri)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid S3 URI: {e}")

    s3_client = get_s3_client()

    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)

        # Read image data from S3
        image_data = obj["Body"].read()

        # Resize if needed
        from .image_resize import resize_image_if_needed

        image_bytes, content_type = resize_image_if_needed(
            image_data, MAX_IMAGE_DIMENSION
        )

        headers = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}

        return Response(content=image_bytes, media_type=content_type, headers=headers)
    except Exception as e:
        # Handle any S3 or image processing errors
        error_msg = str(e)
        if "NoSuchKey" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=f"S3 image not found: {s3_uri}")
        elif "NoSuchBucket" in error_msg:
            raise HTTPException(
                status_code=404, detail=f"S3 bucket not found in URI: {s3_uri}"
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to process image: {str(e)}"
            )

        headers = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}

        return Response(content=image_bytes, media_type=content_type, headers=headers)
    except s3_client.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail=f"S3 image not found: {s3_uri}")
    except s3_client.exceptions.NoSuchBucket:
        raise HTTPException(
            status_code=404, detail=f"S3 bucket not found in URI: {s3_uri}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch S3 image: {str(e)}"
        )


@app.get("/api/dataset")
async def get_dataset():
    """Get cached dataset information."""
    return JSONResponse(
        content={
            "images": cache.images,
            "image_map": cache.image_map,
            "annotations_by_image": cache.annotations_by_image,
            "cached_indices": list(cache.cached_indices),
            "total_images": total_images,
        },
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.post("/api/load-range")
async def load_range(request: LoadRangeRequest):
    """Load a specific range of images."""
    new_images, new_map, new_annot, new_indices = dataset.load_images_range(
        request.start, request.end
    )

    cache.update(new_images, new_map, new_annot, new_indices)

    return {"success": True}


@app.post("/api/delete-image")
async def delete_image(request: DeleteImageRequest):
    """Delete an image and its annotations."""
    global total_images

    if not request.confirmed:
        raise HTTPException(status_code=400, detail="Deletion not confirmed")

    try:
        dataset.delete_image(request.image_id)

        # Update cache
        cache.delete_image(request.image_id)

        # Update indices
        deleted_index = None
        for img in cache.images:
            if (
                img.get("index") is not None
                and deleted_index is not None
                and img["index"] > deleted_index
            ):
                img["index"] -= 1

        total_images -= 1

        return {"success": True, "deleted_image_id": request.image_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/segment")
async def segment_image(request: SegmentRequest):
    """Run SAM2 segmentation on an image."""
    print("\n" + "🟢" * 40)
    print("📥 RECEIVED SAM2 REQUEST")
    print(f"   Image ID: {request.image_id}")
    print(f"   Points: {request.points}")
    print(f"   Labels: {request.labels}")
    print(f"   Box: {request.box}")
    print("🟢" * 40 + "\n")

    # Find image
    image_data = cache.get_image_by_id(request.image_id)

    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    image_uri = resolve_image_path(image_data["file_name"])

    # For S3 images, download to local cache first (SAM needs local file)
    if detect_uri_type(image_uri) == "s3":
        image_path = download_s3_image(image_uri)
    else:
        image_path = Path(image_uri)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image file not found")

    try:
        sam2_service = get_sam2_service()
        segmentation = sam2_service.segment_image(
            image_path, points=request.points, labels=request.labels, box=request.box
        )

        return {"segmentation": segmentation}
    except Exception as e:
        print(f"❌ SAM2 ROUTE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/categories")
async def get_categories():
    """Get all categories."""
    categories = dataset.get_categories()
    return JSONResponse(
        content={"categories": categories},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.get("/api/annotations/{image_id}")
async def get_annotations(image_id: int):
    """Get all annotations for a specific image."""
    try:
        annotations = dataset.get_annotations_by_image(image_id)
        return JSONResponse(
            content={"annotations": annotations},
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save-annotation")
async def save_annotation(request: SaveAnnotationRequest):
    """Save a new annotation to the dataset.

    Note: bbox and area in the request are ignored - they are calculated by add_annotation().
    """
    try:
        # Note: add_annotation() calculates bbox and area automatically from segmentation
        annotation = dataset.add_annotation(
            request.image_id, request.category_id, request.segmentation
        )
        # Update cache with new annotation
        cache.add_annotation(request.image_id, annotation)
        return {"success": True, "annotation": annotation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save-annotations-batch")
async def save_annotations_batch(request: BatchSaveAnnotationsRequest):
    """Save multiple annotations at once (batch operation).

    This is much faster than making individual save-annotation requests
    when saving many masks at once.

    Note: bbox and area are calculated by add_annotation(), not passed in.
    """
    try:
        print(f"📦 Batch save: Received {len(request.annotations)} annotations")
        saved_annotations = []

        # Save all annotations
        for i, ann_request in enumerate(request.annotations):
            print(
                f"  Annotation {i + 1}/{len(request.annotations)}: "
                f"image_id={ann_request.image_id}, "
                f"category_id={ann_request.category_id}"
            )
            # Note: add_annotation() calculates bbox and area automatically
            annotation = dataset.add_annotation(
                ann_request.image_id, ann_request.category_id, ann_request.segmentation
            )
            # Update cache with new annotation
            cache.add_annotation(ann_request.image_id, annotation)
            saved_annotations.append(annotation)

        print(f"✅ Successfully saved {len(saved_annotations)} annotations")
        return {
            "success": True,
            "count": len(saved_annotations),
            "annotations": saved_annotations,
        }
    except Exception as e:
        print(f"❌ Batch save error: {type(e).__name__}: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/add-category")
async def add_category(request: AddCategoryRequest):
    """Add a new category."""
    try:
        new_category = dataset.add_category(request.name, request.supercategory)
        return {"success": True, "category": new_category}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/update-category")
async def update_category(request: UpdateCategoryRequest):
    """Update an existing category."""
    try:
        dataset.update_category(request.id, request.name, request.supercategory)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/delete-category")
async def delete_category(request: DeleteCategoryRequest):
    """Delete a category."""
    try:
        dataset.delete_category(request.id)
        return {"success": True}
    except CategoryInUseError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/update-annotation")
async def update_annotation(request: UpdateAnnotationRequest):
    """Update an annotation's category."""
    try:
        updated_annotation = dataset.update_annotation(
            request.annotation_id, request.category_id
        )

        cache.update_annotation(request.annotation_id, updated_annotation)

        return {"success": True, "annotation": updated_annotation}
    except AnnotationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/delete-annotation")
async def delete_annotation(request: DeleteAnnotationRequest):
    """Delete an annotation."""
    if not request.confirmed:
        raise HTTPException(status_code=400, detail="Deletion not confirmed")

    try:
        dataset.delete_annotation(request.annotation_id)

        # Update cache
        cache.delete_annotation(request.annotation_id)

        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model-info")
async def get_model_info():
    """Get current model information."""
    sam2_service = get_sam2_service()
    return {
        "current_model": sam2_service.model_id,
        "available_sizes": list(SAM2_MODEL_SIZES.keys()),
        "device": sam2_service.device,
    }


@app.post("/api/set-model-size")
async def set_model_size(request: SetModelSizeRequest):
    """Change SAM2 model size."""
    if request.model_size not in SAM2_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model size. Available: {list(SAM2_MODEL_SIZES.keys())}",
        )

    try:
        sam2_service = get_sam2_service()
        model_id = SAM2_MODEL_SIZES[request.model_size]
        sam2_service.reload_model(model_id)
        return {"success": True, "model_id": model_id, "model_size": request.model_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/segment-sam3")
async def segment_image_sam3(request: SegmentRequest):
    """Run SAM3 Tracker segmentation on an image."""
    print("\n" + "🔵" * 40)
    print("📥 RECEIVED SAM3 TRACKER REQUEST")
    print(f"   Image ID: {request.image_id}")
    print(f"   Points: {request.points}")
    print(f"   Labels: {request.labels}")
    print(f"   Single box: {request.box}")
    print(f"   Multiple boxes: {request.boxes}")
    print(f"   Box labels: {request.box_labels}")
    print("🔵" * 40 + "\n")

    # Find image
    image_data = cache.get_image_by_id(request.image_id)

    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    image_uri = resolve_image_path(image_data["file_name"])

    # For S3 images, download to local cache first (SAM needs local file)
    if detect_uri_type(image_uri) == "s3":
        image_path = download_s3_image(image_uri)
    else:
        image_path = Path(image_uri)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image file not found")

    try:
        sam3_tracker_service = get_sam3_tracker_service()
        segmentation = sam3_tracker_service.segment_image(
            image_path,
            points=request.points,
            labels=request.labels,
            box=request.box,
            boxes=request.boxes,
            box_labels=request.box_labels,
        )

        return {"segmentation": segmentation}
    except Exception as e:
        print(f"❌ SAM3 TRACKER ROUTE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model-info-sam3")
async def get_model_info_sam3():
    """Get current SAM3 model information."""
    sam3_tracker_service = get_sam3_tracker_service()
    return {
        "current_model": sam3_tracker_service.model_id,
        "available_sizes": list(SAM3_MODEL_SIZES.keys()),
        "device": sam3_tracker_service.device,
    }


@app.post("/api/set-model-size-sam3")
async def set_model_size_sam3(request: SetModelSizeRequest):
    """Change SAM3 model size."""
    if request.model_size not in SAM3_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model size. Available: {list(SAM3_MODEL_SIZES.keys())}",
        )

    try:
        sam3_tracker_service = get_sam3_tracker_service()
        model_id = SAM3_MODEL_SIZES[request.model_size]
        sam3_tracker_service.reload_model(model_id)
        return {"success": True, "model_id": model_id, "model_size": request.model_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/segment-sam3-pcs")
async def segment_image_sam3_pcs(request: SegmentRequestPCS):
    """Run SAM3 PCS (Promptable Concept Segmentation) on an image.

    PCS finds ALL instances of a concept using:
    - Text prompts (e.g., "laptop", "ear", "handle")
    - Visual prompts (boxes with positive/negative labels)
    - Combined prompts (text + negative boxes for refinement)
    """
    print("\n" + "🟣" * 40)
    print("📥 RECEIVED SAM3 PCS REQUEST")
    print(f"   Image ID: {request.image_id}")
    print(f"   Text: '{request.text}'" if request.text else "   Text: None")
    print(f"   Boxes: {request.boxes}")
    print(f"   Box labels: {request.box_labels}")
    print("🟣" * 40 + "\n")

    # Find image
    image_data = cache.get_image_by_id(request.image_id)

    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    image_uri = resolve_image_path(image_data["file_name"])

    # For S3 images, download to local cache first (SAM needs local file)
    if detect_uri_type(image_uri) == "s3":
        image_path = download_s3_image(image_uri)
    else:
        image_path = Path(image_uri)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image file not found")

    # Validate that at least one prompt type is provided
    if not request.text and not request.boxes:
        raise HTTPException(
            status_code=400, detail="SAM3 PCS requires either text or boxes prompt"
        )

    try:
        sam3_pcs_service = get_sam3_pcs_service()
        segmentation = sam3_pcs_service.segment_image(
            image_path,
            text=request.text,
            boxes=request.boxes,
            box_labels=request.box_labels,
        )

        return {"segmentation": segmentation}
    except Exception as e:
        print(f"❌ SAM3 PCS ROUTE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model-info-sam3-pcs")
async def get_model_info_sam3_pcs():
    """Get current SAM3 PCS model information."""
    sam3_pcs_service = get_sam3_pcs_service()
    return {
        "current_model": sam3_pcs_service.model_id,
        "available_sizes": list(SAM3_PCS_MODEL_SIZES.keys()),
        "device": sam3_pcs_service.device,
    }


@app.post("/api/set-model-size-sam3-pcs")
async def set_model_size_sam3_pcs(request: SetModelSizeRequest):
    """Change SAM3 PCS model size."""
    if request.model_size not in SAM3_PCS_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model size. Available: {list(SAM3_PCS_MODEL_SIZES.keys())}",
        )

    try:
        sam3_pcs_service = get_sam3_pcs_service()
        model_id = SAM3_PCS_MODEL_SIZES[request.model_size]
        sam3_pcs_service.reload_model(model_id)
        return {"success": True, "model_id": model_id, "model_size": request.model_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# S3 Support Endpoints


@app.get("/api/dataset-info")
async def get_dataset_info():
    """Get dataset source information including dirty state."""
    return {
        "source_uri": DATASET_URI,
        "is_s3": DATASET_IS_S3,
        "can_save_to_s3": DATASET_IS_S3,
        "is_dirty": dataset.get_s3_dirty_status() if DATASET_IS_S3 else False,
    }


@app.post("/api/save-to-s3")
async def save_to_s3():
    """Upload local cached dataset back to S3."""
    if not DATASET_IS_S3:
        raise HTTPException(
            status_code=400, detail="Cannot save to S3: dataset is not from S3"
        )

    try:
        result = dataset.save_dataset_to_s3()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save to S3: {str(e)}")
