/** Base monster statistics. All speed values are world pixels per game-second. */
export const ENEMY_TYPES = Object.freeze({
  basic: {
    name: '기본 슬라임', hp: 40, speed: 112, speedVariance: 12,
    damage: 20, attackInterval: 1.3, radius: 21,
    xp: 6, stageProgress: 6, fill: '#d65f76', border: '#ffc0cd',
  },
  fast: {
    name: '빠른 슬라임', hp: 25, speed: 185, speedVariance: 0,
    damage: 20, attackInterval: 1.7, radius: 16,
    xp: 8, stageProgress: 7, fill: '#edb85e', border: '#ffebaf',
  },
  ranged: {
    name: '원거리 슬라임', hp: 30, speed: 95, speedVariance: 0,
    damage: 22, attackInterval: 3.0, windup: .8, laserRange: 820, laserWidth: 34, laserDuration: .18,
    preferredMin: 230, preferredMax: 320, radius: 20,
    xp: 10, stageProgress: 8, fill: '#af84ea', border: '#dcc5ff',
  },
  rock: {
    name: '바위 슬라임', hp: 60, speed: 115, speedVariance: 0,
    damage: 20, attackInterval: 1.5, radius: 25,
    jumpCooldown: 4, jumpMinRange: 120, jumpTriggerRange: 500, jumpMaxDistance: 420,
    jumpSpeed: 700, jumpWindup: .7, jumpRecovery: .6, jumpRadius: 65, jumpDamage: 24,
    xp: 12, stageProgress: 9, fill: '#928577', border: '#ffe0a6',
  },
  boss: {
    name: '슬라임 군주', hp: 260, speed: 160, speedVariance: 0,
    damage: 28, slamDamage: 28, slamRadius: 175, slamWindup: .9,
    dashDamage: 22, dashSpeed: 900, dashDuration: .8, dashWindup: .5,
    attackInterval: 3.5, enragedAttackInterval: 3.0, radius: 45,
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
    dashHit: false, // Boss minion summons removed.
    ...(type === 'rock' ? {
      jumpCooldown: spec.jumpCooldown, jumpHeight: 0,
      jumpDamage: Math.ceil(spec.jumpDamage * (1 + tier * 0.08)),
    } : {}),
  };
}
