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

test('fireball assembles every rank with refreshed runes and final +C, previews radius and explodes on click before a frame',async()=>{
  const {generateIntegralSequence}=await import('../src/integral-sequence.js');
  const {getSpellAtLevel}=await import('../src/spells.js');
  const elements=new Map();
  const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  const debug=makeElement('debug');debug.dataset.fireballLevel='3';
  const canvas=get('game');canvas.width=960;canvas.height=600;
  const arcs=[],translations=[];
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12}),arc:(...args)=>arcs.push(args),translate:(...args)=>translations.push(args)},{get:(o,k)=>o[k]??(()=>{})});
  const listeners=new Map();let frame;
  globalThis.window={location:{search:'?debug=1'},addEventListener:(k,f)=>listeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:selector=>selector==='[data-fireball-level]'?[debug]:[],addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=fn=>{frame=fn;};
  const key=key=>listeners.get('keydown')({key,repeat:false,preventDefault(){}});
  const random=Math.random;Math.random=()=>.25;
  try{
    await import('../src/game.js?indefinite-integral-events');
    for(let level=1;level<=3;level++){
      get('restart').click();debug.dataset.fireballLevel=String(level);debug.click();key('3');
      const expected=generateIntegralSequence(getSpellAtLevel('fireball',level).problem,()=>.25);
      let previousNodes=null;
      const left=get('rune-frame').style.left;
      key('d');frame(1);frame(51);listeners.get('keyup')({key:'d'});
      assert.equal(get('rune-frame').style.left,left);
      for(let i=0;i<=level;i++){
        assert.equal(get('math-title').textContent,'');
        assert.match(get('math-problem').innerHTML,new RegExp(`aria-valuenow="${i}"`));
        assert.match(get('math-problem').innerHTML,new RegExp(`aria-valuemax="${level+1}"`));
        assert.doesNotMatch(get('math-problem').innerHTML,/<msubsup>/);
        const nodes=[...get('math-answers').children];
        if(previousNodes)assert.ok(nodes.every((n,index)=>n!==previousNodes[index]),'runes are replaced after every answer');
        if(i===level)assert.match(nodes[expected.correctIndices[i]].children[1].innerHTML,/<mi>C<\/mi>/);
        assert.doesNotMatch(get('math-problem').innerHTML,/□|왼쪽|실패/);
        nodes[expected.correctIndices[i]].click();
        previousNodes=nodes;
        assert.equal(get('math-cast-hud').hidden,i===level);
      }
      assert.match(get('toast').textContent,/폭발시킬 위치/);
      canvas._listeners.get('pointermove')({clientX:650,clientY:350});
      arcs.length=0;frame(101);
      const preview=arcs.find(a=>a[2]===42);assert.ok(preview,'target radius is drawn');
      canvas._listeners.get('pointerdown')({clientX:650,clientY:350,preventDefault(){}});
      // No animation frame or travel time is needed to resolve the explosion.
      assert.match(get('toast').textContent,/파이어볼 .*타격/);
      assert.doesNotMatch(get('toast').textContent,/발사/);
      arcs.length=0;frame(151);
      assert.ok(arcs.some(a=>a[0]===preview[0]&&a[1]===preview[1]&&a[2]===42),'blast uses the exact preview center/radius');
      assert.match(get('fireball-state').textContent,/초/);
      const remaining=Number(get('fireball-state').textContent.match(/· ([\d.]+)초/)[1]);
      assert.ok(Math.abs(remaining-([5,8,10][level-1]-.05))<.051,'remaining cooldown uses this spell rank');
      assert.ok(Math.abs(parseFloat(get('fireball-fill').style.width)-100*.05/([5,8,10][level-1]))<1e-8,'bar uses the same rank duration');
    }
    // Bring the two initial slimes into view, then verify real damage/XP resolve in the click handler.
    get('restart').click();debug.dataset.fireballLevel='3';debug.click();key('3');key('d');
    for(let t=201;t<=651;t+=50){translations.length=0;frame(t);}
    listeners.get('keyup')({key:'d'});
    const expected=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,()=>.25);
    for(const index of expected.correctIndices)get('math-answers').children[index].click();
    const target={clientX:translations[1][0]+translations[0][0],clientY:translations[1][1]+translations[0][1],preventDefault(){}};
    assert.ok(target.clientX>=0&&target.clientX<=960&&target.clientY>=0&&target.clientY<=600);
    canvas._listeners.get('pointerdown')(target);
    assert.match(get('toast').textContent,/2개체 타격 · 2마리 처치/,'both enemies take damage immediately, before a frame');
    frame(701);assert.equal(get('kills').textContent,2);assert.equal(get('xp-label').textContent,'12/24');
    for(let position=0;position<4;position++){
      get('restart').click();debug.dataset.fireballLevel='3';debug.click();get('fireball').click();
      const expected=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,()=>.25);
      for(let i=0;i<position;i++)get('math-answers').children[expected.correctIndices[i]].click();
      const nodes=get('math-answers').children;
      nodes[(expected.correctIndices[position]+1)%5].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('Backspace');nodes[expected.correctIndices[position]].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('3');assert.match(get('toast').textContent,/쿨타임/);
    }
  }finally{Math.random=random;}
});

test('bolt event flow refreshes five runes after each term, assembles every rank, and fails immediately at any step',async()=>{
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
      let previousNodes=null,previousFormulas=null;
      const left=get('rune-frame').style.left;
      key('d');frame(1);frame(51);listeners.get('keyup')({key:'d'});
      assert.equal(get('rune-frame').style.left,left);
      for(let i=0;i<level;i++){
        assert.equal(get('math-title').textContent,'');
        assert.match(get('math-problem').innerHTML,new RegExp(`aria-valuenow="${i}"`));
        assert.match(get('math-problem').innerHTML,new RegExp(`aria-valuemax="${level}"`));
        const nodes=[...get('math-answers').children];
        const formulas=nodes.map(n=>n.children[1].innerHTML);
        assert.equal(nodes.length,5);
        if(previousNodes){
          assert.ok(nodes.every((n,index)=>n!==previousNodes[index]));
          assert.notDeepEqual(formulas,previousFormulas);
        }
        if(i%2)key(String(expected.correctIndices[i]+1));else nodes[expected.correctIndices[i]].click();
        previousNodes=nodes;previousFormulas=formulas;
        assert.equal(get('math-cast-hud').hidden,i===level-1);
      }
      assert.match(get('toast').textContent,/번개를 맞힐 적/);
      key('Escape');assert.equal(get('math-cast-hud').hidden,true);
      frame(101);
      const remaining=Number(get('bolt-state').textContent.match(/· ([\d.]+)초/)[1]);
      assert.ok(Math.abs(remaining-([5,8,10][level-1]-.05))<.051,'cancel applies the correct rank cooldown');
      assert.ok(Math.abs(parseFloat(get('bolt-fill').style.width)-100*.05/([5,8,10][level-1]))<1e-8,'bar starts near zero for every rank');
    }
    for(let position=0;position<3;position++){
      get('restart').click();debug.dataset.boltLevel='3';debug.click();key('1');
      const expected=generateBoltSequence(getSpellAtLevel('bolt',3).problem,()=>.25);
      for(let i=0;i<position;i++)get('math-answers').children[expected.correctIndices[i]].click();
      const nodes=[...get('math-answers').children];
      nodes[(expected.correctIndices[position]+1)%5].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('Backspace');nodes[expected.correctIndices[position]].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('1');assert.match(get('toast').textContent,/쿨타임/);
    }
    get('restart').click();debug.click();key('1');key('Escape');
    assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/마법 취소/);
    get('restart').click();debug.click();key('1');
    assert.equal(get('math-title').textContent,'');
    assert.match(get('math-problem').innerHTML,/aria-valuenow="0"/);
    assert.match(get('math-problem').innerHTML,/aria-valuemax="3"/);
  }finally{Math.random=random;}
});

function defensiveGameMock() {
  const elements=new Map(),debugs={};
  const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  for(const which of ['bolt','heal','fireball','shield']){
    const button=makeElement(which+'-debug');button.dataset[which+'Level']='1';debugs[which]=button;
  }
  const canvas=get('game');canvas.width=960;canvas.height=600;
  const state={hpWidth:54,frame:null,time:0,arcs:[]};
  const context={measureText:s=>({width:String(s).length*12}),
    fillRect(...args){if(this.fillStyle==='#53df90')state.hpWidth=args[2];},
    arc(...args){state.arcs.push(args);}};
  canvas.getContext=()=>new Proxy(context,{get:(o,k)=>o[k]??(()=>{})});
  const listeners=new Map();
  globalThis.window={location:{search:'?debug=1'},addEventListener:(k,f)=>listeners.set(k,f)};
  globalThis.document={getElementById:get,createElement:makeElement,
    querySelectorAll:selector=>{
      for(const which of Object.keys(debugs))if(selector===`[data-${which}-level]`)return [debugs[which]];
      return [];
    },addEventListener:()=>{},hidden:false};
  globalThis.requestAnimationFrame=fn=>{state.frame=fn;};
  return {get,state,key:key=>listeners.get('keydown')({key,repeat:false,preventDefault(){}}),
    level(which,value){debugs[which].dataset[which+'Level']=String(value);debugs[which].click();},
    step(){state.time+=50;state.frame(state.time);},hp:()=>Math.round(state.hpWidth/54*100)};
}

test('shield key 4 casts every derivative rank and blocks real overlapping melee hits without losing HP',async()=>{
  const {generateBoltSequence}=await import('../src/bolt-sequence.js');
  const {getSpellAtLevel}=await import('../src/spells.js');
  const mock=defensiveGameMock(),{get}=mock;
  const random=Math.random;Math.random=()=>.25;
  try{
    await import('../src/game.js?shield-flow');
    for(let rank=1;rank<=3;rank++){
      get('restart').click();mock.level('shield',rank);mock.key('4');
      const expected=generateBoltSequence(getSpellAtLevel('shield',rank).problem,()=>.25);
      assert.match(get('math-problem').innerHTML,/aria-label="보호막"/);
      for(let i=0;i<rank;i++){
        assert.equal(get('shield-count').textContent,0);
        get('math-answers').children[expected.correctIndices[i]].click();
        assert.equal(get('math-cast-hud').hidden,i===rank-1);
      }
      assert.match(get('toast').textContent,new RegExp(`보호막 ${rank}회 충전`));
      mock.step();assert.equal(get('shield-count').textContent,rank);
      assert.ok(mock.state.arcs.some(a=>a[2]===32),'protective sphere is drawn');
    }
    // The Lv3 shield remains active from the last iteration.
    let previous=3,firstBreak=false,hpHit=false;
    for(let frame=0;frame<450;frame++){
      mock.step();
      const charges=Number(get('shield-count').textContent);
      if(charges<previous){
        assert.equal(previous-charges,1,'one collision cannot consume multiple charges');
        assert.equal(mock.hp(),100,'even the last blocked hit cannot spill into HP');
        previous=charges;
        if(!firstBreak){
          firstBreak=true;
          for(let i=0;i<10;i++)mock.step();
          assert.equal(Number(get('shield-count').textContent),charges,'overlapping enemies respect the .65s immunity');
          assert.equal(mock.hp(),100);
        }
      }
      if(mock.hp()<100){hpHit=true;assert.equal(charges,0);assert.equal(mock.hp(),80);break;}
    }
    assert.ok(firstBreak);assert.ok(hpHit);
    get('restart').click();assert.equal(get('shield-count').textContent,0);
    mock.level('shield',1);get('shield').click();
    const expected=generateBoltSequence(getSpellAtLevel('shield',1).problem,()=>.25);
    get('math-answers').children[(expected.question.correct+1)%5].click();
    assert.match(get('toast').textContent,/오답/);assert.equal(get('shield-count').textContent,0);
  }finally{Math.random=random;}
});

test('healing uses refreshed fireball-style integral runes, requires +C, and heals only on completion at all ranks',async()=>{
  const {generateIntegralSequence}=await import('../src/integral-sequence.js');
  const {getSpellAtLevel}=await import('../src/spells.js');
  const mock=defensiveGameMock(),{get}=mock;
  const random=Math.random;Math.random=()=>.25;
  try{
    await import('../src/game.js?healing-flow');
    for(let rank=1;rank<=3;rank++){
      get('restart').click();mock.step();
      for(let frame=0;frame<300&&mock.hp()===100;frame++)mock.step();
      assert.equal(mock.hp(),80);
      mock.level('heal',rank);mock.key('2');
      const expected=generateIntegralSequence(getSpellAtLevel('heal',rank).problem,()=>.25);
      assert.match(get('math-problem').innerHTML,/aria-label="힐"/);
      let previous=null;
      for(let i=0;i<rank;i++){
        const nodes=[...get('math-answers').children];
        if(previous)assert.ok(nodes.every((node,index)=>node!==previous[index]));
        nodes[expected.correctIndices[i]].click();previous=nodes;
        assert.equal(get('math-cast-hud').hidden,false,'healing cannot finish before +C');
        assert.doesNotMatch(get('toast').textContent,/정답! HP/);
      }
      const final=get('math-answers').children[expected.correctIndices[rank]];
      assert.match(final.children[1].innerHTML,/<mi>C<\/mi>/);final.click();
      assert.equal(get('math-cast-hud').hidden,true);
      assert.match(get('toast').textContent,/정답! HP \+20/);
      mock.step();assert.equal(mock.hp(),100);assert.match(get('heal-state').textContent,/초/);
    }
  }finally{Math.random=random;}
});
