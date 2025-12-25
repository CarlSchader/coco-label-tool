"""Main application entry point."""

import argparse
import os

import uvicorn

from coco_label_tool.shutdown import setup_signal_handlers


def main():
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument(
        "coco_file",
        type=str,
        help="Path to the COCO json file.",
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Host to run the server on."
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to run the server on."
    )
    parser.add_argument(
        "--reload", action="store_true", help="Enable auto-reload for development."
    )
    parser.add_argument("--log-level", type=str, default="info", help="Logging level.")
    args = parser.parse_args()

    print(f"Using COCO file: {args.coco_file}")
    os.environ["DATASET_PATH"] = args.coco_file

    # Set up graceful shutdown handlers for SIGTERM/SIGINT
    setup_signal_handlers(args.port)

    uvicorn.run(
        "coco_label_tool.app.routes:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
