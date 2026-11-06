import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasViewport } from '../src/responsive-viewport.js';

test('landscape phone screens adapt the visible world without stretching the canvas', () => {
  for (const [width, height] of [[873, 356], [780, 330], [932, 388], [915, 412]]) {
    const logical = canvasViewport(width, height);
    assert.equal(logical.height, 600);
    assert.ok(Math.abs(logical.width / logical.height - width / height) < 1 / logical.height);
  }
});

test('tablet and wide screens keep their own aspect ratios', () => {
  for (const [width, height] of [[1024, 720], [1440, 900], [1920, 810]]) {
    const logical = canvasViewport(width, height);
    assert.ok(Math.abs(logical.width / logical.height - width / height) < 1 / logical.height);
  }
});

test('zero-size or invalid canvas does not destroy viewport state', () => {
  assert.deepEqual(canvasViewport(0, 500), {width: 960, height: 600});
  assert.deepEqual(canvasViewport(500, NaN), {width: 960, height: 600});
});
