import test from 'node:test';
import assert from 'node:assert/strict';
import { grantShield, applyPlayerHit, HIT_INVULNERABILITY_SECONDS, MAX_SHIELD_CHARGES } from '../src/shield.js';
import { getSpellAtLevel } from '../src/spells.js';
import { generateBoltSequence } from '../src/bolt-sequence.js';
import { generateIntegralSequence } from '../src/integral-sequence.js';
import { boltSequenceMathML, integralSequenceMathML } from '../src/math-ui.js';
import { selectUpgradeChoices, availableUpgrades, spellCooldownSeconds } from '../src/upgrades.js';
const player=()=>({hp:100,maxHp:100,inv:0,shields:0,shieldFlash:0});

test('rank-based casts stack 1/2/3 charges up to a hard maximum of five',()=>{
  const p=player();
  assert.equal(MAX_SHIELD_CHARGES,5);
  assert.equal(grantShield(p,1),1);assert.equal(grantShield(p,2),3);
  assert.equal(grantShield(p,3),5);assert.equal(grantShield(p,3),5);
  assert.equal(p.hp,100);
  p.shields=4;assert.equal(grantShield(p,2),5);
});

test('each hit removes exactly one shield, blocks all damage and grants normal hit invulnerability',()=>{
  const p=player();grantShield(p,3);grantShield(p,3);
  for(let remaining=4;remaining>=0;remaining--){
    const hit=applyPlayerHit(p,999);
    assert.equal(hit.blocked,true);assert.equal(hit.damage,0);
    assert.equal(p.shields,remaining);assert.equal(p.hp,100);
    assert.equal(p.inv,HIT_INVULNERABILITY_SECONDS);
    assert.ok(p.shieldFlash>0);
    p.inv=0;
  }
  const hit=applyPlayerHit(p,20);
  assert.equal(hit.blocked,false);assert.equal(p.hp,80);
  assert.equal(p.inv,HIT_INVULNERABILITY_SECONDS);
});

test('overlapping hits and the last broken shield cannot damage HP during invulnerability',()=>{
  const p=player();grantShield(p,1);
  assert.equal(applyPlayerHit(p,20).blocked,true);
  assert.equal(p.shields,0);
  for(let i=0;i<20;i++)assert.equal(applyPlayerHit(p,28).ignored,true);
  assert.equal(p.hp,100);assert.equal(p.shields,0);
  p.inv=.001;assert.equal(applyPlayerHit(p,1000).ignored,true);
  p.inv=0;assert.equal(applyPlayerHit(p,28).damage,28);assert.equal(p.hp,72);
});

test('healing and fireball share the same integral problems; shield and lightning share derivatives at all ranks',()=>{
  for(let level=1;level<=3;level++){
    const heal=getSpellAtLevel('heal',level),fire=getSpellAtLevel('fireball',level);
    const shield=getSpellAtLevel('shield',level),bolt=getSpellAtLevel('bolt',level);
    assert.deepEqual(heal.problem,fire.problem);assert.deepEqual(shield.problem,bolt.problem);
    assert.equal(shield.blocks,level);
    assert.deepEqual(generateIntegralSequence(heal.problem,()=>.25),generateIntegralSequence(fire.problem,()=>.25));
    assert.deepEqual(generateBoltSequence(shield.problem,()=>.25),generateBoltSequence(bolt.problem,()=>.25));
    assert.match(integralSequenceMathML(generateIntegralSequence(heal.problem,()=>.25),'힐'),/aria-label="힐"/);
    assert.match(boltSequenceMathML(generateBoltSequence(shield.problem,()=>.25),'보호막'),/aria-label="보호막"/);
  }
});

test('four spells still leave one passive upgrade slot, and shield ranks cap at three',()=>{
  const p={levels:{bolt:1,heal:1,fireball:1,shield:1},bonuses:{}};
  for(const value of [0,.25,.5,.75,.99]){
    const choices=selectUpgradeChoices(p,()=>value);
    assert.equal(choices.length,3);assert.equal(new Set(choices.map(x=>x.id)).size,3);
    assert.ok(choices.some(x=>!['bolt','heal','fireball','shield'].includes(x.id)));
  }
  p.levels.shield=3;assert.ok(!availableUpgrades(p).some(x=>x.id==='shield'));
  p.bonuses.focus=5;assert.equal(spellCooldownSeconds(5,p),0);
  p.bonuses.focus=50;assert.equal(spellCooldownSeconds(5,p),0);
});
