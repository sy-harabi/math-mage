import { generateQuestion } from './problem-engine.js?v=1.5.1';
import { termKey, termText } from './monomial.js';

function setStage(sequence) {
  const stage=sequence.stages[sequence.index];
  Object.assign(sequence.question,{choices:stage.choices,correct:stage.correct,answer:stage.choices[stage.correct]});
  Object.assign(sequence.question.data,{choiceTerms:stage.terms,
    choiceTermPolys:stage.terms.map(t=>[t]),choiceHasConstant:stage.terms.map(()=>false)});
}

/** Build the derivative left to right, drawing five fresh term runes for every source term. */
export function generateBoltSequence(spec,rng=Math.random) {
  if(spec.kind!=='monomialDerivative')throw new Error('번개에는 미분 문제가 필요합니다.');
  const question=generateQuestion({...spec,answerCount:5},rng);
  const answers=question.data.answerTerms;
  const sourceIndices=answers.map(t=>t.num===0?0:question.data.inputTerms.findIndex(source=>source.power===t.power+1));
  const stages=[];
  answers.forEach((answer,i)=>{
    const source=question.data.inputTerms[sourceIndices[i]];
    const single=generateQuestion({...spec,termCount:1,answerCount:5,
      coefficient:{min:source.num,max:source.num},exponent:{min:source.power,max:source.power}},rng);
    const terms=single.data.choiceTerms.slice();
    // Independent draws can coincide; still change the positions when that happens.
    if(stages.length&&terms.map(termKey).join('|')===stages.at(-1).terms.map(termKey).join('|'))terms.push(terms.shift());
    stages.push({terms,choices:terms.map(termText),correct:terms.findIndex(t=>termKey(t)===termKey(answer))});
  });
  const sequence={question,stages,correctIndices:stages.map(s=>s.correct),sourceIndices,
    selectedTerms:[],index:0,failed:false,complete:false};
  setStage(sequence);return sequence;
}

/** A wrong rune permanently ends this cast; only all terms unlock targeting. */
export function answerBolt(sequence,index) {
  if(sequence.failed||sequence.complete)return 'inactive';
  if(index!==sequence.question.correct){sequence.failed=true;return 'failed';}
  sequence.selectedTerms.push(sequence.question.data.choiceTerms[index]);sequence.index++;
  if(sequence.index===sequence.stages.length){sequence.complete=true;return 'complete';}
  setStage(sequence);return 'next';
}
