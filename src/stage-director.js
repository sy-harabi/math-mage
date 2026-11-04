/** Stage progress is separate from character XP. All time is game-time. */
export const PROGRESS_PER_SECOND = 0.6;
export const BOSS_APPEAR_PROGRESS = 70;

export function createStage(number = 1) {
  if (!Number.isInteger(number) || number < 1) throw new Error('Invalid stage');
  return { number, progress: 0, elapsed: 0, kills: 0, bossSpawned: false, bossDefeated: false };
}

export const isBossStage = number => number % 5 === 0;

export function addStageTime(stage, seconds) {
  if (seconds < 0 || !Number.isFinite(seconds)) throw new Error('Invalid duration');
  stage.elapsed += seconds;
  stage.progress = Math.min(isBossStage(stage.number) && !stage.bossDefeated ? 99 : 100,
    stage.progress + seconds * PROGRESS_PER_SECOND);
  return stage;
}

export function addStageKill(stage, enemy) {
  stage.kills += 1;
  if (enemy.type === 'boss') {
    stage.bossDefeated = true;
    stage.progress = 100;
  } else {
    stage.progress = Math.min(isBossStage(stage.number) && !stage.bossDefeated ? 99 : 100,
      stage.progress + enemy.stageProgress);
  }
  return stage;
}

export function bossShouldSpawn(stage) {
  return isBossStage(stage.number) && !stage.bossSpawned &&
    stage.progress >= BOSS_APPEAR_PROGRESS;
}

export function stageIsComplete(stage) {
  return stage.progress >= 100 && (!isBossStage(stage.number) || stage.bossDefeated);
}
