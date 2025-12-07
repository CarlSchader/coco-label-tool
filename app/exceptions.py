"""Custom exceptions for the application."""


class DatasetError(Exception):
    """Base exception for dataset operations."""

    pass


class ImageNotFoundError(DatasetError):
    """Raised when an image is not found."""

    pass


class AnnotationNotFoundError(DatasetError):
    """Raised when an annotation is not found."""

    pass


class CategoryNotFoundError(DatasetError):
    """Raised when a category is not found."""

    pass


class CategoryInUseError(DatasetError):
    """Raised when attempting to delete a category that is in use."""

    pass


class SegmentationError(Exception):
    """Raised when SAM2 segmentation fails."""

    pass
