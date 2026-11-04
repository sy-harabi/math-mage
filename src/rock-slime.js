import { ENEMY_TYPES } from './enemy-types.js?v=1.9.0';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const PLAYER_HIT_RADIUS = 18;

/** Advance in game-time. Only landing/melee events may damage the player. */
export function updateRockSlime(enemy, player, seconds, world) {
  const spec = ENEMY_TYPES.rock;
  enemy.jumpCooldown = Math.max(0, enemy.jumpCooldown - seconds);
  if (enemy.action === 'windupJump') {
    enemy.actionTimer = Math.max(0, enemy.actionTimer - seconds);
    if (enemy.actionTimer <= 1e-9) {
      enemy.action = 'jump';
      enemy.jumpStart = { x: enemy.x, y: enemy.y };
      enemy.jumpDuration = Math.hypot(enemy.aim.x - enemy.x, enemy.aim.y - enemy.y) / spec.jumpSpeed;
      enemy.jumpElapsed = 0;
    }
    return null;
  }
  if (enemy.action === 'jump') {
    enemy.jumpElapsed = Math.min(enemy.jumpDuration, enemy.jumpElapsed + seconds);
    const progress = enemy.jumpDuration > 0 ? enemy.jumpElapsed / enemy.jumpDuration : 1;
    enemy.x = enemy.jumpStart.x + (enemy.aim.x - enemy.jumpStart.x) * progress;
    enemy.y = enemy.jumpStart.y + (enemy.aim.y - enemy.jumpStart.y) * progress;
    enemy.jumpHeight = Math.sin(progress * Math.PI) * 90;
    if (progress >= 1 - 1e-9) {
      enemy.x = enemy.aim.x; enemy.y = enemy.aim.y; enemy.jumpHeight = 0;
      enemy.action = 'recoverJump'; enemy.actionTimer = spec.jumpRecovery;
      enemy.jumpCooldown = spec.jumpCooldown;
      return { type: 'landing', x: enemy.x, y: enemy.y,
        hit: Math.hypot(player.x - enemy.x, player.y - enemy.y) <= spec.jumpRadius + PLAYER_HIT_RADIUS,
        damage: enemy.jumpDamage };
    }
    return null;
  }
  if (enemy.action === 'recoverJump') {
    enemy.actionTimer = Math.max(0, enemy.actionTimer - seconds);
    if (enemy.actionTimer <= 1e-9) { enemy.action = 'chase'; enemy.aim = null; }
    return null;
  }
  const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy);
  if (enemy.jumpCooldown <= 1e-9 && distance >= spec.jumpMinRange && distance <= spec.jumpTriggerRange) {
    const length = Math.min(distance, spec.jumpMaxDistance);
    enemy.aim = {
      x: clamp(enemy.x + dx / distance * length, enemy.r, world.w - enemy.r),
      y: clamp(enemy.y + dy / distance * length, enemy.r, world.h - enemy.r),
    };
    enemy.action = 'windupJump'; enemy.actionTimer = spec.jumpWindup;
  } else if (distance > enemy.r + 16) {
    const length = Math.min(enemy.speed * seconds, distance - enemy.r - 16);
    enemy.x += dx / distance * length; enemy.y += dy / distance * length;
  } else if (enemy.attack <= 0) {
    enemy.attack = spec.attackInterval;
    return { type: 'melee', damage: enemy.damage };
  }
  return null;
}
