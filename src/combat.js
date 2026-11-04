/**
 * Resolve a chain BEFORE applying damage. The clicked enemy is target #1;
 * each subsequent jump finds the nearest unhit, living enemy in range.
 */
export function resolveChainTargets(primary, enemies, maxTargets = 1, range = 260) {
  if (!primary || !enemies.includes(primary) || primary.hp <= 0) return [];
  const targets=[primary],seen=new Set(targets);
  let current=primary;
  while(targets.length<maxTargets) {
    const next=enemies.filter(e=>!seen.has(e)&&e.hp>0&&
      Math.hypot(e.x-current.x,e.y-current.y)<=range)
      .sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y))[0];
    if(!next)break;
    targets.push(next);seen.add(next);current=next;
  }
  return targets;
}

/** The ordered jumps have different damage amounts at each level. */
export function resolveChainHits(primary, enemies, damageByJump, range = 260) {
  if (!Array.isArray(damageByJump) || !damageByJump.length ||
      !damageByJump.every(dmg => Number.isFinite(dmg) && dmg > 0)) {
    throw new Error('연쇄 피해 설정이 올바르지 않습니다.');
  }
  return resolveChainTargets(primary, enemies, damageByJump.length, range)
    .map((enemy, index) => ({ enemy, damage: damageByJump[index] }));
}

/** Real healing can never exceed the character's maximum HP. */
export function healingGained(current, maximum, power) {
  if (![current,maximum,power].every(Number.isFinite) || maximum <= 0 || power < 0) {
    throw new Error('치유 설정이 올바르지 않습니다.');
  }
  return Math.max(0, Math.min(maximum - current, power));
}

/** A circle clips enemy hitboxes, including the edge, and hits each living enemy once. */
export function resolveAreaHits(center, enemies, radius, damage) {
  if(![center?.x,center?.y,radius,damage].every(Number.isFinite)||radius<=0||damage<=0) {
    throw new Error('범위 공격 설정이 올바르지 않습니다.');
  }
  return [...new Set(enemies)].filter(enemy=>enemy.hp>0 &&
    Math.hypot(enemy.x-center.x,enemy.y-center.y)<=radius+(enemy.r??0))
    .map(enemy=>({enemy,damage}));
}
