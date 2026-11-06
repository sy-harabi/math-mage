// Translate the actual rendered canvas size into an undistorted logical viewport.
// Keeping a fixed logical height preserves movement speeds and MathML sizing.
export function canvasViewport(cssWidth, cssHeight, logicalHeight = 600) {
  if (!(cssWidth > 0) || !(cssHeight > 0) || !Number.isFinite(cssWidth) || !Number.isFinite(cssHeight)) {
    return {width: 960, height: 600};
  }
  return {width: Math.max(1, Math.round(logicalHeight * cssWidth / cssHeight)), height: logicalHeight};
}
