import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchAction } from '../src/touch-actions.js';
import { bindJoystick } from '../src/mobile-controls.js';

function element(width=100) {
  const handlers=new Map();
  const captured=new Set();
  return {
    handlers, captured, style:{}, disabled:false,
    addEventListener(type,fn){handlers.set(type,fn);},
    fire(type,event={}){handlers.get(type)?.(event);},
    setPointerCapture(id){captured.add(id);},
    hasPointerCapture(id){return captured.has(id);},
    releasePointerCapture(id){captured.delete(id);},
    getBoundingClientRect(){return {left:0,top:0,width,height:width};}
  };
}

test('a second finger activates a skill without releasing joystick capture', () => {
  const originalWindow=globalThis.window,originalDocument=globalThis.document;
  globalThis.window={addEventListener(){}};
  globalThis.document={hidden:false,addEventListener(){}};
  try {
    const joy=element(),thumb=element(),skill=element();
    let direction={x:0,y:0},casts=0,time=100;
    bindJoystick(joy,thumb,v=>{direction=v});
    bindTouchAction(skill,()=>casts++,()=>time);
    joy.fire('pointerdown',{pointerType:'touch',pointerId:11,clientX:86,clientY:50,preventDefault(){}});
    assert.ok(direction.x>0);
    assert.ok(joy.captured.has(11));
    skill.fire('pointerdown',{pointerType:'touch',pointerId:22,preventDefault(){}});
    assert.equal(casts,1);
    assert.ok(direction.x>0,'movement remains held during skill selection');
    assert.ok(joy.captured.has(11),'other finger never steals joystick capture');
    skill.fire('click',{detail:1,pointerType:'touch'});
    assert.equal(casts,1,'compatibility click does not cast again');
    joy.fire('pointerup',{pointerId:11});
    assert.equal(direction.x,0);
  } finally {
    globalThis.window=originalWindow;
    globalThis.document=originalDocument;
  }
});

test('second touch can select an answer while moving and different taps are not swallowed', () => {
  const button=element();
  let count=0,time=500;
  bindTouchAction(button,()=>count++,()=>time);
  button.fire('pointerdown',{pointerType:'touch',pointerId:2,preventDefault(){}});
  button.fire('click',{detail:1});
  assert.equal(count,1);
  time+=125;
  button.fire('pointerdown',{pointerType:'touch',pointerId:3,preventDefault(){}});
  button.fire('click',{detail:1});
  assert.equal(count,2,'subsequent taps trigger independently');
  time+=1000;
  button.fire('click',{detail:1});
  assert.equal(count,3,'mouse click after cooldown is preserved');
  button.fire('click',{detail:0});
  assert.equal(count,4,'keyboard click is preserved');
  button.disabled=true;
  button.fire('pointerdown',{pointerType:'touch',pointerId:4,preventDefault(){}});
  button.fire('click',{detail:0});
  assert.equal(count,4,'disabled button cannot activate');
});
