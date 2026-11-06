import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGameFullscreen } from '../src/fullscreen.js';

test('fullscreen request occurs synchronously within a user gesture', async () => {
  let count=0, hint;
  const stage={requestFullscreen(options){count++;hint=options.navigationUI;return Promise.resolve();}};
  const promise=requestGameFullscreen(stage,{fullscreenElement:null});
  assert.equal(count,1,'requestFullscreen is called before yielding to the event loop');
  assert.equal(hint,'hide');
  assert.equal(await promise,true);
});

test('unsupported, rejected and already active fullscreen fail safely', async () => {
  assert.equal(await requestGameFullscreen({},{}),false);
  const stage={requestFullscreen(){return Promise.reject(new Error('blocked by embed'));}};
  assert.equal(await requestGameFullscreen(stage,{fullscreenElement:null}),false);
  let count=0;
  const already={requestFullscreen(){count++;}};
  assert.equal(await requestGameFullscreen(already,{fullscreenElement:already}),false);
  assert.equal(count,0);
  const throws={requestFullscreen(){throw new Error('denied');}};
  assert.equal(await requestGameFullscreen(throws,{fullscreenElement:null}),false);
});
