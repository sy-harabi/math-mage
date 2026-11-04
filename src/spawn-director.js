/** Unlimited periodic spawns. Weights are normalized per stage. */
const EARLY_STAGES = Object.freeze({
  1: { interval: 4, weights: { basic: .8, fast: .2 } },
  2: { interval: 3.5, weights: { basic: .65, fast: .35 } },
  3: { interval: 3, weights: { basic: .45, fast: .35, ranged: .2 } },
  4: { interval: 2.5, weights: { basic: .35, fast: .4, ranged: .25 } },
  5: { interval: 2, weights: { basic: .3, fast: .4, ranged: .3 } },
});

export function stageSpawnConfig(stage) {
  if (!Number.isInteger(stage) || stage < 1) throw new Error('stage must be positive');
  if (EARLY_STAGES[stage]) return EARLY_STAGES[stage];
  return {
    interval: 2, // Stages 6+ retain the 2-second floor; difficulty scales by enemy stats.
    weights: { basic: .35, fast: .35, ranged: .30 },
  };
}

export function randomEnemyType(config, rng = Math.random) {
  const sum = Object.values(config.weights).reduce((v, w) => v + w, 0);
  if (!(sum > 0)) throw new Error('Enemy spawn weights must be positive');
  let pick = rng() * sum;
  for (const [type, weight] of Object.entries(config.weights)) {
    pick -= weight;
    if (pick < 0) return type;
  }
  return Object.keys(config.weights).at(-1);
}

/** Prefer a spawn point outside the currently visible camera rectangle. */
export function chooseSpawnPosition(player, camera, world, viewport, rng = Math.random) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isOutside = (x, y) => x < camera.x || x > camera.x + viewport.w ||
    y < camera.y || y > camera.y + viewport.h;
  for (let tries = 0; tries < 48; tries++) {
    const side = Math.floor(rng() * 4);
    const offset = 35 + rng() * 100;
    const span = rng();
    let x, y;
    if (side === 0 || side === 1) {
      x = side === 0 ? camera.x - offset : camera.x + viewport.w + offset;
      y = camera.y + span * viewport.h;
    } else {
      x = camera.x + span * viewport.w;
      y = side === 2 ? camera.y - offset : camera.y + viewport.h + offset;
    }
    x = clamp(x, 30, world.w - 30);
    y = clamp(y, 30, world.h - 30);
    if (isOutside(x, y) && Math.hypot(x - player.x, y - player.y) > 280) {
      return { x, y };
    }
  }
  // Near a map boundary one or more sides are unavailable; keep a safe fallback.
  let candidate = null;
  let bestDistance = -1;
  for (let i = 0; i < 64; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 500 + rng() * 250;
    const x = clamp(player.x + Math.cos(angle) * radius, 30, world.w - 30);
    const y = clamp(player.y + Math.sin(angle) * radius, 30, world.h - 30);
    const distance = Math.hypot(x - player.x, y - player.y);
    if (distance > bestDistance) { bestDistance = distance; candidate = {x, y}; }
    if (isOutside(x, y) && distance > 280) return {x, y};
  }
  return candidate;
}
