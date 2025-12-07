"""
Tests for SAM3 Tracker multi-object point prompts
Following HuggingFace docs format requirements
"""

import pytest


def test_format_points_single_object_single_point():
    """Single object with one point"""
    from app.sam3 import format_points_for_sam3

    points = [[100, 200]]  # One point
    labels = [1]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=1
    )

    # Expected: [[[[100, 200]]]]
    assert formatted_points == [[[[100, 200]]]]
    assert formatted_labels == [[[1]]]


def test_format_points_single_object_multiple_points():
    """Single object with multiple points for refinement"""
    from app.sam3 import format_points_for_sam3

    points = [[100, 200], [300, 400]]  # Two points
    labels = [1, 0]  # Positive and negative

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=1
    )

    # Expected: [[[[100, 200], [300, 400]]]] - points at same nesting level
    assert formatted_points == [[[[100, 200], [300, 400]]]]
    assert formatted_labels == [[[1, 0]]]


def test_format_points_multiple_objects_single_point_each():
    """Multiple objects, one point per object"""
    from app.sam3 import format_points_for_sam3

    points = [[100, 200], [500, 600]]  # Two points
    labels = [1, 1]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=2
    )

    # Expected: [[[[100, 200]], [[500, 600]]]] - each object wrapped separately
    assert formatted_points == [[[[100, 200]], [[500, 600]]]]
    assert formatted_labels == [[[1], [1]]]


def test_format_points_multiple_objects_multiple_points_each():
    """Multiple objects, multiple points per object"""
    from app.sam3 import format_points_for_sam3

    # Object 1: 2 points, Object 2: 2 points
    points = [
        [[100, 200], [150, 250]],  # Object 1
        [[500, 600], [550, 650]],  # Object 2
    ]
    labels = [
        [1, 0],  # Object 1: positive, negative
        [1, 1],  # Object 2: both positive
    ]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=2
    )

    # Expected: [[[[100,200],[150,250]], [[500,600],[550,650]]]]
    assert formatted_points == [[[[100, 200], [150, 250]], [[500, 600], [550, 650]]]]
    assert formatted_labels == [[[1, 0], [1, 1]]]


def test_format_points_with_boxes_single_object():
    """Points with box for single object"""
    from app.sam3 import format_points_for_sam3

    points = [[100, 200], [150, 250]]
    labels = [1, 1]

    # When we have a box, points should refine that box (single object)
    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=1
    )

    assert formatted_points == [[[[100, 200], [150, 250]]]]
    assert formatted_labels == [[[1, 1]]]


def test_format_points_empty():
    """Handle empty points"""
    from app.sam3 import format_points_for_sam3

    formatted_points, formatted_labels = format_points_for_sam3([], [], num_objects=0)

    assert formatted_points is None
    assert formatted_labels is None


def test_format_points_none():
    """Handle None input"""
    from app.sam3 import format_points_for_sam3

    formatted_points, formatted_labels = format_points_for_sam3(
        None, None, num_objects=0
    )

    assert formatted_points is None
    assert formatted_labels is None


def test_format_points_mismatched_lengths():
    """Points and labels must have same length"""
    from app.sam3 import format_points_for_sam3

    points = [[100, 200], [300, 400]]
    labels = [1]  # Only 1 label for 2 points

    with pytest.raises(ValueError, match="Points and labels must have same length"):
        format_points_for_sam3(points, labels, num_objects=1)
