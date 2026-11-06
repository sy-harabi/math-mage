import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasViewport } from '../src/responsive-viewport.js';

test('wide screens preserve 600 logical height and reveal extra world horizontally', () => {
  for (const [width, height] of [[873, 356], [780, 330], [932, 388], [1920, 810]]) {
    const logical = canvasViewport(width, height);
    assert.equal(logical.height, 600);
    assert.ok(logical.width >= 960);
    assert.ok(Math.abs(logical.width / logical.height - width / height) < 1 / logical.height);
  }
});

test('taller screens preserve 960 logical width and reveal extra world vertically', () => {
  for (const [width, height] of [[1024, 720], [1440, 1000], [600, 800]]) {
    const logical = canvasViewport(width, height);
    assert.equal(logical.width, 960);
    assert.ok(logical.height >= 600);
    assert.ok(Math.abs(logical.width / logical.height - width / height) < logical.width / (logical.height ** 2));
  }
});

test('16:10 screen is unchanged; invalid dimensions do not crash', () => {
  assert.deepEqual(canvasViewport(960, 600), {width: 960, height: 600});
  assert.deepEqual(canvasViewport(0, 500), {width: 960, height: 600});
  assert.deepEqual(canvasViewport(500, NaN), {width: 960, height: 600});
});
