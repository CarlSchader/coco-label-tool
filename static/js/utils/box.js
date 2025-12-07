export function detectBoxInteraction(mouseX, mouseY, box, scaleX, scaleY) {
  if (!box) return null;

  const x1 = box.x1 / scaleX;
  const y1 = box.y1 / scaleY;
  const x2 = box.x2 / scaleX;
  const y2 = box.y2 / scaleY;

  const edgeThreshold = 8;
  const cornerThreshold = 12;

  const nearLeft = Math.abs(mouseX - x1) <= edgeThreshold;
  const nearRight = Math.abs(mouseX - x2) <= edgeThreshold;
  const nearTop = Math.abs(mouseY - y1) <= edgeThreshold;
  const nearBottom = Math.abs(mouseY - y2) <= edgeThreshold;

  const insideX = mouseX >= x1 && mouseX <= x2;
  const insideY = mouseY >= y1 && mouseY <= y2;

  if (
    nearLeft &&
    nearTop &&
    Math.abs(mouseX - x1) <= cornerThreshold &&
    Math.abs(mouseY - y1) <= cornerThreshold
  ) {
    return { type: 'corner', corner: 'nw' };
  }
  if (
    nearRight &&
    nearTop &&
    Math.abs(mouseX - x2) <= cornerThreshold &&
    Math.abs(mouseY - y1) <= cornerThreshold
  ) {
    return { type: 'corner', corner: 'ne' };
  }
  if (
    nearLeft &&
    nearBottom &&
    Math.abs(mouseX - x1) <= cornerThreshold &&
    Math.abs(mouseY - y2) <= cornerThreshold
  ) {
    return { type: 'corner', corner: 'sw' };
  }
  if (
    nearRight &&
    nearBottom &&
    Math.abs(mouseX - x2) <= cornerThreshold &&
    Math.abs(mouseY - y2) <= cornerThreshold
  ) {
    return { type: 'corner', corner: 'se' };
  }

  if (nearLeft && insideY) {
    return { type: 'edge', edge: 'left' };
  }
  if (nearRight && insideY) {
    return { type: 'edge', edge: 'right' };
  }
  if (nearTop && insideX) {
    return { type: 'edge', edge: 'top' };
  }
  if (nearBottom && insideX) {
    return { type: 'edge', edge: 'bottom' };
  }

  if (insideX && insideY) {
    return { type: 'move' };
  }

  return null;
}

export function calculateBoxResize(mode, data, currentX, currentY) {
  if (!mode || !data) return null;

  if (mode === 'move') {
    const dx = currentX - data.startX;
    const dy = currentY - data.startY;

    return {
      x1: data.originalBox.x1 + dx,
      y1: data.originalBox.y1 + dy,
      x2: data.originalBox.x2 + dx,
      y2: data.originalBox.y2 + dy,
    };
  } else if (mode === 'corner') {
    const newBox = { ...data.originalBox };

    if (data.corner === 'nw') {
      newBox.x1 = currentX;
      newBox.y1 = currentY;
    } else if (data.corner === 'ne') {
      newBox.x2 = currentX;
      newBox.y1 = currentY;
    } else if (data.corner === 'sw') {
      newBox.x1 = currentX;
      newBox.y2 = currentY;
    } else if (data.corner === 'se') {
      newBox.x2 = currentX;
      newBox.y2 = currentY;
    }

    return normalizeBox(newBox);
  } else if (mode === 'edge') {
    const newBox = { ...data.originalBox };

    if (data.edge === 'left') {
      newBox.x1 = currentX;
    } else if (data.edge === 'right') {
      newBox.x2 = currentX;
    } else if (data.edge === 'top') {
      newBox.y1 = currentY;
    } else if (data.edge === 'bottom') {
      newBox.y2 = currentY;
    }

    return normalizeBox(newBox);
  }

  return null;
}

export function normalizeBox(box) {
  const normalized = { ...box };

  if (normalized.x1 > normalized.x2) {
    [normalized.x1, normalized.x2] = [normalized.x2, normalized.x1];
  }
  if (normalized.y1 > normalized.y2) {
    [normalized.y1, normalized.y2] = [normalized.y2, normalized.y1];
  }

  return normalized;
}

export function getCursorForBoxInteraction(interaction) {
  if (!interaction) return 'crosshair';

  if (interaction.type === 'move') {
    return 'move';
  } else if (interaction.type === 'corner') {
    if (interaction.corner === 'nw' || interaction.corner === 'se') {
      return 'nwse-resize';
    } else {
      return 'nesw-resize';
    }
  } else if (interaction.type === 'edge') {
    if (interaction.edge === 'left' || interaction.edge === 'right') {
      return 'ew-resize';
    } else {
      return 'ns-resize';
    }
  }

  return 'crosshair';
}

export function calculateDragBox(startX, startY, currentX, currentY) {
  return {
    x1: Math.min(startX, currentX),
    y1: Math.min(startY, currentY),
    x2: Math.max(startX, currentX),
    y2: Math.max(startY, currentY),
  };
}

export function clampBoxToCanvas(box, canvasWidth, canvasHeight) {
  if (!box) return null;

  return {
    x1: Math.max(0, Math.min(box.x1, canvasWidth)),
    y1: Math.max(0, Math.min(box.y1, canvasHeight)),
    x2: Math.max(0, Math.min(box.x2, canvasWidth)),
    y2: Math.max(0, Math.min(box.y2, canvasHeight)),
  };
}
