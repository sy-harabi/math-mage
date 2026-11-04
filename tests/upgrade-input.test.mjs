import test from 'node:test';
import assert from 'node:assert/strict';
import { guardUpgradeButton } from '../src/upgrade-input.js';

class FakeButton {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  dispatch(type, data = {}) {
    let blocked = false;
    this.listeners.get(type)?.({
      preventDefault(){ blocked = true; }, stopPropagation(){}, ...data,
    });
    return blocked;
  }
}

test('a touch started on arena before opening the upgrade dialog cannot trigger a ghost click', () => {
  const button = new FakeButton();
  let selected = 0;
  guardUpgradeButton(button, () => selected++);
  assert.equal(button.dispatch('click',{detail:1,pointerId:42,pointerType:'touch'}),true);
  assert.equal(selected,0);
});

test('a fresh touch on an upgrade button selects exactly once', () => {
  const button = new FakeButton();
  let selected = 0;
  guardUpgradeButton(button, () => selected++);
  button.dispatch('pointerdown',{pointerId:12,clientX:100,clientY:50,pointerType:'touch'});
  assert.equal(button.dispatch('click',{pointerId:12,detail:1,pointerType:'touch'}),false);
  assert.equal(selected,1);
  assert.equal(button.dispatch('click',{pointerId:12,detail:1,pointerType:'touch'}),true);
  assert.equal(selected,1);
});

test('a drag or cancelled touch cannot select an upgrade',()=>{
  const button = new FakeButton();
  let selected = 0;
  guardUpgradeButton(button, () => selected++);
  button.dispatch('pointerdown',{pointerId:1,clientX:50,clientY:50});
  button.dispatch('pointermove',{pointerId:1,clientX:85,clientY:50});
  assert.equal(button.dispatch('click',{detail:1,pointerId:1,pointerType:'touch'}),true);
  button.dispatch('pointerdown',{pointerId:2,clientX:50,clientY:50});
  button.dispatch('pointercancel',{pointerId:2});
  assert.equal(button.dispatch('click',{detail:1,pointerId:2,pointerType:'touch'}),true);
  assert.equal(selected,0);
});

test('keyboard Enter/Space can still select a focused option',()=>{
  const button = new FakeButton();
  let selected = 0;
  guardUpgradeButton(button,()=>selected++);
  assert.equal(button.dispatch('click',{detail:0}),false);
  assert.equal(selected,1);
});
