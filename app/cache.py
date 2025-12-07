from typing import Dict, List, Set
from dataclasses import dataclass, field


@dataclass
class ImageCache:
    images: List[Dict] = field(default_factory=list)
    image_map: Dict[int, Dict] = field(default_factory=dict)
    annotations_by_image: Dict[int, List] = field(default_factory=dict)
    cached_indices: Set[int] = field(default_factory=set)

    def update(
        self,
        new_images: List[Dict],
        new_map: Dict[int, Dict],
        new_annot: Dict[int, List],
        new_indices: Set[int],
    ) -> None:
        self.images = new_images
        self.image_map = new_map
        self.annotations_by_image = new_annot
        self.cached_indices = new_indices

    def add_annotation(self, image_id: int, annotation: Dict) -> None:
        if image_id not in self.annotations_by_image:
            self.annotations_by_image[image_id] = []
        self.annotations_by_image[image_id].append(annotation)

    def update_annotation(self, annotation_id: int, updated_annotation: Dict) -> None:
        for image_id, annotations in self.annotations_by_image.items():
            for i, ann in enumerate(annotations):
                if ann["id"] == annotation_id:
                    annotations[i] = updated_annotation
                    return

    def delete_annotation(self, annotation_id: int) -> None:
        for image_id in self.annotations_by_image:
            self.annotations_by_image[image_id] = [
                ann
                for ann in self.annotations_by_image[image_id]
                if ann["id"] != annotation_id
            ]

    def delete_image(self, image_id: int) -> None:
        self.images = [img for img in self.images if img["id"] != image_id]

        if image_id in self.annotations_by_image:
            del self.annotations_by_image[image_id]

    def get_image_by_id(self, image_id: int) -> Dict | None:
        for img in self.images:
            if img["id"] == image_id:
                return img
        return None

    def clear(self) -> None:
        self.images = []
        self.image_map = {}
        self.annotations_by_image = {}
        self.cached_indices = set()
