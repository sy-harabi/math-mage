/** Level-up choices; no shield is available in this version. */
const UPGRADES = Object.freeze({
  bolt: { id: 'bolt', title: '번개 강화', description: '미분 항 +1 · 연쇄 대상 +1' },
  heal: { id: 'heal', title: '힐 강화', description: '적분 항 +1 · 회복량 증가' },
  swiftness: { id: 'swiftness', title: '기동력', description: '이동속도 +8%' },
  vitality: { id: 'vitality', title: '생명력', description: '최대 HP +15 · HP 15 회복' },
  focus: { id: 'focus', title: '집중', description: '모든 마법 쿨타임 7% 감소' },
});

export function availableUpgrades(player) {
  const options = [];
  if (player.levels.bolt < 3) options.push(UPGRADES.bolt);
  if (player.levels.heal < 3) options.push(UPGRADES.heal);
  if ((player.bonuses.swiftness ?? 0) < 6) options.push(UPGRADES.swiftness);
  if ((player.bonuses.vitality ?? 0) < 6) options.push(UPGRADES.vitality);
  if ((player.bonuses.focus ?? 0) < 5) options.push(UPGRADES.focus);
  return options;
}

/** Prioritize available skill ranks while presenting three randomized options. */
export function selectUpgradeChoices(player, rng = Math.random) {
  const pool = availableUpgrades(player);
  const chosen = pool.filter(option => option.id === 'bolt' || option.id === 'heal');
  const others = pool.filter(option => !chosen.includes(option));
  while (chosen.length < 3 && others.length) {
    const index = Math.min(others.length - 1, Math.floor(rng() * others.length));
    chosen.push(...others.splice(index, 1));
  }
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}

export function applyUpgrade(player, id) {
  if (!availableUpgrades(player).some(option => option.id === id)) return false;
  if (id === 'bolt' || id === 'heal') player.levels[id] += 1;
  else if (id === 'swiftness') player.bonuses.swiftness += 1;
  else if (id === 'vitality') {
    player.bonuses.vitality += 1;
    player.maxHp += 15;
    player.hp = Math.min(player.maxHp, player.hp + 15);
  } else if (id === 'focus') player.bonuses.focus += 1;
  return true;
}

export function movementMultiplier(player) {
  return 1 + player.bonuses.swiftness * .08;
}

export function cooldownMultiplier(player) {
  return 1 - player.bonuses.focus * .07;
}
