// A slightly smaller body keeps crowds compact and chain lightning useful.
const BODY_SCALE = .85;
const PASSES = 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Resolve enemy-only overlaps. Boss movement and player movement stay authoritative. */
export function separateEnemies(enemies, seconds, world) {
  if (!(seconds > 0) || enemies.length < 2) return;
  const cellSize = Math.max(...enemies.map(enemy => enemy.r)) * BODY_SCALE * 2;
  const strength = 1 - Math.exp(-30 * seconds / PASSES);
  for (let pass = 0; pass < PASSES; pass++) {
    const grid = new Map();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const key = `${Math.floor(enemy.x / cellSize)},${Math.floor(enemy.y / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      const cellX = Math.floor(a.x / cellSize), cellY = Math.floor(a.y / cellSize);
      for (let x = cellX - 1; x <= cellX + 1; x++) {
        for (let y = cellY - 1; y <= cellY + 1; y++) {
          for (const j of grid.get(`${x},${y}`) || []) {
            if (j <= i) continue;
            const b = enemies[j];
            const minDistance = (a.r + b.r) * BODY_SCALE;
            let dx = b.x - a.x, dy = b.y - a.y;
            const distance = Math.hypot(dx, dy);
            if (distance >= minDistance) continue;
            if (distance > 0) { dx /= distance; dy /= distance; }
            else {
              // Deterministic direction even when two spawn centers match exactly.
              const angle = (i * 2.399963 + j * .618034) % (Math.PI * 2);
              dx = Math.cos(angle); dy = Math.sin(angle);
            }
            const weightA = a.type === 'boss' ? 0 : 1 / (a.r * a.r);
            const weightB = b.type === 'boss' ? 0 : 1 / (b.r * b.r);
            const total = weightA + weightB;
            if (!total) continue;
            const push = Math.min((minDistance - distance) * strength, 180 * seconds / PASSES);
            a.x -= dx * push * weightA / total; a.y -= dy * push * weightA / total;
            b.x += dx * push * weightB / total; b.y += dy * push * weightB / total;
          }
        }
      }
    }
    for (const enemy of enemies) {
      if (enemy.type === 'boss') continue;
      enemy.x = clamp(enemy.x, enemy.r, world.w - enemy.r);
      enemy.y = clamp(enemy.y, enemy.r, world.h - enemy.r);
    }
  }
}
