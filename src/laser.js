/** Locked, telegraphed laser from source towards aimed point. */
export function createLaserSegment(source, target, range) {
  if (!(Number.isFinite(range) && range > 0)) throw new Error('Laser range must be positive');
  const dx = target.x-source.x, dy = target.y-source.y;
  const norm=Math.hypot(dx,dy)||1;
  return {x1:source.x,y1:source.y,x2:source.x+dx/norm*range,y2:source.y+dy/norm*range};
}

/** Point/circle vs finite laser segment; includes character collision radius. */
export function laserHitsPoint(segment, point, width, radius = 0) {
  const dx=segment.x2-segment.x1,dy=segment.y2-segment.y1;
  const denom=dx*dx+dy*dy;
  const t=denom===0?0:Math.max(0,Math.min(1,((point.x-segment.x1)*dx+(point.y-segment.y1)*dy)/denom));
  const cx=segment.x1+dx*t,cy=segment.y1+dy*t;
  return Math.hypot(point.x-cx,point.y-cy)<=width/2+radius;
}
