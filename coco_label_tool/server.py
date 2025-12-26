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
    parser.add_argument(
        "--auto-label-config",
        type=str,
        default=None,
        help="Path to auto-labeling YAML config file.",
    )
    args = parser.parse_args()

    print(f"Using COCO file: {args.coco_file}")
    os.environ["DATASET_PATH"] = args.coco_file

    if args.auto_label_config:
        os.environ["AUTO_LABEL_CONFIG"] = args.auto_label_config
        print(f"Using auto-label config: {args.auto_label_config}")

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
