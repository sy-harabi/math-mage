/** Shared by hover and click, including the existing forgiving click margin. */
export function pickEnemyAt(point, enemies, padding = 20) {
  if (!point) return null;
  let selected = null, closest = Infinity;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const distance = Math.hypot(point.x - enemy.x, point.y - (enemy.y - (enemy.jumpHeight || 0)));
    if (distance < enemy.r + padding && distance < closest) {
      selected = enemy; closest = distance;
    }
  }
  return selected;
}
