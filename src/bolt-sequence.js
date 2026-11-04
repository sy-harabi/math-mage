import { generateQuestion } from './problem-engine.js?v=bolt-terms-1';
import { termKey, termText } from './monomial.js';

/** Five fixed term runes; build the derivative from left to right. */
export function generateBoltSequence(spec, rng = Math.random) {
  if (spec.kind !== 'monomialDerivative') throw new Error('번개에는 미분 문제가 필요합니다.');
  const question = generateQuestion({ ...spec, answerCount: 5 }, rng);
  const answers = question.data.answerTerms;
  const keys = new Set(answers.map(termKey));
  const first = question.data.inputTerms[0];
  // Reuse the reviewed single-term distractors, excluding every required term.
  const single = generateQuestion({ ...spec, termCount: 1, answerCount: 5,
    coefficient: { min: first.num, max: first.num },
    exponent: { min: first.power, max: first.power } }, rng);
  const wrong = single.data.choiceTerms.filter(t => !keys.has(termKey(t)));
  const candidates = [...answers, ...wrong.slice(0, 5 - answers.length)];
  if (candidates.length !== 5) throw new Error('번개 항 후보가 부족합니다.');
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const correctIndices = answers.map(t => candidates.findIndex(c => termKey(c) === termKey(t)));
  return {
    question: { ...question, choices: candidates.map(termText), correct: correctIndices[0],
      data: { ...question.data, choiceTerms: candidates,
        choiceTermPolys: candidates.map(t => [t]), choiceHasConstant: candidates.map(() => false) } },
    correctIndices,
    sourceIndices: answers.map(t => t.num === 0 ? 0 : question.data.inputTerms.findIndex(source => source.power === t.power + 1)),
    selectedTerms: [], index: 0, failed: false, complete: false,
  };
}

/** A wrong rune permanently ends this cast; only all terms unlock targeting. */
export function answerBolt(sequence, index) {
  if (sequence.failed || sequence.complete) return 'inactive';
  if (index !== sequence.correctIndices[sequence.index]) {
    sequence.failed = true;
    return 'failed';
  }
  sequence.selectedTerms.push(sequence.question.data.choiceTerms[index]);
  sequence.index++;
  if (sequence.index === sequence.correctIndices.length) {
    sequence.complete = true;
    return 'complete';
  }
  sequence.question.correct = sequence.correctIndices[sequence.index];
  return 'next';
}
