/**
 * Browsers only grant fullscreen while processing a real user gesture.
 * Call this synchronously from Start or the fullscreen button; never from a timer.
 * Rejection is normal in embedded browsers or when fullscreen is unsupported.
 */
export function requestGameFullscreen(stage, doc = document) {
  if (!stage?.requestFullscreen || doc.fullscreenElement === stage) return Promise.resolve(false);
  try {
    return Promise.resolve(stage.requestFullscreen({ navigationUI:'hide' }))
      .then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}
