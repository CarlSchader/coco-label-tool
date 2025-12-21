"""Application package initialization."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import DATASET_DIR, DATASET_IS_S3


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="Label Tool", version="1.0.0", debug=True)

    # Mount static files
    static_path = Path(__file__).parent.parent / "static"
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

    # Mount dataset directory for local datasets only
    # S3 images are served via /api/image/{id} endpoint
    if DATASET_DIR is not None and DATASET_DIR.exists():
        app.mount("/dataset", StaticFiles(directory=str(DATASET_DIR)), name="dataset")
    elif DATASET_IS_S3:
        print("S3 mode: Images served via /api/image/{id} endpoint")

    return app
