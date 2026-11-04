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
    id,hidden:false,style:{},dataset:{},children:[],textContent:'',innerHTML:'',disabled:false,
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


test('PC rune ritual keeps five clickable MathML options, movement and cancellation',async()=>{
  const elements=new Map();
  const get=id=>{
    if(!ids.has(id))return null;
    if(!elements.has(id))elements.set(id,makeElement(id));
    return elements.get(id);
  };
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  const listeners=new Map();
  globalThis.window={location:{search:''},addEventListener:(k,f)=>listeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:()=>[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=()=>{};
  await import('../src/game.js?pc-rune-test');
  assert.equal(get('math-cast-hud').hidden,true);
  get('bolt').click();
  assert.equal(get('math-cast-hud').hidden,false);
  assert.equal(get('math-cast-hud').dataset.terms,'1');
  assert.equal(get('math-answers').children.length,5);
  for(const option of get('math-answers').children){
    assert.equal(option.className,'math-choice');
    assert.match(option.children[1].innerHTML,/<math/);
  }
  listeners.get('keydown')({key:'w',repeat:false,preventDefault(){}});
  assert.equal(get('math-cast-hud').hidden,false);
  listeners.get('keydown')({key:'escape',repeat:false,preventDefault(){}});
  assert.equal(get('math-cast-hud').hidden,true);
  assert.equal(ids.has('touchpad'),false);
});

test('PC ritual is a transparent five-point pentagram, not an exercise-card list',()=>{
  assert.match(html,/<svg class="rune-lines"/);
  assert.match(html,/<polygon class="rune-pentagon"/);
  assert.match(html,/<path class="rune-star"/);
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(css,/\.math-cast-hud\{[^}]*pointer-events:none/s);
  assert.match(css,/\.math-choice\{[^}]*pointer-events:auto/s);
  assert.match(css,/\.math-choice:nth-child\(5\)/);
});

// Exercise the real game event handlers, not just the sequence helper.
test('fireball Lv3 swaps only the central question, permits movement, launches and fails without undo',async()=>{
  const {conceptVariants,CONCEPT_TOKENS}=await import('../src/concept-questions.js');
  const variants=conceptVariants();
  const elements=new Map();
  const get=id=>{
    if(!ids.has(id))return null;
    if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);
  };
  const debug=makeElement('debug');debug.dataset.fireballLevel='3';
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  const listeners=new Map();let frame;
  globalThis.window={location:{search:'?debug=1'},addEventListener:(k,f)=>listeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:selector=>selector==='[data-fireball-level]'?[debug]:[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=fn=>{frame=fn;};
  await import('../src/game.js?fireball-events');
  const key=key=>listeners.get('keydown')({key,repeat:false,preventDefault(){}});
  debug.click();key('3');
  const nodes=[...get('math-answers').children];
  const formulas=nodes.map(n=>n.children[1].innerHTML);
  const left=get('rune-frame').style.left;
  key('d');frame(1);frame(51);listeners.get('keyup')({key:'d'});
  assert.equal(get('rune-frame').style.left,left,'camera must remain centered while moving');
  for(let i=0;i<3;i++){
    assert.match(get('math-title').textContent,new RegExp(`${i+1}/3`));
    const current=get('math-problem').innerHTML;
    const variant=variants.find(q=>q.html===current);
    assert.ok(variant,'rendered question is from the reviewed bank');
    const correct=formulas.indexOf(CONCEPT_TOKENS[variant.answerId].html);
    assert.ok(correct>=0);
    nodes[correct].click();
    assert.deepEqual(get('math-answers').children,nodes,'answer DOM nodes remain intact');
    assert.deepEqual(nodes.map(n=>n.children[1].innerHTML),formulas);
    if(i<2){assert.equal(get('math-cast-hud').hidden,false);assert.notEqual(get('math-problem').innerHTML,current);}
  }
  assert.equal(get('math-cast-hud').hidden,true);
  assert.match(get('toast').textContent,/폭발시킬 위치/);
  canvas._listeners.get('pointerdown')({clientX:480,clientY:300,preventDefault(){}});
  assert.match(get('toast').textContent,/파이어볼 발사/);
  frame(101);assert.match(get('toast').textContent,/파이어볼 .*타격/);
  assert.match(get('fireball-state').textContent,/초/);
  // Restart clears cooldown/projectiles. A wrong answer cannot be undone or retried.
  get('restart').click();debug.click();get('fireball').click();
  const variant=variants.find(q=>q.html===get('math-problem').innerHTML);
  const correct=get('math-answers').children.findIndex(n=>n.children[1].innerHTML===CONCEPT_TOKENS[variant.answerId].html);
  get('math-answers').children[(correct+1)%5].click();
  assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
  key('Backspace');get('math-answers').children[correct].click();
  assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
  key('3');assert.match(get('toast').textContent,/쿨타임/);
});

test('bolt event flow keeps five runes, assembles every rank, and fails immediately at any step',async()=>{
  const {generateBoltSequence}=await import('../src/bolt-sequence.js');
  const {getSpellAtLevel}=await import('../src/spells.js');
  const elements=new Map();
  const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  const debug=makeElement('debug');debug.dataset.boltLevel='3';
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  const listeners=new Map();let frame;
  globalThis.window={location:{search:'?debug=1'},addEventListener:(k,f)=>listeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:selector=>selector==='[data-bolt-level]'?[debug]:[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=fn=>{frame=fn;};
  const key=key=>listeners.get('keydown')({key,repeat:false,preventDefault(){}});
  const random=Math.random;Math.random=()=>.25;
  try{
    await import('../src/game.js?bolt-events');
    for(let level=1;level<=3;level++){
      get('restart').click();debug.dataset.boltLevel=String(level);debug.click();get('bolt').click();
      const expected=generateBoltSequence(getSpellAtLevel('bolt',level).problem,()=>.25);
      const nodes=[...get('math-answers').children];
      const formulas=nodes.map(n=>n.children[1].innerHTML);
      assert.equal(nodes.length,5);
      const left=get('rune-frame').style.left;
      key('d');frame(1);frame(51);listeners.get('keyup')({key:'d'});
      assert.equal(get('rune-frame').style.left,left);
      for(let i=0;i<level;i++){
        assert.match(get('math-title').textContent,new RegExp(`${i+1}/${level}`));
        assert.equal((get('math-problem').innerHTML.match(/□/g)??[]).length,level-i);
        if(i%2)key(String(expected.correctIndices[i]+1));else nodes[expected.correctIndices[i]].click();
        assert.deepEqual(get('math-answers').children,nodes);
        assert.deepEqual(nodes.map(n=>n.children[1].innerHTML),formulas);
        assert.equal(get('math-cast-hud').hidden,i===level-1);
      }
      assert.match(get('toast').textContent,/번개를 맞힐 적/);
      key('Escape');assert.equal(get('math-cast-hud').hidden,true);
    }
    for(let position=0;position<3;position++){
      get('restart').click();debug.dataset.boltLevel='3';debug.click();key('1');
      const expected=generateBoltSequence(getSpellAtLevel('bolt',3).problem,()=>.25);
      const nodes=[...get('math-answers').children];
      for(let i=0;i<position;i++)nodes[expected.correctIndices[i]].click();
      nodes[(expected.correctIndices[position]+1)%5].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('Backspace');nodes[expected.correctIndices[position]].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('1');assert.match(get('toast').textContent,/쿨타임/);
    }
    get('restart').click();debug.click();key('1');key('Escape');
    assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/마법 취소/);
    get('restart').click();debug.click();key('1');
    assert.match(get('math-title').textContent,/1\/3/);
    assert.equal((get('math-problem').innerHTML.match(/□/g)??[]).length,3);
  }finally{Math.random=random;}
});
