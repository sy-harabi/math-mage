// Show the entire baseline game area while filling the actual screen.
// A wide screen reveals more world horizontally; a tall screen reveals more vertically.
// No cropping, black bars, stretching, or device-model assumptions.
export function canvasViewport(cssWidth, cssHeight, baseWidth = 960, baseHeight = 600) {
  if (!(cssWidth > 0) || !(cssHeight > 0) || !Number.isFinite(cssWidth) ||
      !Number.isFinite(cssHeight) || !(baseWidth > 0) || !(baseHeight > 0)) {
    return {width: baseWidth, height: baseHeight};
  }
  const aspect = cssWidth / cssHeight;
  const baseAspect = baseWidth / baseHeight;
  return aspect >= baseAspect
    ? {width: Math.round(baseHeight * aspect), height: baseHeight}
    : {width: baseWidth, height: Math.round(baseWidth / aspect)};
}
