"""Graceful shutdown handling for the application.

This module provides functions to:
1. Clear all ML models from GPU memory
2. Kill any processes remaining on the server port
3. Handle SIGTERM/SIGINT signals gracefully
"""

import gc
import signal
import subprocess
import sys
from typing import Callable

import torch


def clear_all_models() -> None:
    """Clear all loaded ML models from GPU memory.

    Clears SAM2, SAM3 Tracker, and SAM3 PCS services if they are loaded,
    then runs garbage collection and clears CUDA cache if available.
    """
    print("Clearing all models from GPU memory...")

    # Import here to avoid circular imports and config validation at import time
    from coco_label_tool.app import sam2, sam3, sam3_pcs

    try:
        sam2.clear_sam2_service()
        sam3.clear_sam3_tracker_service()
        sam3_pcs.clear_sam3_pcs_service()
    except Exception as e:
        print(f"Warning: Error clearing model services: {e}")

    # Force garbage collection
    gc.collect()

    # Clear CUDA cache if available
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        print("CUDA cache cleared")

    print("All models cleared from memory")


def kill_processes_on_port(port: int) -> None:
    """Kill any processes listening on the specified port.

    Uses platform-specific commands:
    - Linux: fuser -k <port>/tcp
    - macOS: lsof + kill

    Args:
        port: The port number to clear
    """
    print(f"Killing any processes on port {port}...")

    try:
        if sys.platform == "linux":
            # Try fuser first (more reliable on Linux)
            try:
                subprocess.run(
                    ["fuser", "-k", f"{port}/tcp"],
                    capture_output=True,
                    timeout=5,
                )
            except FileNotFoundError:
                # fuser not available, try lsof + kill
                _kill_with_lsof(port)
        elif sys.platform == "darwin":
            # macOS uses lsof
            _kill_with_lsof(port)
        else:
            # Windows or other platforms - try lsof anyway
            _kill_with_lsof(port)

        print(f"Cleared processes on port {port}")
    except Exception as e:
        print(f"Warning: Could not clear port {port}: {e}")


def _kill_with_lsof(port: int) -> None:
    """Kill processes on port using lsof (cross-platform fallback)."""
    try:
        # Find PIDs listening on the port
        result = subprocess.run(
            ["lsof", "-t", f"-i:{port}"],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split("\n")
            for pid in pids:
                if pid:
                    try:
                        subprocess.run(
                            ["kill", "-9", pid],
                            capture_output=True,
                            timeout=5,
                        )
                    except Exception:
                        pass
    except FileNotFoundError:
        # lsof not available
        print("Warning: Neither fuser nor lsof available to clear port")
    except subprocess.TimeoutExpired:
        print("Warning: Timeout while trying to clear port")


def graceful_shutdown(port: int) -> None:
    """Perform graceful shutdown: clear models, then kill port processes.

    Args:
        port: The port the server was listening on
    """
    print("\n" + "=" * 60)
    print("GRACEFUL SHUTDOWN INITIATED")
    print("=" * 60)

    # Step 1: Clear all models from GPU memory
    try:
        clear_all_models()
    except Exception as e:
        print(f"Warning: Error during model cleanup: {e}")

    # Step 2: Kill any remaining processes on the port
    try:
        kill_processes_on_port(port)
    except Exception as e:
        print(f"Warning: Error killing port processes: {e}")

    print("=" * 60)
    print("GRACEFUL SHUTDOWN COMPLETE")
    print("=" * 60 + "\n")


def setup_signal_handlers(port: int) -> Callable:
    """Set up signal handlers for graceful shutdown.

    Registers handlers for SIGTERM and SIGINT that will:
    1. Clear all ML models from GPU memory
    2. Kill any processes on the server port
    3. Exit cleanly

    Args:
        port: The port the server is listening on

    Returns:
        The signal handler function (for testing)
    """

    def signal_handler(signum: int, frame) -> None:
        """Handle shutdown signals."""
        sig_name = signal.Signals(signum).name
        print(f"\nReceived {sig_name}, initiating graceful shutdown...")

        graceful_shutdown(port)

        sys.exit(0)

    # Register handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    print(f"Signal handlers registered for graceful shutdown (port {port})")

    return signal_handler
