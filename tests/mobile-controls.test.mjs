import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickVector} from '../src/mobile-controls.js';

test('a resting or tiny joystick movement does not move the player', () => {
  assert.deepEqual(joystickVector(0, 0, 40), {x: 0, y: 0});
  assert.deepEqual(joystickVector(3, 0, 40), {x: 0, y: 0});
});

test('movement direction is preserved and limited to one', () => {
  const diagonal = joystickVector(50, 50, 40);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-10);
  assert.deepEqual(joystickVector(-100, 0, 40), {x: -1, y: 0});
});

test('joystick is analog and resists invalid dimensions', () => {
  const half = joystickVector(20, 0, 40);
  assert.ok(half.x > 0 && half.x < 1);
  assert.equal(half.y, 0);
  assert.deepEqual(joystickVector(5, 5, 0), {x: 0, y: 0});
});
