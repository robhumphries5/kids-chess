import { starJar } from '../core/points';

const STAR = 'M0 -10 L2.9 -3.1 L9.5 -3.1 L4.2 1.2 L6.2 8.1 L0 4 L-6.2 8.1 L-4.2 1.2 L-9.5 -3.1 L-2.9 -3.1 Z';

/** Where each star sits in the jar, filling from the bottom. */
const SLOTS: readonly [number, number][] = [
  [32, 102], [68, 102], [50, 92],
  [30, 80], [70, 80], [50, 68],
  [30, 56], [70, 56], [50, 44], [50, 30],
];

/** Show a Profile's Points as a jar of stars, with the total for grown-ups. Our own art. */
export function showStarJar(el: HTMLElement, total: number): void {
  const jar = starJar(total);
  const stars = SLOTS.slice(0, jar.stars)
    .map(([x, y]) => `<path d="${STAR}" transform="translate(${x} ${y})" fill="#f7c948" stroke="#c99a12" stroke-width="1.2"/>`)
    .join('');
  // Our own constant art and a number, never user text.
  el.innerHTML =
    '<svg viewBox="0 0 100 120" aria-hidden="true">' +
    '<rect x="28" y="4" width="44" height="12" rx="4" fill="#b07a4a"/>' +
    '<path d="M24 18 H76 Q90 26 90 44 V104 Q90 116 78 116 H22 Q10 116 10 104 V44 Q10 26 24 18 Z" fill="#dff1fb" stroke="#7fb3d1" stroke-width="3"/>' +
    stars +
    `</svg><span class="star-jar-total">${jar.total}</span>`;
  el.setAttribute('aria-label', `${jar.total} Points`);
}
