import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(match=>match[1]));

test('every element referenced by the game code exists in real HTML',()=>{
  const source = readFileSync(new URL('../src/game.js',import.meta.url), 'utf8');
  const referenced = [...source.matchAll(/document\.getElementById\('([^']+)'\)/g)].map(match=>match[1]);
  for(const id of referenced) assert.ok(ids.has(id), `Missing index.html element: #${id}`);
});


function makeElement(id) {
  const listeners=new Map();
  return {
    id,hidden:false,style:{},children:[],textContent:'',innerHTML:'',disabled:false,
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(){},
    setPointerCapture(){},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=[...items];},
    addEventListener(type,fn){listeners.set(type,fn);},
    click(){listeners.get('click')?.();},
    getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:960,height:600};},
    _listeners:listeners,
  };
}

test('game boots with native MathML choices and WASD active during question', async()=>{
  const elements=new Map();
  const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  const windowListeners=new Map();
  globalThis.window={location:{search:''},matchMedia:()=>({matches:false}),addEventListener:(k,f)=>windowListeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:()=>[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=()=>{}; // don't run the frame loop during boot
  await import('../src/game.js');
  assert.equal(get('run-time').textContent,'00:00.00');
  assert.equal(get('math-cast-hud').hidden,true);
  assert.ok(get('enemies-count')!==null);
  windowListeners.get('keydown')({key:'1',repeat:false,preventDefault(){}});
  assert.equal(get('math-cast-hud').hidden,false);
  assert.equal(get('math-answers').children.length,5);
  assert.match(get('math-problem').innerHTML,/<math/);
  assert.match(get('math-answers').children[0].children[1].innerHTML,/<math/);
  // Moving while the answer panel is visible must remain possible.
  windowListeners.get('keydown')({key:'d',repeat:false,preventDefault(){}});
  assert.equal(get('math-cast-hud').hidden,false);
  windowListeners.get('keydown')({key:'escape',repeat:false,preventDefault(){}});
  assert.equal(get('math-cast-hud').hidden,true);
});

test('mobile touch controls can open question, move and select an answer',async()=>{
  const elements=new Map();
  const get=id=>{
    if(!ids.has(id)) return null;
    if(!elements.has(id))elements.set(id,makeElement(id));
    return elements.get(id);
  };
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  const pads=['up','down','left','right'].map(dir=>{
    const el=makeElement(`pad-${dir}`);el.dataset={dir};return el;
  });
  globalThis.window={location:{search:''},matchMedia:()=>({matches:true}),addEventListener:()=>{}};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:query=>query==='[data-dir]'?pads:[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=()=>{};
  await import('../src/game.js?mobile-test');
  get('bolt').click();
  assert.equal(get('math-cast-hud').hidden,false);
  assert.equal(get('math-answers').children.length,5);
  pads[0]._listeners.get('pointerdown')({preventDefault(){},pointerId:1});
  get('math-answers').children[0].click();
  assert.equal(get('math-cast-hud').hidden,true);
  assert.ok(get('victory-restart')._listeners.has('click'),'Victory restart is wired');
});
