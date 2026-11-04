// Visual feedback is independent of casting, cooldowns and the game clock.
const effects = new Set();

export function captureRuneChoice(button) {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const formula = button?.querySelector?.('.answer-formula math');
  if (!formula) return null;
  const rect = formula.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;
  const scale = rect.height / (formula.clientHeight || rect.height);
  return { html: formula.outerHTML, rect,
    fontSize: parseFloat(getComputedStyle(formula).fontSize) * scale,
    color: getComputedStyle(button).getPropertyValue('--rune').trim() || '#ffdf79' };
}

function playEffect(node, frames, options) {
  if (typeof node.animate !== 'function') return;
  document.body.append(node);
  const animation = node.animate(frames, options);
  const effect = { animation, remove() { node.remove(); effects.delete(effect); } };
  effects.add(effect);
  animation.finished.then(() => effect.remove(), () => effect.remove());
}

function floatingFormula(html, rect, fontSize, color, className) {
  const node = document.createElement('div');
  node.className = className; node.setAttribute('aria-hidden', 'true'); node.innerHTML = html;
  Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, fontSize: `${fontSize}px`, color });
  return node;
}

export function animateRuneChoice(source, problem, complete = false) {
  if (!source) return;
  const target = problem.querySelector('.ritual-formed-term.is-new');
  if (!target) return;
  const end = target.getBoundingClientRect(), start = source.rect;
  if (!(end.width > 0 && end.height > 0)) return;
  const dx = end.left + end.width / 2 - start.left - start.width / 2;
  const dy = end.top + end.height / 2 - start.top - start.height / 2;
  const scale = Math.max(.35, Math.min(1.5, end.height / start.height));
  const node = floatingFormula(source.html, start, source.fontSize, source.color, 'ritual-flight');
  playEffect(node, [
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx}px,${dy}px) scale(${scale})`, opacity: .15 },
  ], { duration: 230, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });
  if (complete) {
    // Keep the completed expression briefly visible after the ritual HUD closes.
    const answer = problem.querySelector('.bolt-answer math');
    if (!answer) return;
    const rect = answer.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(answer).fontSize) * rect.height / (answer.clientHeight || rect.height);
    const echo = floatingFormula(answer.outerHTML, rect, size, source.color, 'ritual-echo');
    playEffect(echo, [
      { opacity: 0, transform: 'scale(.98)', offset: 0 },
      { opacity: 1, transform: 'scale(1)', offset: .35 },
      { opacity: 1, transform: 'scale(1)', offset: .7 },
      { opacity: 0, transform: 'scale(1.04)', offset: 1 },
    ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
  }
}

export function clearRitualFeedback() {
  for (const effect of [...effects]) { effect.animation.cancel(); effect.remove(); }
}
