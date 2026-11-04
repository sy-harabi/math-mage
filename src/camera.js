/** Stable fixed-size camera for every gameplay mode (idle, question, target).
 * Ritual UI is an overlay and must never affect world-to-screen coordinates.
 */
export function centeredCamera(player, viewport, world) {
  const clamp = (v, low, high) => Math.max(low, Math.min(v, high));
  return {
    x: clamp(player.x - viewport.w / 2, 0, Math.max(0, world.w - viewport.w)),
    y: clamp(player.y - viewport.h / 2, 0, Math.max(0, world.h - viewport.h)),
  };
}
