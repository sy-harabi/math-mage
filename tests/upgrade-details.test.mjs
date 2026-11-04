import test from 'node:test';
import assert from 'node:assert/strict';
import { availableUpgrades, applyUpgrade } from '../src/upgrades.js';
import { createUpgradeCard } from '../src/upgrade-ui.js';

const player=()=>({levels:{bolt:0,fireball:0,shield:0,heal:0},
  bonuses:{swiftness:0,vitality:0,focus:0,timeWarp:0},hp:70,maxHp:100});
const details=(p,id)=>availableUpgrades(p).find(option=>option.id===id);
const values=(option,label)=>{
  const row=option.rows.find(row=>row.label===label);
  assert.ok(row,`Missing ${label}`);return [row.before,row.after];
};

test('every skill card shows its exact next rank, cooldown, damage and math difficulty',()=>{
  const expected={
    bolt:{label:'대상별 피해',effects:['20','30','40'],cooldowns:['2초','5초','8초']},
    fireball:{label:'범위 피해',effects:['10','30','70'],cooldowns:['5초','8초','10초']},
    heal:{label:'회복량',effects:['20 HP','50 HP','80 HP'],cooldowns:['6초','6초','6초']},
    shield:{label:'시전당 충전',effects:['1회','2회','3회'],cooldowns:['5초','8초','10초']},
  };
  for(const [id,spec] of Object.entries(expected)){
    const p=player();
    for(let rank=1;rank<=3;rank++){
      const option=details(p,id);
      assert.equal(option.rank,rank===1?'Lv1 습득':`Lv${rank-1} → Lv${rank}`);
      assert.deepEqual(values(option,spec.label),[rank===1?null:spec.effects[rank-2],spec.effects[rank-1]]);
      assert.deepEqual(values(option,'쿨타임'),[rank===1?null:spec.cooldowns[rank-2],spec.cooldowns[rank-1]]);
      const integral=['fireball','heal'].includes(id),math=n=>`${n}항${integral?' + C':''}`;
      assert.deepEqual(values(option,integral?'부정적분':'미분'),[rank===1?null:math(rank-1),math(rank)]);
      if(id==='bolt')assert.deepEqual(values(option,'최대 대상'),[rank===1?null:`${[1,3,5][rank-2]}마리`,`${[1,3,5][rank-1]}마리`]);
      if(id==='shield')assert.match(option.note,/총 5회까지 중첩/);
      applyUpgrade(p,id);
    }
    assert.equal(details(p,id),undefined);
  }
});

test('focus previews actual cooldowns with the zero floor, including future skill acquisition',()=>{
  const p=player();p.levels.bolt=1;p.bonuses.focus=2;
  assert.deepEqual(values(details(p,'bolt'),'쿨타임'),['0초','3초']);
  assert.deepEqual(values(details(p,'fireball'),'쿨타임'),[null,'3초']);
  assert.deepEqual(values(details(p,'focus'),'번개'),['0초','0초']);
  assert.match(details(p,'bolt').note,/집중/);
  assert.match(details(p,'focus').note,/이후 습득할 스킬에도 적용/);
});

test('passive previews match the resulting HP, additive movement and world speed at every tier',()=>{
  const p=player();
  for(let n=0;n<6;n++){
    const vitality=details(p,'vitality'),speed=details(p,'swiftness');
    assert.deepEqual(values(vitality,'최대 체력'),[`${p.maxHp} HP`,`${p.maxHp+25} HP`]);
    assert.deepEqual(values(vitality,'현재 체력'),[`${p.hp} HP`,`${p.hp+25} HP`]);
    assert.deepEqual(values(speed,'기본 대비 속도'),[`${100+5*n}%`,`${105+5*n}%`]);
    applyUpgrade(p,'vitality');applyUpgrade(p,'swiftness');
  }
  for(let n=0;n<4;n++){
    assert.deepEqual(values(details(p,'timeWarp'),'풀이 중 세계 속도'),[`${100-15*n}%`,`${85-15*n}%`]);
    applyUpgrade(p,'timeWarp');
  }
  for(const id of ['vitality','swiftness','timeWarp'])assert.equal(details(p,id),undefined);
});

test('cards separate labels, unbroken value groups and notes instead of appending levels to prose',()=>{
  const doc={createElement:tag=>({tag,dataset:{},children:[],attributes:{},
    append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attributes[k]=v;}})};
  const p=player();p.levels.fireball=2;p.bonuses.focus=2;
  const option=details(p,'fireball'),card=createUpgradeCard(option,doc);
  assert.equal(card.tag,'button');assert.equal(card.type,'button');
  assert.equal(card.attributes['aria-label'],'화염구 강화, Lv2 → Lv3');
  assert.equal(card.children[0].children[1].textContent,'Lv2 → Lv3');
  const stats=card.children.find(node=>node.className==='upgrade-stats');
  assert.equal(stats.children.length,4);
  for(const stat of stats.children){
    assert.equal(stat.children[0].className,'upgrade-label');
    assert.equal(stat.children[1].className,'upgrade-values');
  }
  const unchanged=stats.children[1].children[1].children;
  assert.deepEqual(unchanged.map(node=>node.textContent),['42px','유지']);
  const cooldown=stats.children[2].children[1].children;
  assert.deepEqual(cooldown.map(node=>node.textContent),['6초','→','8초']);
  assert.equal(card.children.at(-1).textContent,'선택한 위치에 즉시 폭발\n집중 효과가 반영된 쿨타임');
});
