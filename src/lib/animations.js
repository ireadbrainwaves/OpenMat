// ═══════════════════════════════════════════════════════════
// OPEN MAT — ANIMATION HELPERS
// Four functions. Color and stillness do the work.
// ═══════════════════════════════════════════════════════════

/**
 * Flash the entire screen a color briefly.
 * The most common "animation" in the game — a single color pulse.
 */
export function impactFlash(container, color, opacity = 0.10, durationMs = 250) {
  if (!container) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; inset:0; z-index:9999; pointer-events:none;
    background:${color}; opacity:${opacity};
    transition: opacity ${durationMs}ms ease-out;
  `;
  container.appendChild(el);
  el.offsetHeight; // force reflow
  el.style.opacity = '0';
  setTimeout(() => el.remove(), durationMs + 50);
}

/**
 * Hard cut to black for N milliseconds, then callback.
 * Used for the TAP blink.
 */
export function blackout(container, durationMs, callback) {
  if (!container) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; inset:0; z-index:9999; pointer-events:none;
    background:#000000; opacity:1;
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
    if (callback) callback();
  }, durationMs);
}

/**
 * Count up a number with eased animation.
 */
export function countUp(element, target, duration, delay = 0, prefix = '', suffix = '') {
  if (!element) return;
  setTimeout(() => {
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = prefix + Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, delay);
}

/**
 * Screen shake. Apply to the match screen container.
 */
export function screenShake(element, intensity = 'normal') {
  if (!element) return;
  const cls = intensity === 'big' ? 'anim-big-shake' : 'anim-shake';
  element.classList.add(cls);
  const dur = intensity === 'big' ? 500 : 300;
  setTimeout(() => element.classList.remove(cls), dur);
}
