"""
Utility functions for SAM3 Tracker that don't require model loading.
This module can be imported without triggering config checks.
"""

from typing import List, Tuple, Optional


def format_points_for_sam3(
    points: Optional[List], labels: Optional[List], num_objects: int
) -> Tuple[Optional[List], Optional[List]]:
    """
    Format points and labels for SAM3 Tracker based on number of objects.

    SAM3 Tracker supports two modes:
    1. Single object with multiple points (refinement):
       points = [[[[pt1], [pt2]]]] - points at same nesting level
    2. Multiple objects with points per object:
       points = [[[[pt1]], [[pt2]]]] - each object wrapped separately

    Args:
        points: List of points [[x, y], ...] or [[[x, y], ...], [[x, y], ...]]
        labels: List of labels [1, 0, ...] or [[1, 0], [1, 0]]
        num_objects: Number of objects to segment

    Returns:
        Tuple of (formatted_points, formatted_labels) with correct nesting

    Examples:
        # Single object, 2 points
        >>> format_points_for_sam3([[100, 200], [300, 400]], [1, 0], num_objects=1)
        ([[[[100, 200], [300, 400]]]], [[[1, 0]]])

        # Two objects, 1 point each
        >>> format_points_for_sam3([[100, 200], [300, 400]], [1, 1], num_objects=2)
        ([[[[100, 200]], [[300, 400]]]], [[[1], [1]]])
    """
    if points is None or labels is None or num_objects == 0:
        return None, None

    if len(points) == 0 or len(labels) == 0:
        return None, None

    # Validate input
    if num_objects == 1:
        # Single object mode: points should be list of [x, y]
        if not isinstance(points[0], list) or len(points[0]) != 2:
            raise ValueError("For single object, points should be [[x, y], ...]")
        if len(points) != len(labels):
            raise ValueError("Points and labels must have same length")

        # Format: [[[[pt1], [pt2], ...]]] - all points for one object
        formatted_points = [[points]]
        formatted_labels = [[labels]]

    else:
        # Multi-object mode
        if not isinstance(points[0], list):
            raise ValueError(
                "For multiple objects, points should be [[[x,y],...], [[x,y],...]]"
            )

        # Check if points are already grouped by object
        if isinstance(points[0][0], list) and len(points[0][0]) == 2:
            # Format: [[[x,y],[x,y]], [[x,y],[x,y]]] - already grouped
            if len(points) != num_objects or len(labels) != num_objects:
                raise ValueError(
                    f"Expected {num_objects} objects, got {len(points)} point groups"
                )
            formatted_points = [points]
            formatted_labels = [labels]
        else:
            # Format: [[x,y], [x,y]] - not grouped, one point per object
            if len(points) != num_objects or len(labels) != num_objects:
                raise ValueError(
                    f"Expected {num_objects} objects, got {len(points)} points"
                )

            # Wrap each point as separate object: [[[[pt1]], [[pt2]]]]
            formatted_points = [[[pt] for pt in points]]
            formatted_labels = [[[label] for label in labels]]

    return formatted_points, formatted_labels
