/** Real time, including upgrade selection and spell slowdown. Hidden tabs are paused. */
export function createRunTimer() {
  return {elapsedSeconds: 0, finished: false};
}

export function advanceRunTimer(timer, elapsedRealSeconds, active = true) {
  if (!Number.isFinite(elapsedRealSeconds) || elapsedRealSeconds < 0) {
    throw new Error('Elapsed time must be nonnegative and finite');
  }
  if (!timer.finished && active) timer.elapsedSeconds += elapsedRealSeconds;
  return timer.elapsedSeconds;
}

export function finishRunTimer(timer) {
  timer.finished = true;
  return timer.elapsedSeconds;
}

export function formatRunTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid run time');
  const centiseconds = Math.floor(seconds * 100 + 1e-7);
  const minutes = Math.floor(centiseconds / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  return `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(centiseconds % 100).padStart(2,'0')}`;
}
