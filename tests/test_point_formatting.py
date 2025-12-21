"""
Unit tests for point formatting utility
Tests the format_points_for_sam3 function in isolation
"""

import pytest
from pathlib import Path
import importlib.util

# Load module directly from file, bypassing package imports
module_path = Path(__file__).parent.parent / "coco_label_tool" / "app" / "sam3_utils.py"
spec = importlib.util.spec_from_file_location("sam3_utils", module_path)
sam3_utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sam3_utils)

format_points_for_sam3 = sam3_utils.format_points_for_sam3


def test_single_object_single_point():
    """Single object with one point"""
    points = [[100, 200]]
    labels = [1]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=1
    )

    assert formatted_points == [[[[100, 200]]]]
    assert formatted_labels == [[[1]]]


def test_single_object_multiple_points():
    """Single object with multiple points for refinement"""
    points = [[100, 200], [300, 400]]
    labels = [1, 0]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=1
    )

    assert formatted_points == [[[[100, 200], [300, 400]]]]
    assert formatted_labels == [[[1, 0]]]


def test_multiple_objects_single_point_each():
    """Multiple objects, one point per object"""
    points = [[100, 200], [500, 600]]
    labels = [1, 1]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=2
    )

    assert formatted_points == [[[[100, 200]], [[500, 600]]]]
    assert formatted_labels == [[[1], [1]]]


def test_multiple_objects_multiple_points_each():
    """Multiple objects, multiple points per object (pre-grouped)"""
    points = [[[100, 200], [150, 250]], [[500, 600], [550, 650]]]
    labels = [[1, 0], [1, 1]]

    formatted_points, formatted_labels = format_points_for_sam3(
        points, labels, num_objects=2
    )

    assert formatted_points == [[[[100, 200], [150, 250]], [[500, 600], [550, 650]]]]
    assert formatted_labels == [[[1, 0], [1, 1]]]


def test_empty_points():
    """Handle empty points"""
    formatted_points, formatted_labels = format_points_for_sam3([], [], num_objects=0)

    assert formatted_points is None
    assert formatted_labels is None


def test_none_input():
    """Handle None input"""
    formatted_points, formatted_labels = format_points_for_sam3(
        None, None, num_objects=0
    )

    assert formatted_points is None
    assert formatted_labels is None


def test_mismatched_lengths():
    """Points and labels must have same length"""
    points = [[100, 200], [300, 400]]
    labels = [1]

    with pytest.raises(ValueError, match="Points and labels must have same length"):
        format_points_for_sam3(points, labels, num_objects=1)
