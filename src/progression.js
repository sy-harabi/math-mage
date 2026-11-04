/** Cumulative XP thresholds, independent of stage transitions. */
export function xpForLevel(level) {
  if (!Number.isInteger(level) || level < 1) throw new Error('Invalid character level');
  if (level === 1) return 0;
  if (level === 2) return 24;
  let total = 52;
  for (let n = 4; n <= level; n++) total += 20 * n - 32;
  return total;
}

export function createProgression() {
  return { xp: 0, level: 1, pendingUpgrades: 0 };
}

export function addXp(state, amount) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('XP must be nonnegative');
  state.xp += amount;
  let leveled = 0;
  while (state.xp >= xpForLevel(state.level + 1)) {
    state.level++;
    state.pendingUpgrades++;
    leveled++;
  }
  return leveled;
}

export function xpToNext(state) {
  return {
    current: state.xp - xpForLevel(state.level),
    required: xpForLevel(state.level + 1) - xpForLevel(state.level),
  };
}
