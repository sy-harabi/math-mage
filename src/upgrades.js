import { getSpellAtLevel } from './spells.js?v=1.8.0';
import { MAX_SHIELD_CHARGES } from './shield.js';

/** Skill ranks and fixed passive upgrade increments. */
const UPGRADES = Object.freeze({
  swiftness: { id: 'swiftness', title: '기동력', description: '이동속도 +5%' },
  vitality: { id: 'vitality', title: '생명력', description: '최대 HP +25 · HP 25 회복' },
  focus: { id: 'focus', title: '집중', description: '모든 마법 쿨타임 −1초' },
  timeWarp: { id: 'timeWarp', title: '시간 왜곡', description: '문제 풀이 중 세계 속도 −15% (최대 4회)' },
});

const SKILL_IDS = ['bolt','heal','fireball','shield'];
const SKILL_NAMES = {bolt:'번개',fireball:'화염구',shield:'방어막',heal:'힐'};
const percent = value => `${Math.round(value * 100)}%`;
const row = (label, before, after) => ({label,before,after});

function skillOption(player,id) {
  const level=player.levels[id]??0, next=getSpellAtLevel(id,level+1);
  const current=level?getSpellAtLevel(id,level):null;
  const stat=(label,read)=>row(label,current?read(current):null,read(next));
  const rows=[];
  if(id==='bolt'){
    rows.push(stat('대상별 피해',s=>String(s.damageByJump[0])),stat('최대 대상',s=>`${s.chainTargets}마리`));
  }else if(id==='fireball'){
    rows.push(stat('범위 피해',s=>String(s.power)),stat('폭발 반경',s=>`${s.radius}px`));
  }else if(id==='heal'){
    rows.push(stat('회복량',s=>`${s.power} HP`));
  }else{
    rows.push(stat('시전당 충전',s=>`${s.blocks}회`));
  }
  rows.push(stat('쿨타임',s=>`${spellCooldownSeconds(s.cooldownSeconds,player)}초`));
  const integral=next.problem.kind==='monomialIntegral';
  rows.push(stat(integral?'부정적분':'미분',s=>`${s.problem.termCount}항${integral?' + C':''}`));
  const notes=[];
  if(id==='shield')notes.push(`총 ${MAX_SHIELD_CHARGES}회까지 중첩`);
  if(id==='fireball')notes.push('선택한 위치에 즉시 폭발');
  if((player.bonuses.focus??0)>0)notes.push('집중 효과가 반영된 쿨타임');
  return {
    id,title:`${SKILL_NAMES[id]} ${level?'강화':'습득'}`,name:SKILL_NAMES[id],
    kind:level?'스킬 강화':'새 스킬',rank:level?`Lv${level} → Lv${level+1}`:'Lv1 습득',
    rows,note:notes.join('\n'),
    description:rows.map(r=>`${r.label} ${r.before===null?r.after:r.before===r.after?`${r.after} 유지`:`${r.before} → ${r.after}`}`).join('\n'),
  };
}

function passiveOption(player,id){
  const rank=player.bonuses[id]??0;
  const rows=[],notes=[];
  if(id==='swiftness'){
    rows.push(row('기본 대비 속도',percent(movementMultiplier(player)),percent(1+(rank+1)*.05)));
  }else if(id==='vitality'){
    rows.push(row('최대 체력',`${player.maxHp} HP`,`${player.maxHp+25} HP`));
    rows.push(row('현재 체력',`${player.hp} HP`,`${Math.min(player.maxHp+25,player.hp+25)} HP`));
  }else if(id==='focus'){
    for(const skill of SKILL_IDS){
      if(!(player.levels[skill]>0))continue;
      const base=getSpellAtLevel(skill,player.levels[skill]).cooldownSeconds;
      rows.push(row(SKILL_NAMES[skill],`${spellCooldownSeconds(base,player)}초`,`${Math.max(0,base-rank-1)}초`));
    }
    notes.push('현재 남은 쿨타임도 1초 감소','최소 0초 · 이후 습득할 스킬에도 적용');
  }else if(id==='timeWarp'){
    rows.push(row('풀이 중 세계 속도',percent(questionTimeMultiplier(player)),percent(Math.max(.4,1-.15*(rank+1)))));
    notes.push('문제 풀이 중에만 적용','문제 풀이 밖에서는 정상 속도');
  }
  return {...UPGRADES[id],name:UPGRADES[id].title,kind:'능력 강화',rank:`${rank} → ${rank+1}회`,rows,note:notes.join('\n')};
}

export function availableUpgrades(player) {
  const options = [];
  for (const id of SKILL_IDS) {
    const level = player.levels[id] ?? 0;
    if (level >= 3) continue;
    options.push(skillOption(player,id));
  }
  if ((player.bonuses.swiftness ?? 0) < 6) options.push(passiveOption(player,'swiftness'));
  if ((player.bonuses.vitality ?? 0) < 6) options.push(passiveOption(player,'vitality'));
  if ((player.bonuses.focus ?? 0) < 5) options.push(passiveOption(player,'focus'));
  if ((player.bonuses.timeWarp ?? 0) < 4) options.push(passiveOption(player,'timeWarp'));
  return options;
}

/** Prioritize available skill ranks while presenting three randomized options. */
export function selectUpgradeChoices(player, rng = Math.random) {
  const pool = availableUpgrades(player);
  const chosen = pool.filter(option => ['bolt','heal','fireball','shield'].includes(option.id));
  const others = pool.filter(option => !['bolt','heal','fireball','shield'].includes(option.id));
  // Reserve a passive slot while passives remain available.
  const skillLimit=others.length?2:3;
  while(chosen.length>skillLimit)chosen.splice(Math.min(chosen.length-1,Math.floor(rng()*chosen.length)),1);
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
  if (['bolt','heal','fireball','shield'].includes(id)) player.levels[id] = (player.levels[id]??0)+1;
  else if (id === 'swiftness') player.bonuses.swiftness += 1;
  else if (id === 'vitality') {
    player.bonuses.vitality += 1;
    player.maxHp += 25;
    player.hp = Math.min(player.maxHp, player.hp + 25);
  } else if (id === 'focus') {
    player.bonuses.focus=(player.bonuses.focus??0)+1;
    // Existing cooldowns receive the same fixed one-second reduction.
    if(player.cd)for(const key of Object.keys(player.cd))player.cd[key]=Math.max(0,player.cd[key]-1);
  }
  else if (id === 'timeWarp') player.bonuses.timeWarp = (player.bonuses.timeWarp ?? 0) + 1;
  return true;
}

export function movementMultiplier(player) {
  return 1 + (player.bonuses.swiftness??0) * .05;
}

/** World speed is reduced ONLY while choosing an answer, never while targeting. */
export function questionTimeMultiplier(player) {
  return Math.max(.4, 1 - .15 * (player.bonuses.timeWarp ?? 0));
}

/** During targeting and movement time always runs at normal speed. */
export function worldTimeMultiplier(mode,player) {
  return mode==='question'?questionTimeMultiplier(player):1;
}

export function spellCooldownSeconds(baseSeconds,player) {
  return Math.max(0,baseSeconds-(player.bonuses.focus??0));
}

