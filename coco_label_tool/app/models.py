"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class SegmentRequest(BaseModel):
    image_id: int
    points: Optional[List[List[float]]] = None
    labels: Optional[List[int]] = None
    box: Optional[List[float]] = None  # Single box (backward compatible)
    boxes: Optional[List[List[float]]] = None  # Multiple boxes
    box_labels: Optional[List[int]] = (
        None  # Labels for multiple boxes (1=positive, 0=negative)
    )


class SaveAnnotationRequest(BaseModel):
    image_id: int
    category_id: int
    segmentation: List[List[float]]
    bbox: Optional[List[float]] = None
    area: Optional[float] = None


class BatchSaveAnnotationsRequest(BaseModel):
    """Request model for saving multiple annotations at once."""

    annotations: List[SaveAnnotationRequest]


class UpdateAnnotationRequest(BaseModel):
    annotation_id: int
    category_id: int


class DeleteAnnotationRequest(BaseModel):
    annotation_id: int
    confirmed: bool


class DeleteImageRequest(BaseModel):
    image_id: int
    confirmed: bool


class LoadRangeRequest(BaseModel):
    start: int
    end: int


class AddCategoryRequest(BaseModel):
    name: str
    supercategory: str = "none"


class UpdateCategoryRequest(BaseModel):
    id: int
    name: str
    supercategory: str = "none"


class DeleteCategoryRequest(BaseModel):
    id: int


class SetModelSizeRequest(BaseModel):
    model_size: str


class AutoLabelRequest(BaseModel):
    """Request to auto-label an image using external server."""

    image_id: int
    endpoint_name: str


class SegmentRequestPCS(BaseModel):
    image_id: int
    text: Optional[str] = None  # Text prompt for concept search
    boxes: Optional[List[List[float]]] = None  # Multiple boxes
    box_labels: Optional[List[int]] = None  # Labels for boxes (1=positive, 0=negative)


# Gallery View Models


class GalleryDataRequest(BaseModel):
    """Request parameters for gallery data endpoint."""

    page: int = Field(default=0, ge=0, description="Page number (0-indexed)")
    page_size: int = Field(
        default=50, ge=1, le=200, description="Number of items per page"
    )
    filter: str = Field(
        default="all",
        pattern="^(all|annotated|unannotated)$",
        description="Filter: all, annotated, or unannotated",
    )
    sort: str = Field(
        default="index",
        pattern="^(index|filename|annotations_asc|annotations_desc)$",
        description="Sort order",
    )


class GalleryImageData(BaseModel):
    """Single image data for gallery view."""

    id: int
    index: int
    file_name: str
    width: int
    height: int
    annotation_counts: Dict[str, int] = Field(
        default_factory=dict,
        description="Annotation counts by type: {object_detection: 5, captioning: 2}",
    )
    total_annotations: int = Field(default=0, description="Total annotation count")


class GalleryDataResponse(BaseModel):
    """Response for gallery data endpoint."""

    images: List[GalleryImageData]
    total_images: int = Field(description="Total images in dataset")
    total_filtered: int = Field(description="Total images matching filter")
    page: int
    page_size: int
    has_more: bool = Field(description="Whether more pages are available")
