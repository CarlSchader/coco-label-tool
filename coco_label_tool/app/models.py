"""Pydantic models for request/response validation."""

from pydantic import BaseModel
from typing import List, Optional


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


class SegmentRequestPCS(BaseModel):
    image_id: int
    text: Optional[str] = None  # Text prompt for concept search
    boxes: Optional[List[List[float]]] = None  # Multiple boxes
    box_labels: Optional[List[int]] = None  # Labels for boxes (1=positive, 0=negative)
