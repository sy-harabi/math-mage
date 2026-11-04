/**
 * An upgrade option must receive a fresh pointerdown after the overlay appears.
 * An older touch that started on the battlefield cannot select an upgrade
 * through a delayed or retargeted synthetic click.
 */
export function guardUpgradeButton(button, choose, maxMovement = 18) {
  let press = null;
  button.addEventListener('pointerdown', event => {
    press = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  });
  button.addEventListener('pointermove', event => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > maxMovement) {
      press.moved = true;
    }
  });
  button.addEventListener('pointercancel', event => {
    if (press?.pointerId === event.pointerId) press = null;
  });
  button.addEventListener('click', event => {
    const keyboard = event.detail === 0 && !event.pointerType;
    const freshPress = press !== null && !press.moved &&
      (event.pointerId == null || event.pointerId === press.pointerId);
    press = null;
    if (!keyboard && !freshPress) {
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    choose();
  });
}
