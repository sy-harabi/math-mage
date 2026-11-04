import { term, termKey, termText } from './monomial.js';
import { polynomialText } from './polynomial.js';

const pickIndex = (length,rng) => Math.min(length-1,Math.floor(rng()*length));
export function definiteIntegralOf(source, lower, upper) {
  if(![lower,upper].every(Number.isSafeInteger)) throw new Error('적분 경계는 정수여야 합니다.');
  const t=term(source.num,source.den,source.power),power=t.power+1;
  return term(t.num*(upper**power-lower**power),t.den*power,0);
}
export function sumIntegralTerms(terms) {
  return terms.reduce((a,b)=>term(a.num*b.den+b.num*a.den,a.den*b.den,0),term(0,1,0));
}

/** Five fixed numeric runes: integrate each highlighted term, then add the results. */
export function generateDefiniteIntegralSequence(spec,rng=Math.random) {
  const count=spec.termCount??1;
  const coefficient=spec.coefficient??{min:-6,max:6};
  const exponent=spec.exponent??{min:0,max:2};
  if(spec.kind!=='definiteIntegral'||![count,coefficient.min,coefficient.max,exponent.min,exponent.max].every(Number.isInteger)||
    count<1||count>3||coefficient.min>coefficient.max||coefficient.min< -100||coefficient.max>100||
    exponent.min<0||exponent.max>4||count>exponent.max-exponent.min+1) throw new Error('정적분 문제 설정이 올바르지 않습니다.');
  const intervals=spec.intervals??[[0,1],[0,2],[-1,1]];
  if(!intervals.length||!intervals.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isSafeInteger)&&
    pair[0]<pair[1]&&pair.every(n=>Math.abs(n)<=3))) throw new Error('적분 구간 설정이 올바르지 않습니다.');
  const [lower,upper]=intervals[pickIndex(intervals.length,rng)];
  const powers=Array.from({length:exponent.max-exponent.min+1},(_,i)=>exponent.min+i);
  const inputTerms=[];
  for(let i=0;i<count;i++) {
    const power=powers.splice(pickIndex(powers.length,rng),1)[0];
    const coefficients=[];
    for(let n=coefficient.min;n<=coefficient.max;n++) {
      // Multiples of power+1 give small integer contributions at integer bounds.
      if(n!==0&&(spec.integerResults===false||n%(power+1)===0))coefficients.push(n);
    }
    if(!coefficients.length)throw new Error('이 차수에 사용할 정적분 계수가 없습니다.');
    inputTerms.push(term(coefficients[pickIndex(coefficients.length,rng)],1,power));
  }
  inputTerms.sort((a,b)=>b.power-a.power);
  const answers=inputTerms.map(t=>definiteIntegralOf(t,lower,upper));
  const candidates=[...new Map(answers.map(t=>[termKey(t),t])).values()];
  const add=t=>{if(!candidates.some(c=>termKey(c)===termKey(t)))candidates.push(t);};
  const wrong=[];
  for(const [i,t] of inputTerms.entries()) {
    const a=answers[i];
    wrong.push(term(-a.num,a.den,0),term(t.num*(upper**(t.power+1)-lower**(t.power+1)),t.den,0),
      term(t.num*upper**(t.power+1),t.den*(t.power+1),0),term(a.num+a.den,a.den,0),term(a.num-a.den,a.den,0));
  }
  for(let i=wrong.length-1;i>0;i--){const j=pickIndex(i+1,rng);[wrong[i],wrong[j]]=[wrong[j],wrong[i]];}
  for(const t of wrong){if(candidates.length===5)break;add(t);}
  for(let delta=1;candidates.length<5;delta++)add(term(answers[0].num+delta*answers[0].den,answers[0].den,0));
  for(let i=candidates.length-1;i>0;i--){const j=pickIndex(i+1,rng);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const correctIndices=answers.map(a=>candidates.findIndex(c=>termKey(c)===termKey(a)));
  return {
    question:{prompt:`각 항의 정적분 값을 차례대로 선택: ∫[${lower},${upper}] (${polynomialText(inputTerms)}) dx = ?`,
      choices:candidates.map(termText),correct:correctIndices[0],answer:termText(answers[0]),
      data:{inputTerms,lower,upper,contributions:answers,answerTerms:[sumIntegralTerms(answers)],
        choiceTerms:candidates,choiceTermPolys:candidates.map(t=>[t]),choiceHasConstant:candidates.map(()=>false)}},
    correctIndices,selectedTerms:[],index:0,failed:false,complete:false,
  };
}

export function answerDefiniteIntegral(sequence,index) {
  if(sequence.failed||sequence.complete)return 'inactive';
  if(index!==sequence.correctIndices[sequence.index]){sequence.failed=true;return 'failed';}
  sequence.selectedTerms.push(sequence.question.data.choiceTerms[index]);sequence.index++;
  if(sequence.index===sequence.correctIndices.length){sequence.complete=true;return 'complete';}
  sequence.question.correct=sequence.correctIndices[sequence.index];
  sequence.question.answer=sequence.question.choices[sequence.question.correct];
  return 'next';
}
