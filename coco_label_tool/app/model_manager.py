"""Centralized model management with inactivity-based unloading."""

import asyncio
import logging
import time
from typing import Callable

from .config import MODEL_CHECK_INTERVAL, MODEL_INACTIVITY_TIMEOUT

logger = logging.getLogger(__name__)


class ModelManager:
    """Manages model lifecycle with automatic unloading after inactivity.

    All model-related endpoints should call `record_activity()` to reset the
    inactivity timer. After `inactivity_timeout` seconds of no activity,
    all loaded models are unloaded to free GPU memory.

    Models are registered with `register_model()` which provides:
    - A function to check if the model is loaded
    - A function to clear/unload the model
    """

    def __init__(
        self,
        inactivity_timeout: int = MODEL_INACTIVITY_TIMEOUT,
        check_interval: int = MODEL_CHECK_INTERVAL,
    ):
        self.inactivity_timeout = inactivity_timeout
        self.check_interval = check_interval
        self.last_activity: float = 0.0  # 0 = no activity yet
        self._monitor_task: asyncio.Task | None = None
        self._is_loaded_checkers: dict[str, Callable[[], bool]] = {}
        self._clear_functions: dict[str, Callable[[], None]] = {}

    def register_model(
        self,
        name: str,
        is_loaded_fn: Callable[[], bool],
        clear_fn: Callable[[], None],
    ) -> None:
        """Register a model's status check and clear functions.

        Args:
            name: Model identifier (e.g., "sam2", "sam3", "sam3_pcs")
            is_loaded_fn: Function that returns True if model is loaded
            clear_fn: Function that unloads/clears the model from memory
        """
        self._is_loaded_checkers[name] = is_loaded_fn
        self._clear_functions[name] = clear_fn
        logger.debug(f"Registered model: {name}")

    def record_activity(self) -> None:
        """Record model-related activity (resets inactivity timer)."""
        self.last_activity = time.time()
        logger.debug(f"Model activity recorded at {self.last_activity}")

    def get_loaded_models(self) -> dict[str, bool]:
        """Return dict of model names to their loaded status.

        This does NOT trigger model loading - it only checks current state.
        """
        return {name: fn() for name, fn in self._is_loaded_checkers.items()}

    def unload_all_models(self) -> dict[str, bool]:
        """Unload all models to free memory.

        Returns:
            Dict mapping model name to whether it was unloaded (True if it was
            loaded and is now unloaded, False if it wasn't loaded).
        """
        unloaded = {}
        for name, clear_fn in self._clear_functions.items():
            was_loaded = self._is_loaded_checkers[name]()
            if was_loaded:
                logger.info(f"Unloading {name} model...")
                clear_fn()
                unloaded[name] = True
            else:
                unloaded[name] = False
        return unloaded

    async def start_monitor(self) -> None:
        """Start the background inactivity monitor."""
        if self._monitor_task is not None:
            return
        self._monitor_task = asyncio.create_task(self._inactivity_monitor())
        logger.info(
            f"Model inactivity monitor started "
            f"(timeout={self.inactivity_timeout}s, check_interval={self.check_interval}s)"
        )

    async def stop_monitor(self) -> None:
        """Stop the background inactivity monitor."""
        if self._monitor_task is not None:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None
            logger.info("Model inactivity monitor stopped")

    async def _inactivity_monitor(self) -> None:
        """Background task that checks for inactivity and unloads models."""
        while True:
            await asyncio.sleep(self.check_interval)

            # Skip if no activity has ever occurred
            if self.last_activity == 0.0:
                continue

            # Check if inactive for longer than timeout
            elapsed = time.time() - self.last_activity
            if elapsed >= self.inactivity_timeout:
                loaded = self.get_loaded_models()
                any_loaded = any(loaded.values())

                if any_loaded:
                    loaded_names = [k for k, v in loaded.items() if v]
                    logger.info(
                        f"Model inactivity timeout ({elapsed:.0f}s >= {self.inactivity_timeout}s). "
                        f"Unloading models: {loaded_names}"
                    )
                    self.unload_all_models()
                    # Reset activity to prevent repeated unload attempts
                    self.last_activity = 0.0


# Singleton instance
model_manager = ModelManager()
