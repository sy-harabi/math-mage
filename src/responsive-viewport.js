// Translate the actual rendered canvas size into an undistorted logical viewport.
// Keeping a fixed logical height preserves movement speeds and MathML sizing.
export function canvasViewport(cssWidth, cssHeight, logicalHeight = 600) {
  if (!(cssWidth > 0) || !(cssHeight > 0) || !Number.isFinite(cssWidth) || !Number.isFinite(cssHeight)) {
    return {width: 960, height: 600};
  }
  return {width: Math.max(1, Math.round(logicalHeight * cssWidth / cssHeight)), height: logicalHeight};
}

/**
 * Fit a fixed-ratio game area entirely inside the available CSS viewport.
 * Wide devices are height-limited; tall devices are width-limited.
 */
export function fitGameViewport(availableWidth, availableHeight, aspectRatio = 960 / 600) {
  if (!(availableWidth > 0) || !(availableHeight > 0) || !(aspectRatio > 0)
      || !Number.isFinite(availableWidth) || !Number.isFinite(availableHeight)
      || !Number.isFinite(aspectRatio)) return {width: 0, height: 0};
  const width = Math.min(availableWidth, availableHeight * aspectRatio);
  return {width, height: width / aspectRatio};
}
