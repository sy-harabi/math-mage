import test from 'node:test';
import assert from 'node:assert/strict';
import { polynomialMathML, integralChoiceMathML } from '../src/math-ui.js';
import { term } from '../src/monomial.js';

test('appended positive runes show + for integers, unit coefficients and fractions, without changing first terms or minus signs',()=>{
  for(const value of [term(3,1,2),term(1,1,1),term(1,3,3),term(4,1,0)]){
    assert.doesNotMatch(polynomialMathML([value]),/<mrow><mo>\+<\/mo>/);
    assert.match(polynomialMathML([value],false,true),/<mrow><mo>\+<\/mo>/);
    const negative=polynomialMathML([{...value,num:-value.num}],false,true);
    assert.match(negative,/<mrow><mo>−<\/mo>/);assert.doesNotMatch(negative,/<mo>\+<\/mo>/);
  }
  assert.match(polynomialMathML([term(1,3,3)],false,true),/<mo>\+<\/mo><mfrac>/);
  assert.match(polynomialMathML([term(0,1,0)],false,true),/<mrow><mn>0<\/mn>/);
});

test('integral choices retain exactly one +C and keep standalone zero distinct from +C',()=>{
  const question={data:{choiceKinds:['constant','term','term'],choiceTermPolys:[[],[term(1,3,3)],[term(0,1,0)]]}};
  for(const append of [false,true]){
    const constant=integralChoiceMathML(question,0,append);
    assert.equal((constant.match(/<mo>\+<\/mo>/g)||[]).length,1);
    assert.match(constant,/<mo>\+<\/mo><mi>C<\/mi>/);assert.doesNotMatch(constant,/<mn>0<\/mn>/);
    assert.match(integralChoiceMathML(question,2,append),/<mrow><mn>0<\/mn>/);
  }
  assert.match(integralChoiceMathML(question,1,true),/<mrow><mo>\+<\/mo><mfrac>/);
});
