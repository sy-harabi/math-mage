export const HIT_INVULNERABILITY_SECONDS = .65;
export const MAX_SHIELD_CHARGES = 5;

/** Each cast adds rank-based charges, up to five total. */
export function grantShield(player,charges) {
  if(!Number.isInteger(charges)||charges<1||charges>3)throw new Error('보호막은 1~3회여야 합니다.');
  player.shields=Math.min(MAX_SHIELD_CHARGES,(player.shields??0)+charges);
  return player.shields;
}

/** All melee, laser and boss hits share the same shield and invulnerability gate. */
export function applyPlayerHit(player,amount) {
  if(!Number.isFinite(amount)||amount<=0)throw new Error('피해량이 올바르지 않습니다.');
  if(player.inv>0)return {ignored:true,blocked:false,damage:0};
  player.inv=HIT_INVULNERABILITY_SECONDS;
  if((player.shields??0)>0){
    player.shields--;player.shieldFlash=.3;
    return {ignored:false,blocked:true,damage:0};
  }
  const damage=Math.min(player.hp,amount);
  player.hp=Math.max(0,player.hp-amount);
  return {ignored:false,blocked:false,damage};
}
