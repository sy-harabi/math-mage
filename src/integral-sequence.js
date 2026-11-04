import { generateQuestion } from './problem-engine.js?v=1.5.1';
import { term, termKey, termText } from './monomial.js';

const keyOf=choice=>choice.kind==='constant'?'constant:C':termKey(choice.term);
const textOf=choice=>choice.kind==='constant'?'+ C':termText(choice.term);
function stageChoices(source,answer,spec,rng,previous) {
  const constant=!source;
  const candidates=[constant?{kind:'constant'}:{kind:'term',term:answer}];
  const keys=new Set(candidates.map(keyOf));
  const add=choice=>{
    const key=keyOf(choice);
    if(constant&&choice.kind==='term'&&choice.term.num===0)return;
    if(candidates.length<5&&!keys.has(key)){candidates.push(choice);keys.add(key);}
  };
  if(!constant){
    // +C is a real rune, but it completes the expression only AFTER all terms.
    add({kind:'constant'});
    const single=generateQuestion({...spec,termCount:1,answerCount:5,
      coefficient:{min:source.num,max:source.num},exponent:{min:source.power,max:source.power}},rng);
    single.data.choiceTerms.forEach(t=>add({kind:'term',term:t}));
  }
  // Nonconstant extra terms are wrong at the +C step. Avoid -C and other
  // equivalent names for an arbitrary constant as distractors.
  for(let delta=1;candidates.length<5;delta++){
    add({kind:'term',term:term(answer.num+delta*answer.den,answer.den,answer.power)});
    const other=term(answer.num-delta*answer.den,answer.den,answer.power);
    if(!constant||other.num!==0)add({kind:'term',term:other});
  }
  for(let i=candidates.length-1;i>0;i--){
    const j=Math.min(i,Math.floor(rng()*(i+1)));
    [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  // Refresh positions even in the rare case two independently drawn decks match.
  if(previous&&candidates.map(keyOf).join('|')===previous.keys.join('|'))candidates.push(candidates.shift());
  const correctKey=constant?'constant:C':termKey(answer);
  return {keys:candidates.map(keyOf),choices:candidates.map(textOf),correct:candidates.findIndex(c=>keyOf(c)===correctKey),
    choiceKinds:candidates.map(c=>c.kind),choiceTerms:candidates.map(c=>c.term??null),
    choiceTermPolys:candidates.map(c=>c.term?[c.term]:[]),choiceHasConstant:candidates.map(c=>c.kind==='constant')};
}
function setStage(sequence) {
  const stage=sequence.stages[sequence.index];
  Object.assign(sequence.question,{choices:stage.choices,correct:stage.correct,answer:stage.choices[stage.correct]});
  for(const key of ['choiceKinds','choiceTerms','choiceTermPolys','choiceHasConstant'])sequence.question.data[key]=stage[key];
}

/** Integrate each source term, refreshing five runes after every answer, then choose +C. */
export function generateIntegralSequence(spec,rng=Math.random) {
  if(spec.kind!=='monomialIntegral')throw new Error('파이어볼에는 부정적분 문제가 필요합니다.');
  const question=generateQuestion({...spec,answerCount:5},rng);
  const answers=question.data.answerTerms,stages=[];
  question.data.inputTerms.forEach((source,i)=>stages.push(stageChoices(source,answers[i],spec,rng,stages.at(-1))));
  stages.push(stageChoices(null,answers[0],spec,rng,stages.at(-1)));
  const sequence={question:{...question,prompt:`왼쪽 항부터 부정적분 조합 후 +C 선택: ${question.prompt}`},
    stages,correctIndices:stages.map(s=>s.correct),selectedTerms:[],selectedConstant:false,index:0,failed:false,complete:false};
  setStage(sequence);return sequence;
}

/** A wrong term or a premature +C fails immediately; every cast needs its final +C. */
export function answerIntegral(sequence,index) {
  if(sequence.failed||sequence.complete)return 'inactive';
  if(index!==sequence.question.correct){sequence.failed=true;return 'failed';}
  if(sequence.question.data.choiceKinds[index]==='constant')sequence.selectedConstant=true;
  else sequence.selectedTerms.push(sequence.question.data.choiceTerms[index]);
  sequence.index++;
  if(sequence.index===sequence.stages.length){sequence.complete=true;return 'complete';}
  setStage(sequence);return 'next';
}
