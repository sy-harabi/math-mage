// Touch controls are separate from the desktop keyboard/mouse input.
export function joystickVector(dx, dy, radius, deadZone = 0.12) {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return {x: 0, y: 0};
  const distance = Math.hypot(dx, dy);
  const strength = Math.min(1, distance / radius);
  if (strength <= deadZone) return {x: 0, y: 0};
  const scaled = (strength - deadZone) / (1 - deadZone);
  return {x: dx / distance * scaled, y: dy / distance * scaled};
}

export function bindJoystick(base, thumb, onMove) {
  let activePointer = null;
  function move(ev) {
    const rect = base.getBoundingClientRect();
    // Keep the thumb inside the ring while allowing full-speed movement.
    const radius = rect.width * 0.29;
    const vector = joystickVector(
      ev.clientX - (rect.left + rect.width / 2),
      ev.clientY - (rect.top + rect.height / 2), radius
    );
    thumb.style.transform = `translate(${vector.x * radius}px, ${vector.y * radius}px)`;
    onMove(vector);
  }
  function reset() {
    if (activePointer === null) return;
    const oldPointer = activePointer;
    activePointer = null;
    thumb.style.transform = '';
    onMove({x: 0, y: 0});
    if (base.hasPointerCapture?.(oldPointer)) base.releasePointerCapture(oldPointer);
  }
  base.addEventListener('pointerdown', ev => {
    if (activePointer !== null) return;
    ev.preventDefault();
    activePointer = ev.pointerId;
    base.setPointerCapture(ev.pointerId);
    move(ev);
  });
  base.addEventListener('pointermove', ev => {
    if (ev.pointerId !== activePointer) return;
    ev.preventDefault();
    move(ev);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    base.addEventListener(type, ev => { if (ev.pointerId === activePointer) reset(); });
  }
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {reset};
}
