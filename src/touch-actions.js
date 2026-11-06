/**
 * Activate a button as soon as a touch begins, even if another finger holds
 * a joystick pointer capture. Mouse clicks and keyboard activation remain native.
 * Browsers may emit a compatibility click after a touch pointerdown; ignore it.
 */
export function bindTouchAction(button, activate, now = () => Date.now()) {
  let lastTouch = Number.NEGATIVE_INFINITY;
  button.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || button.disabled) return;
    lastTouch = now();
    event.preventDefault();
    activate();
  });
  button.addEventListener('click', event => {
    if (button.disabled) return;
    // Keyboard click has detail=0. It must always work, even right after touch.
    if (event.detail !== 0 && now() - lastTouch < 800) return;
    activate();
  });
}
