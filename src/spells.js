/**
 * Skill levels independently control math difficulty and spell behavior.
 * distractorWeights are per wrong option (formula/signConstant/arithmetic).
 */
const DISTRACTOR_WEIGHTS = Object.freeze({ formula: 0.5, signConstant: 0.2, arithmetic: 0.3 });
const DERIVATIVE_PROBLEM = {
  kind:'monomialDerivative',coefficient:{min:-5,max:5},exponent:{min:2,max:4},
  termCount:1,answerCount:5,distractorWeights:DISTRACTOR_WEIGHTS,
};
const INTEGRAL_PROBLEM = {
  kind:'monomialIntegral',coefficient:{min:-5,max:5},exponent:{min:0,max:2},
  termCount:1,answerCount:5,distractorWeights:DISTRACTOR_WEIGHTS,
};
export const SPELLS = Object.freeze({
  bolt: {
    name: '번개', cooldownSeconds: 2, damageByJump: [20],
    chainTargets: 1, chainRange: 260,
    problem: DERIVATIVE_PROBLEM,
    levels: {
      2: { cooldownSeconds: 5, chainTargets: 3, damageByJump: [30, 30, 30], problem: { termCount: 2 } },
      3: { cooldownSeconds: 8, chainTargets: 5, damageByJump: [40, 40, 40, 40, 40], problem: { termCount: 3 } },
    },
  },
  heal: {
    name: '힐', cooldownSeconds: 6, power: 20,
    problem: INTEGRAL_PROBLEM,
    levels: {
      2: { power: 50, problem: { termCount: 2 } },
      3: { power: 80, problem: { termCount: 3 } },
    },
  },
  fireball: {
    name: '파이어볼', cooldownSeconds: 5, power: 10,
    // One basic slime's diameter (42 world pixels) as the explosion radius.
    radius: 42,
    problem: INTEGRAL_PROBLEM,
    levels: {
      2: { cooldownSeconds: 8, power: 30, problem: { termCount: 2 } },
      3: { cooldownSeconds: 10, power: 70, problem: { termCount: 3 } },
    },
  },
  shield: {
    name:'보호막',cooldownSeconds:5,blocks:1,problem:DERIVATIVE_PROBLEM,
    levels:{
      2:{cooldownSeconds:8,blocks:2,problem:{termCount:2}},
      3:{cooldownSeconds:10,blocks:3,problem:{termCount:3}},
    },
  },
});

/** Resolves just the requested spell level; does not mutate the shared config. */
export function getSpellAtLevel(id, level = 1) {
  const base = SPELLS[id];
  if (!base) throw new Error(`Unknown spell ${id}`);
  if (!Number.isInteger(level) || level < 1) throw new Error('Spell level must be positive.');
  if (level === 1) return base;
  const levelSettings=base.levels?.[level];
  if (!levelSettings) throw new Error(`Spell ${id} level ${level} is not defined.`);
  return { ...base, ...levelSettings,
    problem: { ...base.problem, ...levelSettings.problem } };
}

