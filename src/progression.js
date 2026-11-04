/** Cumulative XP thresholds, independent of stage transitions. */
export function xpForLevel(level) {
  if (!Number.isInteger(level) || level < 1) throw new Error('Invalid character level');
  // Next-level costs grow gently: 12, 18, 24, 30, 36, ... XP.
  // Two basic slimes unlock the first choice; extra ranks cover learning spells.
  return 3 * (level - 1) * (level + 2);
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

