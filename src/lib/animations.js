// ═══════════════════════════════════════════════════════════
// OPEN MAT — ANIMATION HELPERS
// Pure DOM manipulation for reveal sequences, count-ups,
// particle bursts, and screen shakes.
// No external libraries — CSS @keyframes + rAF only.
// ═══════════════════════════════════════════════════════════

/**
 * Reveal text character-by-character with blur-to-sharp deblur.
 * @param {HTMLElement} element — container to fill with spans
 * @param {string} text — text to reveal
 * @param {string} color — CSS color for the text
 * @param {number} staggerMs — delay between characters (default 40)
 * @param {number} startDelayMs — delay before first character (default 0)
 */
export function revealText(element, text, color, staggerMs = 40, startDelayMs = 0) {
  if (!element) return;
  element.innerHTML = '';
  text.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.style.transform = 'translateY(30px) scaleY(1.2)';
    span.style.filter = 'blur(4px)';
    span.style.color = color;
    span.style.animation = `charPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`;
    span.style.animationDelay = `${startDelayMs + i * staggerMs}ms`;
    element.appendChild(span);
  });
}

/**
 * Count up a number with eased animation.
 * @param {HTMLElement} element — element whose textContent to update
 * @param {number} target — final number
 * @param {number} duration — animation duration in ms
 * @param {number} startDelay — delay before starting in ms
 * @param {string} prefix — text before number (default '')
 * @param {string} suffix — text after number (default '')
 */
export function countUp(element, target, duration, startDelay = 0, prefix = '', suffix = '') {
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
  }, startDelay);
}

/**
 * Burst particles outward from a point.
 * @param {HTMLElement} container — absolutely-positioned container
 * @param {number} cx — center x (px from container left)
 * @param {number} cy — center y (px from container top)
 * @param {string} color — CSS color
 * @param {number} count — number of particles (max 25 for performance)
 */
export function burstParticles(container, cx, cy, color, count = 10) {
  if (!container) return;
  const safeCount = Math.min(count, 25);
  for (let i = 0; i < safeCount; i++) {
    const p = document.createElement('div');
    const angle = (Math.PI * 2 * i) / safeCount + (Math.random() - 0.5) * 0.5;
    const dist = 25 + Math.random() * 75;
    const size = 2 + Math.random() * 3;
    p.style.cssText = `
      position:absolute; border-radius:50%; pointer-events:none;
      left:${cx}px; top:${cy}px;
      width:${size}px; height:${size}px;
      background:${color}; opacity:0.5;
      transition: all ${0.3 + Math.random() * 0.4}s cubic-bezier(0.16,1,0.3,1);
    `;
    container.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 900);
  }
}

/**
 * Trigger a screen shake on an element.
 * @param {HTMLElement} element — element to shake
 * @param {boolean} big — use bigShake (for TAP finish) or normal shake
 */
export function screenShake(element, big = false) {
  if (!element) return;
  const cls = big ? 'anim-big-shake' : 'anim-shake';
  element.classList.add(cls);
  const dur = big ? 500 : 350;
  setTimeout(() => element.classList.remove(cls), dur);
}

/**
 * Create confetti burst (victory celebrations).
 * @param {HTMLElement} container — absolutely-positioned container
 * @param {number} count — number of confetti pieces (default 35)
 */
export function confettiBurst(container, count = 35) {
  if (!container) return;
  const colors = ['#C23028', '#2563EB', '#0F7B5F', '#B8860B', '#7C3AED', '#111827'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 3 + Math.random() * 5;
    const isCircle = Math.random() > 0.5;
    const x = Math.random() * 100;
    const fallDuration = 2 + Math.random() * 2;
    const rotation = Math.random() * 720;
    const delay = Math.random() * 0.5;
    p.style.cssText = `
      position:absolute; pointer-events:none;
      left:${x}%; top:-10px;
      width:${size}px; height:${size}px;
      background:${color};
      border-radius:${isCircle ? '50%' : '1px'};
      opacity:0.9;
      animation: confettiFall ${fallDuration}s ${delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      --rotation: ${rotation}deg;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), (fallDuration + delay) * 1000 + 200);
  }
}
