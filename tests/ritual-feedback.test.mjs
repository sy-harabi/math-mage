import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpellAtLevel } from '../src/spells.js';
import { generateBoltSequence, answerBolt } from '../src/bolt-sequence.js';
import { generateIntegralSequence, answerIntegral } from '../src/integral-sequence.js';
import { boltSequenceMathML, integralSequenceMathML } from '../src/math-ui.js';
import { captureRuneChoice, animateRuneChoice, clearRitualFeedback } from '../src/ritual-feedback.js';

test('derivatives show d/dx of the source with an aligned equals result, highlighting only the active term',()=>{
  const seq=generateBoltSequence(getSpellAtLevel('bolt',3).problem,()=>.25);
  const before=boltSequenceMathML(seq);
  assert.match(before,/<mfrac><mi mathvariant="normal">d<\/mi><mrow><mi mathvariant="normal">d<\/mi><mi>x<\/mi><\/mrow><\/mfrac><mo>\(<\/mo>/);
  assert.match(before,/<div class="bolt-answer is-empty">.*<mo>=<\/mo>/);
  assert.equal((before.match(/mathsize="112%"/g)||[]).length,1);
  assert.doesNotMatch(before,/<mi>f<\/mi>|<mo>′<\/mo>|ritual-formed-term/);
  answerBolt(seq,seq.question.correct);
  const next=boltSequenceMathML(seq);
  assert.equal((next.match(/mathsize="112%"/g)||[]).length,1);
  assert.equal((next.match(/ritual-formed-term is-new/g)||[]).length,1);
  assert.match(next,/bolt-source-term is-done/);
  for(let i=1;i<3;i++)answerBolt(seq,seq.question.correct);
  const done=boltSequenceMathML(seq);
  assert.doesNotMatch(done,/mathsize="112%"/);
  assert.equal((done.match(/ritual-formed-term/g)||[]).length,3);
});

test('integrals use the same source/result layout and make +C the final arriving term',()=>{
  const seq=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,()=>.25);
  const before=integralSequenceMathML(seq);
  assert.match(before,/<div class="bolt-source">.*<mo>∫<\/mo>/);
  assert.equal((before.match(/mathsize="112%"/g)||[]).length,1);
  for(let i=0;i<3;i++){
    answerIntegral(seq,seq.question.correct);
    const next=integralSequenceMathML(seq);
    assert.doesNotMatch(next,/<mi>C<\/mi>/);
    assert.equal((next.match(/ritual-formed-term is-new/g)||[]).length,1);
  }
  answerIntegral(seq,seq.question.correct);
  const done=integralSequenceMathML(seq);
  assert.match(done,/<mstyle class="ritual-formed-term ritual-constant is-new"><mo>\+<\/mo><mi>C<\/mi><\/mstyle>/);
  assert.equal((done.match(/is-new/g)||[]).length,1);
  assert.equal((done.match(/<mi>C<\/mi>/g)||[]).length,1);
});

function feedbackMock(){
  const nodes=[],mounted=new Set();
  globalThis.window={matchMedia:()=>({matches:false})};
  globalThis.getComputedStyle=()=>({fontSize:'20px',getPropertyValue:()=>'#ffdf79'});
  globalThis.document={body:{append(node){mounted.add(node);}},createElement(){
    const node={style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){mounted.delete(this);},
      animate(frames,options){
        let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});
        this.motion={frames,options,resolve,cancelled:false};
        return {finished,cancel:()=>{this.motion.cancelled=true;reject(Error('cancelled'));}};
      }};
    nodes.push(node);return node;
  }};
  const formula={outerHTML:'<math><mn>6</mn><mi>x</mi></math>',clientHeight:20,
    getBoundingClientRect:()=>({left:100,top:200,width:40,height:20})};
  const button={querySelector:()=>formula};
  const target={getBoundingClientRect:()=>({left:300,top:250,width:32,height:16})};
  const answer={...formula,getBoundingClientRect:()=>({left:260,top:250,width:100,height:20})};
  const problem={querySelector:selector=>selector==='.ritual-formed-term.is-new'?target:answer};
  return {nodes,mounted,button,formula,problem};
}

test('rune motion reaches the new answer position without mutating the choice; completion remains visible briefly',async()=>{
  const mock=feedbackMock();
  const source=captureRuneChoice(mock.button);
  animateRuneChoice(source,mock.problem,true);
  assert.equal(mock.mounted.size,2);
  assert.equal(mock.nodes[0].innerHTML,mock.formula.outerHTML);
  assert.equal(mock.nodes[0].attributes['aria-hidden'],'true');
  assert.equal(mock.nodes[0].motion.options.duration,230);
  assert.equal(mock.nodes[0].motion.frames[1].transform,'translate(196px,48px) scale(0.8)');
  assert.equal(mock.nodes[1].className,'ritual-echo');
  for(const node of mock.nodes)node.motion.resolve();
  await Promise.resolve();assert.equal(mock.mounted.size,0);
});

test('restarting or cancelling removes all pending effects and reduced motion skips flying runes',async()=>{
  const mock=feedbackMock();
  animateRuneChoice(captureRuneChoice(mock.button),mock.problem,true);
  clearRitualFeedback();await Promise.resolve();
  assert.equal(mock.mounted.size,0);assert.ok(mock.nodes.every(n=>n.motion.cancelled));
  globalThis.window.matchMedia=()=>({matches:true});
  assert.equal(captureRuneChoice(mock.button),null);
  animateRuneChoice(null,mock.problem);assert.equal(mock.mounted.size,0);
});
