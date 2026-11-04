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
    attributes:{},setAttribute(name,value){this.attributes[name]=value;},
    setPointerCapture(){},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=[...items];},
    addEventListener(type,fn){listeners.set(type,fn);},
    click(){listeners.get('click')?.();},
    getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:960,height:600};},
    _listeners:listeners,
  };
}

function assertChoiceSigns(nodes,stage,afterFirst){
  nodes.forEach((node,index)=>{
    const term=(stage.terms||stage.choiceTerms)[index];
    const markup=node.children[1].innerHTML;
    const plus=afterFirst&&term?.num>0;
    assert.equal(node.attributes['aria-label'],`${index+1}번: ${plus?'+':''}${stage.choices[index]}`);
    if(term?.num>0)assert.equal(/<mrow><mo>\+<\/mo>/.test(markup),afterFirst);
    else if(term?.num<0){assert.match(markup,/<mrow><mo>−<\/mo>/);assert.doesNotMatch(markup,/<mo>\+<\/mo><mo>−<\/mo>/);}
    else if(stage.choiceKinds?.[index]==='constant')assert.match(markup,/<mrow><mo>\+<\/mo><mi>C<\/mi>/);
  });
}

test('debug stage buttons jump safely through stages 1–7, keep the build, and remain disabled in normal play',async()=>{
  assert.match(html,/<div id="stage-picker"[^>]*hidden/);
  const numbers=[...html.matchAll(/data-debug-stage="(\d+)"/g)].map(match=>Number(match[1]));
  assert.deepEqual(numbers,[1,2,3,4,5,6,7]);
  for(const debug of [false,true]){
    const elements=new Map();
    const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
    const group=get('stage-picker');group.hidden=true;
    const buttons=numbers.map(number=>{
      const button=makeElement(`test-stage-${number}`);button.dataset.debugStage=String(number);
      button.attributes={};button.setAttribute=(key,value)=>{button.attributes[key]=value;};return button;
    });
    const canvas=get('game');canvas.width=960;canvas.height=600;
    canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
    globalThis.window={location:{search:debug?'?debug=1':''},addEventListener(){}};
    globalThis.document={getElementById:get,createElement:makeElement,addEventListener(){},hidden:false,
      querySelectorAll:selector=>selector==='[data-debug-stage]'?buttons:selector==='.debug-level-picker'?[group]:[]};
    globalThis.requestAnimationFrame=()=>{};
    const hook=`globalThis.__stageTest={get state(){return {p,progression,stage,mode,runTimer,enemies,lasers,bolts,explosions,gameOver};},
      begin,tick,updateUI,selectDebugStage,hurtPlayer,completeRun};`;
    const source=readFileSync(new URL('../src/game.js',import.meta.url),'utf8')
      .replaceAll("from './",`from '${new URL('../src/',import.meta.url).href}`)
      .replace('updateRuneScale();reset();requestAnimationFrame(loop);',hook+'updateRuneScale();reset();requestAnimationFrame(loop);')+`\n// debug stage test: ${debug}`;
    try{
      await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
      const t=globalThis.__stageTest;
      assert.equal(group.hidden,!debug);
      if(!debug){buttons[6].click();t.selectDebugStage(7);assert.equal(t.state.stage.number,1);continue;}
      assert.equal(buttons[0].attributes['aria-pressed'],'true');
      const player=t.state.p,progression=t.state.progression;
      player.levels.bolt=3;player.levels.heal=2;player.bonuses.vitality=1;
      player.maxHp=125;player.hp=30;progression.level=4;progression.xp=57;
      t.begin('bolt');assert.equal(t.state.mode,'question');
      player.cd.heal=4;t.state.runTimer.elapsedSeconds=123;
      t.state.lasers.push({ttl:1});t.state.bolts.push({ttl:1});t.state.explosions.push({ttl:1});
      buttons[4].click();
      assert.equal(t.state.stage.number,5);assert.equal(t.state.mode,'idle');
      assert.equal(get('math-cast-hud').hidden,true);assert.equal(t.state.enemies.length,0);
      assert.equal(t.state.lasers.length+t.state.bolts.length+t.state.explosions.length,0);
      assert.equal(t.state.runTimer.elapsedSeconds,0);assert.equal(player.hp,125);
      assert.equal(player.cd.heal,0);assert.equal(t.state.p,player);assert.equal(t.state.progression,progression);
      assert.deepEqual([player.levels.bolt,player.levels.heal,player.bonuses.vitality,progression.level,progression.xp],[3,2,1,4,57]);
      assert.equal(get('xp-label').textContent,'3/30');
      t.state.stage.progress=100;t.tick(.05);t.updateUI();
      assert.equal(t.state.stage.number,6);assert.equal(buttons[5].attributes['aria-pressed'],'true');
      for(const button of buttons){
        button.click();assert.equal(t.state.stage.number,Number(button.dataset.debugStage));
        assert.equal(button.attributes['aria-pressed'],'true');
        assert.equal(t.state.stage.progress,0);assert.equal(t.state.stage.elapsed,0);
        assert.equal(t.state.enemies.filter(e=>e.type==='boss').length,button===buttons[6]?1:0);
      }
      buttons[6].click();assert.equal(t.state.enemies.length,1,'reselecting stage 7 replaces the prior boss');
      for(const value of [0,8,1.5,NaN])t.selectDebugStage(value);
      assert.equal(t.state.stage.number,7);
      t.hurtPlayer(1000,'test');assert.equal(t.state.gameOver,true);
      buttons[5].click();assert.equal(t.state.gameOver,false);assert.equal(player.hp,125);assert.equal(t.state.mode,'idle');
      t.completeRun();assert.equal(get('victory-overlay').hidden,false);
      buttons[6].click();assert.equal(get('victory-overlay').hidden,true);assert.equal(t.state.mode,'idle');
      assert.equal(t.state.enemies.length,1);assert.equal(t.state.runTimer.elapsedSeconds,0);
    }finally{delete globalThis.__stageTest;}
  }
});

test('rock game integration: stage transitions, landing, shields, airborne click and boss victory',async()=>{
  const elements=new Map();
  const get=id=>{if(!ids.has(id))return null;if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  const canvas=get('game');canvas.width=960;canvas.height=600;
  canvas.getContext=()=>new Proxy({measureText:s=>({width:String(s).length*12})},{get:(o,k)=>o[k]??(()=>{})});
  globalThis.window={location:{search:''},addEventListener(){}};
  globalThis.document={getElementById:get,createElement:makeElement,querySelectorAll:()=>[],addEventListener(){},hidden:false};
  globalThis.requestAnimationFrame=()=>{};
  // Expose closure state only in the test copy; production has no debug backdoor.
  const hook=`globalThis.__rockIntegration={get state(){return {p,enemies,stage,mode,runTimer};},
    reset,tick,draw,updateUI,updateHiddenPhase,killedEnemy,spawnEnemy,keys,
    setPhase(number,progress=0){stage=createStage(number);stage.progress=progress;enemies=[];spawnTimer=100;updateHiddenPhase();},
    targetBolt(){mode='target';spell='bolt';activeCastConfig=getSpellAtLevel('bolt',3);}};`;
  const source=readFileSync(new URL('../src/game.js',import.meta.url),'utf8')
    .replaceAll("from './",`from '${new URL('../src/',import.meta.url).href}`)
    .replace('updateRuneScale();reset();requestAnimationFrame(loop);',hook+'updateRuneScale();reset();requestAnimationFrame(loop);');
  try{
    await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const t=globalThis.__rockIntegration;
    t.setPhase(5,100);assert.equal(t.state.stage.number,6);assert.equal(t.state.enemies.length,0);
    t.setPhase(6,100);assert.equal(t.state.stage.number,7);assert.equal(t.state.stage.progress,0);
    assert.equal(t.state.enemies.filter(e=>e.type==='boss').length,1);
    assert.equal(t.state.enemies[0].speed,160);
    t.updateHiddenPhase();t.updateHiddenPhase();assert.equal(t.state.enemies.length,1);

    t.reset();t.setPhase(5);
    const e=t.spawnEnemy('rock',t.state.p.x-300,t.state.p.y);e.jumpCooldown=0;
    t.tick(.05);assert.equal(e.action,'windupJump');t.draw();
    t.keys.add('d');for(let i=0;i<18;i++)t.tick(.05);t.keys.clear();
    assert.equal(e.action,'jump');assert.ok(e.jumpHeight>80);
    t.targetBolt();t.draw();
    const click={clientX:e.x-(t.state.p.x-480),clientY:e.y-e.jumpHeight-(t.state.p.y-300),preventDefault(){}};
    canvas._listeners.get('pointermove')(click);t.draw();canvas._listeners.get('pointerdown')(click);
    assert.equal(e.hp,20,'airborne visible body receives the click and lightning damage');
    for(let i=0;i<15;i++)t.tick(.05);
    assert.equal(t.state.p.hp,100,'moving away from the locked target avoids landing');

    for(const shield of [false,true]){
      t.reset();t.setPhase(6);t.state.p.shields=Number(shield);
      const e=t.spawnEnemy('rock',t.state.p.x-300,t.state.p.y);e.jumpCooldown=0;
      for(let i=0;i<25;i++)t.tick(.05);
      assert.equal(t.state.p.hp,shield?100:74);assert.equal(t.state.p.shields,0);
      assert.equal(e.action,'recoverJump');t.draw();
    }
    t.reset();t.setPhase(7);const boss=t.state.enemies[0];boss.hp=0;t.killedEnemy(boss);
    assert.equal(t.state.mode,'victory');assert.equal(get('victory-overlay').hidden,false);
    t.tick(.05);assert.equal(t.state.enemies.filter(e=>e.type==='boss').length,0);
  }finally{delete globalThis.__rockIntegration;}
});

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
  assert.equal(get('bolt').disabled,false);
  assert.equal(get('bolt-state').textContent,'Lv1 · 준비');
  assert.equal(get('xp-label').textContent,'0/12');
  for(const [id,key] of [['fireball','2'],['shield','3'],['heal','4']]){
    assert.equal(get(id).disabled,true);assert.equal(get(id+'-state').textContent,'미습득');
    assert.equal(get(id+'-fill').style.width,'0%');
    get(id).click();assert.equal(get('math-cast-hud').hidden,true);
    windowListeners.get('keydown')({key,repeat:false,preventDefault(){}});
    assert.equal(get('math-cast-hud').hidden,true);
  }
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
      get('restart').click();debug.dataset.fireballLevel=String(level);debug.click();key('2');
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
        assertChoiceSigns(nodes,expected.stages[i],i>0);
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
    get('restart').click();debug.dataset.fireballLevel='3';debug.click();key('2');key('d');
    for(let t=201;t<=651;t+=50){translations.length=0;frame(t);}
    listeners.get('keyup')({key:'d'});
    const expected=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,()=>.25);
    for(const index of expected.correctIndices)get('math-answers').children[index].click();
    const target={clientX:translations[1][0]+translations[0][0],clientY:translations[1][1]+translations[0][1],preventDefault(){}};
    assert.ok(target.clientX>=0&&target.clientX<=960&&target.clientY>=0&&target.clientY<=600);
    canvas._listeners.get('pointerdown')(target);
    assert.match(get('toast').textContent,/2개체 타격 · 2마리 처치/,'both enemies take damage immediately, before a frame');
    frame(701);assert.equal(get('kills').textContent,2);assert.equal(get('xp-label').textContent,'0/18');
    assert.equal(get('character-level').textContent,2);
    assert.equal(get('upgrade-overlay').hidden,false);
    const learn=get('upgrade-options').children.find(button=>button.dataset.upgradeId==='shield');
    assert.ok(learn);assert.equal(learn.children[0].children[1].textContent,'Lv1 습득');
    const pausedTime=get('run-time').textContent;
    const pausedXp=get('xp-label').textContent;
    frame(10701);frame(20701);
    assert.equal(get('run-time').textContent,pausedTime,'twenty seconds spent choosing are excluded');
    assert.equal(get('xp-label').textContent,pausedXp);
    learn._listeners.get('click')({detail:0});
    frame(20751);
    assert.notEqual(get('run-time').textContent,pausedTime,'the run timer resumes after selecting');
assert.equal(get('upgrade-overlay').hidden,true);
    assert.equal(get('shield').disabled,false);assert.equal(get('shield-state').textContent,'Lv1 · 준비');
    key('3');assert.equal(get('math-cast-hud').hidden,false);
    assert.equal(get('math-cast-hud').dataset.terms,'1');
    const solvingStart=get('run-time').textContent;
    frame(30751);
    assert.notEqual(get('run-time').textContent,solvingStart,'spell solving remains part of the run time');
    get('restart').click();
    for(const id of ['heal','fireball','shield']){
      assert.equal(get(id).disabled,true);assert.equal(get(id+'-state').textContent,'미습득');
    }
    for(let position=0;position<4;position++){
      get('restart').click();debug.dataset.fireballLevel='3';debug.click();get('fireball').click();
      const expected=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,()=>.25);
      for(let i=0;i<position;i++)get('math-answers').children[expected.correctIndices[i]].click();
      const nodes=get('math-answers').children;
      nodes[(expected.correctIndices[position]+1)%5].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('Backspace');nodes[expected.correctIndices[position]].click();
      assert.equal(get('math-cast-hud').hidden,true);assert.match(get('toast').textContent,/오답/);
      key('2');assert.match(get('toast').textContent,/쿨타임/);
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
        assertChoiceSigns(nodes,expected.stages[i],i>0);
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
      assert.ok(Math.abs(remaining-([2,5,8][level-1]-.05))<.051,'cancel applies the correct rank cooldown');
      assert.ok(Math.abs(parseFloat(get('bolt-fill').style.width)-100*.05/([2,5,8][level-1]))<1e-8,'bar starts near zero for every rank');
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

test('shield key 3 casts every derivative rank and blocks real overlapping melee hits without losing HP',async()=>{
  const {generateBoltSequence}=await import('../src/bolt-sequence.js');
  const {getSpellAtLevel}=await import('../src/spells.js');
  const mock=defensiveGameMock(),{get}=mock;
  const random=Math.random;Math.random=()=>.25;
  try{
    await import('../src/game.js?shield-flow');
    for(let rank=1;rank<=3;rank++){
      get('restart').click();mock.level('shield',rank);mock.key('3');
      const expected=generateBoltSequence(getSpellAtLevel('shield',rank).problem,()=>.25);
      assert.match(get('math-problem').innerHTML,/aria-label="보호막"/);
      for(let i=0;i<rank;i++){
        assert.equal(get('shield-count').textContent,0);
        assertChoiceSigns(get('math-answers').children,expected.stages[i],i>0);
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
      mock.level('heal',rank);mock.key('4');
      const expected=generateIntegralSequence(getSpellAtLevel('heal',rank).problem,()=>.25);
      assert.match(get('math-problem').innerHTML,/aria-label="힐"/);
      let previous=null;
      for(let i=0;i<rank;i++){
        const nodes=[...get('math-answers').children];
        assertChoiceSigns(nodes,expected.stages[i],i>0);
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

