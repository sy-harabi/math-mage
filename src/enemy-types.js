/** Base monster statistics. All speed values are world pixels per game-second. */
export const ENEMY_TYPES = Object.freeze({
  basic: {
    name: '기본 슬라임', hp: 40, speed: 66, speedVariance: 13,
    damage: 12, attackInterval: 1.3, radius: 21,
    xp: 6, stageProgress: 6, fill: '#d65f76', border: '#ffc0cd',
  },
  fast: {
    name: '빠른 슬라임', hp: 25, speed: 135, speedVariance: 0,
    damage: 8, attackInterval: 1.7, radius: 16,
    xp: 8, stageProgress: 7, fill: '#edb85e', border: '#ffebaf',
  },
  ranged: {
    name: '원거리 슬라임', hp: 30, speed: 55, speedVariance: 0,
    damage: 10, attackInterval: 3.5, windup: 0.8, projectileSpeed: 190,
    preferredMin: 230, preferredMax: 320, radius: 20,
    xp: 10, stageProgress: 8, fill: '#af84ea', border: '#dcc5ff',
  },
  boss: {
    name: '슬라임 군주', hp: 260, speed: 65, speedVariance: 0,
    damage: 20, attackInterval: 4.5, radius: 45,
    xp: 50, stageProgress: 30, fill: '#a964da', border: '#ffc5f6',
  },
});

export function createEnemy(type, x, y, rng = Math.random, stage = 1) {
  const spec = ENEMY_TYPES[type];
  if (!spec) throw new Error(`Unknown enemy type: ${type}`);
  const tier = Math.floor((stage - 1) / 5);
  const hp = Math.ceil(spec.hp * (1 + tier * 0.12));
  const speed = spec.speed + (rng() * 2 - 1) * spec.speedVariance;
  return {
    id: null, type, x, y, hp, max: hp, r: spec.radius,
    speed, damage: Math.ceil(spec.damage * (1 + tier * 0.08)),
    xp: spec.xp, stageProgress: spec.stageProgress,
    attack: 0, wiggle: rng() * Math.PI * 2,
    shootTimer: spec.attackInterval, windup: 0, aim: null,
    action: 'chase', actionTimer: 0, actionCount: 0,
    summonTimer: 12, dashHit: false,
  };
}
