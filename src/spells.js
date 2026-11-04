/**
 * Skill levels independently control math difficulty and spell behavior.
 * distractorWeights are per wrong option (formula/signConstant/arithmetic).
 */
const DISTRACTOR_WEIGHTS = Object.freeze({ formula: 0.5, signConstant: 0.2, arithmetic: 0.3 });
export const SPELLS = Object.freeze({
  bolt: {
    name: '번개', cooldownSeconds: 2, damageByJump: [20],
    chainTargets: 1, chainRange: 260,
    problem: {
      kind: 'monomialDerivative', coefficient: { min:-5,max:5 },
      exponent: { min:2,max:4 }, termCount:1,
      answerCount:5, distractorWeights:DISTRACTOR_WEIGHTS,
    },
    levels: {
      2: { chainTargets: 3, damageByJump: [20, 20, 20], problem: { termCount: 2 } },
      3: { chainTargets: 5, damageByJump: [20, 20, 20, 20, 20], problem: { termCount: 3 } },
    },
  },
  heal: {
    name: '힐', cooldownSeconds: 6, power: 20,
    problem: {
      kind: 'monomialIntegral', coefficient: { min:-5,max:5 },
      exponent: { min:1,max:3 }, termCount:1,
      answerCount:5, distractorWeights:DISTRACTOR_WEIGHTS,
    },
    levels: {
      2: { power: 50, problem: { termCount: 2 } },
      3: { power: 80, problem: { termCount: 3 } },
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
