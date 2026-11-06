// Apply display mode before the stylesheet loads, including in desktop-site browser mode.
(() => {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('debug') === '1';
  const modes = new Set(['auto', 'mobile', 'pc']);
  let mode = debug && modes.has(params.get('ui')) ? params.get('ui') : 'auto';
  const root = document.documentElement;
  const matches = query => window.matchMedia(query).matches;

  function detectedMobile() {
    const ua = navigator.userAgent || '';
    const touch = navigator.maxTouchPoints > 0 || matches('(any-pointer: coarse)');
    const phone = navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile/i.test(ua);
    const smallTouch = touch && (
      Math.min(screen.width || Infinity, screen.height || Infinity) <= 600 ||
      matches('(max-width: 1000px)')
    );
    return phone || smallTouch;
  }

  function isPortrait() {
    const orientation = screen.orientation?.type;
    return orientation ? orientation.startsWith('portrait') : matches('(orientation: portrait)');
  }

  function applyMode() {
    const mobile = mode === 'mobile' || (mode === 'auto' && detectedMobile());
    root.classList.toggle('mobile-layout', mobile);
    root.classList.toggle('mobile-portrait', mobile && isPortrait());
    document.querySelectorAll('[data-debug-ui]').forEach(button => {
      const selected = button.dataset.debugUi === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    return mobile;
  }

  function setMode(value) {
    if (!debug || !modes.has(value)) return;
    mode = value;
    const url = new URL(window.location.href);
    if (mode === 'auto') url.searchParams.delete('ui');
    else url.searchParams.set('ui', mode);
    window.history.replaceState(null, '', url);
    applyMode();
  }

  window.mathMageDisplay = { applyMode, setMode, getMode: () => mode };
  applyMode();
  window.addEventListener('resize', applyMode);
  screen.orientation?.addEventListener?.('change', applyMode);
  document.addEventListener('DOMContentLoaded', applyMode);
})();
