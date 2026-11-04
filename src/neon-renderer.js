import { createLaserSegment } from './laser.js';
import { ENEMY_TYPES } from './enemy-types.js?v=enemy-balance-2';

// Presentation only: world positions, collision radii and attack timing stay in game.js.
export const NEON = Object.freeze({
  hero:'#68efff', basic:'#a0f27a', fast:'#ff728b', ranged:'#da8bff', boss:'#ff9ce8',
});
const TAU=Math.PI*2;
function ring(ctx,x,y,r,color,width=1.5,start=0,end=TAU){
  ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function path(ctx,points,fill,stroke){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.8;ctx.stroke();
}

export function drawNeonArena(ctx,camera,w,h){
  ctx.save();ctx.fillStyle='#080d20';ctx.fillRect(0,0,w,h);
  // World-anchored grid keeps movement readable without resembling attack rings.
  const spacing=64;
  ctx.strokeStyle='#18223d';ctx.lineWidth=.7;
  ctx.beginPath();
  for(let x=Math.floor(camera.x/spacing)*spacing;x<camera.x+w;x+=spacing){
    ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,h);
  }
  for(let y=Math.floor(camera.y/spacing)*spacing;y<camera.y+h;y+=spacing){
    ctx.moveTo(0,y-camera.y);ctx.lineTo(w,y-camera.y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawNeonMage(ctx,p,time){
  ctx.save();ctx.translate(p.x,p.y);
  if(p.inv>0&&Math.floor(time/90)%2===0)ctx.globalAlpha=.4;
  const color=NEON.hero;
  ctx.shadowColor=color;ctx.shadowBlur=7;
  // A stable, upright silhouette; only the staff follows the facing direction.
  path(ctx,[[-12,-5],[-18,20],[-7,17],[0,23],[8,17],[14,20],[10,-5]],'#0a1830',color);
  path(ctx,[[-12,-6],[-9,-18],[9,-18],[13,-6],[8,4],[-8,4]],'#0a1830',color);
  path(ctx,[[-16,-15],[-4,-34],[4,-30],[14,-15],[24,-11],[8,-7],[-23,-10]],'#0b1c33',color);
  ctx.shadowBlur=3;ctx.fillStyle='#efffff';
  ctx.fillRect(-6,-6,3,5);ctx.fillRect(4,-6,3,5);
  const side=Math.cos(p.face)<0?-1:1;
  ctx.save();ctx.translate(side*23,2);ctx.rotate(side*.18);
  ctx.beginPath();ctx.moveTo(0,18);ctx.lineTo(0,-12);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
  path(ctx,[[0,-23],[6,-16],[0,-9],[-6,-16]],'#123a50',color);
  ctx.restore();ctx.restore();
}

export function drawNeonSlime(ctx,e,player){
  const color=NEON[e.type];
  ctx.save();ctx.translate(e.x,e.y);
  const pulse=Math.sin(e.wiggle);
  ctx.scale(1+pulse*.035,1-pulse*.035);
  ctx.shadowColor=color;ctx.shadowBlur=7;
  ctx.fillStyle='#0b1429';ctx.strokeStyle=color;ctx.lineWidth=e.type==='boss'?2.8:1.8;
  const r=e.r;
  ctx.beginPath();
  if(e.type==='fast'){
    // Swept-back fins and an arrow-like face distinguish the fast slime by shape.
    ctx.rotate(Math.atan2(player.y-e.y,player.x-e.x));
    ctx.moveTo(r,0);ctx.quadraticCurveTo(r*.65,-r*.8,-r,-r*.7);
    ctx.lineTo(-r*.6,-r*.2);ctx.lineTo(-r*1.05,r*.15);
    ctx.lineTo(-r*.55,r*.35);ctx.lineTo(-r*.85,r*.7);
    ctx.quadraticCurveTo(r*.55,r*.85,r,0);
  }else{
    ctx.moveTo(-r,r*.5);ctx.quadraticCurveTo(-r*1.1,-r*.8,0,-r);
    ctx.quadraticCurveTo(r*1.1,-r*.8,r,r*.5);
    ctx.quadraticCurveTo(r*.9,r*.8,0,r*.8);
    ctx.quadraticCurveTo(-r*.9,r*.8,-r,r*.5);
  }
  ctx.closePath();ctx.fill();ctx.stroke();
  if(e.type==='ranged'){
    const target=e.aim||player;
    ctx.rotate(Math.atan2(target.y-e.y,target.x-e.x));
    // A cyclopean lens and focusing barrel, never a projectile-shaped crystal.
    const charge=e.windup>0?Math.max(0,Math.min(1,1-e.windup/ENEMY_TYPES.ranged.windup)):0;
    ring(ctx,0,0,r*.63,color,1.5);
    path(ctx,[[r*.48,-6],[r*.96,-6],[r*.96,6],[r*.48,6]],'#17152f',color);
    ring(ctx,r*.12,0,6+charge*2,color,2);
    ctx.beginPath();ctx.arc(r*.12,0,2+charge*3,0,TAU);
    ctx.fillStyle=e.windup>0?'#fff1ff':color;ctx.fill();
    for(const angle of [-Math.PI/2,Math.PI/2,Math.PI]){
      const x=Math.cos(angle)*r*.8,y=Math.sin(angle)*r*.8;
      ctx.beginPath();ctx.moveTo(x*.7,y*.7);ctx.lineTo(x,y);ctx.stroke();
    }
    if(e.windup>0){
      ctx.shadowBlur=10;
      ring(ctx,0,0,r+5,color,2,-Math.PI/2,-Math.PI/2+charge*TAU);
    }
  }else{
    ctx.shadowBlur=3;ctx.fillStyle='#f1fff9';
    if(e.type==='fast'){
      path(ctx,[[r*.25,-r*.4],[r*.58,-r*.28],[r*.32,-r*.12]],'#fff0f3',color);
      path(ctx,[[r*.25,r*.12],[r*.58,r*.28],[r*.32,r*.4]],'#fff0f3',color);
    }else{
      ctx.fillRect(-r*.32,-r*.2,Math.max(3,r*.12),r*.28);
      ctx.fillRect(r*.2,-r*.2,Math.max(3,r*.12),r*.28);
    }
  }
  if(e.type==='boss'){
    path(ctx,[[-24,-r+3],[-24,-r-13],[-12,-r-5],[0,-r-22],[12,-r-5],[24,-r-13],[24,-r+3]],'#2a163a','#ffd780');
    ring(ctx,0,0,r+7,color,1,Math.PI*.12,Math.PI*.88);
  }
  ctx.restore();
}

/** Warning rails use exactly the same source, aim, range and width as hit detection. */
export function drawLaserWarning(ctx,e,spec){
  if(!(e.windup>0&&e.aim))return;
  const beam=createLaserSegment(e,e.aim,spec.laserRange);
  const dx=beam.x2-beam.x1,dy=beam.y2-beam.y1,n=Math.hypot(dx,dy)||1;
  const ox=-dy/n*spec.laserWidth/2,oy=dx/n*spec.laserWidth/2;
  const charge=Math.max(0,Math.min(1,1-e.windup/spec.windup));
  ctx.save();ctx.lineCap='butt';ctx.strokeStyle=NEON.ranged;
  ctx.globalAlpha=.08+charge*.09;ctx.lineWidth=spec.laserWidth;
  ctx.beginPath();ctx.moveTo(beam.x1,beam.y1);ctx.lineTo(beam.x2,beam.y2);ctx.stroke();
  ctx.globalAlpha=.45+charge*.4;ctx.lineWidth=1;ctx.setLineDash([7,6]);
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(beam.x1+side*ox,beam.y1+side*oy);
    ctx.lineTo(beam.x2+side*ox,beam.y2+side*oy);ctx.stroke();
  }
  ctx.restore();
}

export function drawNeonLaser(ctx,laser){
  ctx.save();ctx.lineCap='butt';ctx.strokeStyle=NEON.ranged;
  ctx.shadowColor=NEON.ranged;ctx.shadowBlur=10;
  ctx.globalAlpha=.8;ctx.lineWidth=laser.width;
  ctx.beginPath();ctx.moveTo(laser.x1,laser.y1);ctx.lineTo(laser.x2,laser.y2);ctx.stroke();
  ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.strokeStyle='#fff0ff';ctx.lineWidth=5;ctx.stroke();
  ctx.restore();
}
