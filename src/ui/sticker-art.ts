// Sticker art: our own simple shapes, drawn here. Each sticker sits on a round white backing.

type Draw = (main: string, accent: string) => string;

const STAR_PATH = 'M50 16 L59 39 L84 39 L64 54 L71 79 L50 64 L29 79 L36 54 L16 39 L41 39 Z';

const SHAPES: Readonly<Record<string, Draw>> = {
  star: (main, accent) =>
    `<path d="${STAR_PATH}" fill="${main}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="43" cy="50" r="3" fill="#333"/><circle cx="57" cy="50" r="3" fill="#333"/>` +
    `<path d="M44 58 Q50 63 56 58" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  heart: (main, accent) =>
    `<path d="M50 82 C20 62 14 44 22 32 C30 20 46 22 50 36 C54 22 70 20 78 32 C86 44 80 62 50 82 Z" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
    `<ellipse cx="34" cy="38" rx="5" ry="3" fill="#fff" opacity="0.6" transform="rotate(-30 34 38)"/>`,
  sun: (main, accent) => {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const at = (r: number, trig: (a: number) => number) => (50 + r * trig(a)).toFixed(1);
      return `<line x1="${at(26, Math.cos)}" y1="${at(26, Math.sin)}" x2="${at(36, Math.cos)}" y2="${at(36, Math.sin)}" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`;
    }).join('');
    return (
      rays +
      `<circle cx="50" cy="50" r="20" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
      `<circle cx="43" cy="46" r="2.5" fill="#333"/><circle cx="57" cy="46" r="2.5" fill="#333"/>` +
      `<path d="M42 55 Q50 62 58 55" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    );
  },
  rocket: (main, accent) =>
    `<path d="M38 66 L28 78 L40 74 Z M62 66 L72 78 L60 74 Z" fill="${accent}"/>` +
    `<path d="M50 14 C64 26 64 52 60 72 H40 C36 52 36 26 50 14 Z" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
    `<circle cx="50" cy="40" r="7" fill="#bfe6ff" stroke="${accent}" stroke-width="3"/>` +
    `<path d="M43 74 Q50 90 57 74 Z" fill="#f7a23b"/>`,
  flower: (main, accent) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      return `<circle cx="${(50 + 17 * Math.cos(a)).toFixed(1)}" cy="${(46 + 17 * Math.sin(a)).toFixed(1)}" r="12" fill="${main}" stroke="${accent}" stroke-width="2"/>`;
    }).join('') +
    `<path d="M50 60 Q48 74 50 86" stroke="#4f9a3a" stroke-width="4" fill="none"/>` +
    `<circle cx="50" cy="46" r="9" fill="#f7c948" stroke="#c99a12" stroke-width="2"/>`,
  fish: (main, accent) =>
    `<path d="M70 50 L86 36 L86 64 Z" fill="${accent}"/>` +
    `<ellipse cx="46" cy="50" rx="28" ry="18" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
    `<path d="M44 38 Q50 50 44 62" stroke="${accent}" stroke-width="2.5" fill="none"/>` +
    `<circle cx="30" cy="46" r="3.5" fill="#333"/>`,
  crown: (main, accent) =>
    `<path d="M22 70 L18 32 L36 50 L50 26 L64 50 L82 32 L78 70 Z" fill="${main}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>` +
    `<rect x="22" y="66" width="56" height="10" rx="3" fill="${accent}"/>` +
    `<circle cx="36" cy="60" r="4" fill="#e2483d"/><circle cx="50" cy="58" r="4" fill="#3d8be2"/><circle cx="64" cy="60" r="4" fill="#4caf50"/>`,
  rainbow: (main, accent) => {
    const colours = main.split(',');
    const arcs = colours
      .map((c, i) => {
        const r = 34 - i * 6;
        return `<path d="M${50 - r} 66 A${r} ${r} 0 0 1 ${50 + r} 66" stroke="${c}" stroke-width="6" fill="none"/>`;
      })
      .join('');
    const cloud = (x: number) =>
      `<g fill="${accent}"><circle cx="${x - 7}" cy="68" r="7"/><circle cx="${x + 2}" cy="64" r="9"/><circle cx="${x + 10}" cy="69" r="6"/></g>`;
    return arcs + cloud(18) + cloud(76);
  },
  balloon: (main, accent) =>
    `<path d="M50 70 Q44 80 52 88" stroke="#777" stroke-width="2" fill="none"/>` +
    `<ellipse cx="50" cy="42" rx="20" ry="25" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
    `<path d="M46 70 L54 70 L50 64 Z" fill="${accent}"/>` +
    `<ellipse cx="42" cy="34" rx="4" ry="7" fill="#fff" opacity="0.55" transform="rotate(20 42 34)"/>`,
  moon: (main, accent) =>
    `<path d="M60 18 A32 32 0 1 0 82 66 A26 26 0 1 1 60 18 Z" fill="${main}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="40" cy="48" r="2.5" fill="#333"/>` +
    `<path d="M36 58 Q42 62 48 58" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M74 26 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 Z" fill="#f7c948"/>`,
  tree: (main, accent) =>
    `<rect x="44" y="58" width="12" height="26" rx="3" fill="#8a5a33"/>` +
    `<circle cx="50" cy="34" r="18" fill="${main}" stroke="${accent}" stroke-width="2.5"/>` +
    `<circle cx="34" cy="50" r="15" fill="${main}" stroke="${accent}" stroke-width="2.5"/>` +
    `<circle cx="66" cy="50" r="15" fill="${main}" stroke="${accent}" stroke-width="2.5"/>` +
    `<circle cx="42" cy="36" r="3" fill="#e2483d"/><circle cx="62" cy="46" r="3" fill="#e2483d"/><circle cx="36" cy="54" r="3" fill="#e2483d"/>`,
  ladybird: (main, accent) =>
    `<circle cx="50" cy="28" r="11" fill="#333"/>` +
    `<circle cx="46" cy="25" r="2.5" fill="#fff"/><circle cx="54" cy="25" r="2.5" fill="#fff"/>` +
    `<ellipse cx="50" cy="56" rx="26" ry="26" fill="${main}" stroke="${accent}" stroke-width="3"/>` +
    `<line x1="50" y1="31" x2="50" y2="82" stroke="#333" stroke-width="3"/>` +
    `<g fill="#333"><circle cx="38" cy="48" r="5"/><circle cx="62" cy="48" r="5"/><circle cx="36" cy="66" r="4"/><circle cx="64" cy="66" r="4"/></g>`,
};

/** Shape and colours for each sticker id in `STICKERS`. */
const LOOKS: Readonly<Record<string, [shape: string, main: string, accent: string]>> = {
  'star-gold': ['star', '#f7c948', '#c99a12'],
  'heart-red': ['heart', '#e2483d', '#a8261d'],
  'sun-yellow': ['sun', '#ffd84d', '#f0a020'],
  'rocket-red': ['rocket', '#f25c54', '#9c2b25'],
  'flower-pink': ['flower', '#f59ac4', '#c9558b'],
  'fish-orange': ['fish', '#f7a23b', '#b8661a'],
  'crown-gold': ['crown', '#f7c948', '#b8860b'],
  'rainbow-bright': ['rainbow', '#e2483d,#f7a23b,#f7c948,#4caf50,#3d8be2', '#dfe9f2'],
  'balloon-blue': ['balloon', '#4d9de0', '#2a6aa3'],
  'moon-silver': ['moon', '#d9dee5', '#8f99a6'],
  'tree-green': ['tree', '#6cc04a', '#3f8a2a'],
  'ladybird-red': ['ladybird', '#e2483d', '#8f1f18'],
  'star-blue': ['star', '#7cc4f5', '#2f7fbf'],
  'heart-purple': ['heart', '#a978e0', '#6a3fa3'],
  'sun-orange': ['sun', '#ffb347', '#e07020'],
  'rocket-blue': ['rocket', '#5aa9e6', '#245d8f'],
  'flower-yellow': ['flower', '#ffe066', '#d1a21c'],
  'fish-blue': ['fish', '#5ec4e0', '#2a7f99'],
  'crown-silver': ['crown', '#d9dee5', '#7d8794'],
  'rainbow-soft': ['rainbow', '#f7b2bd,#fcd5a5,#fff2a8,#bfe8b9,#b3d4f5', '#dfe9f2'],
  'balloon-green': ['balloon', '#6cc04a', '#3f8a2a'],
  'moon-gold': ['moon', '#f7d774', '#c99a12'],
  'tree-autumn': ['tree', '#f39c3d', '#b8661a'],
  'ladybird-yellow': ['ladybird', '#ffd84d', '#c99a12'],
};

const BACKING = '<circle cx="50" cy="50" r="46" fill="#fff" stroke="#e7d9b8" stroke-width="4"/>';
const PLACEHOLDER =
  '<circle cx="50" cy="50" r="44" fill="#f2efe8" stroke="#cfc6b3" stroke-width="3" stroke-dasharray="7 6"/>' +
  `<path d="${STAR_PATH}" fill="none" stroke="#d8d0bf" stroke-width="4" stroke-linejoin="round" transform="translate(15 15) scale(0.7)"/>`;

/** Whether `id` has art of its own. */
export function hasStickerArt(id: string): boolean {
  const look = LOOKS[id];
  return look !== undefined && SHAPES[look[0]] !== undefined;
}

/** The sticker as an SVG string (constant art, never user text). Unknown ids get a plain gold star. */
export function stickerSvg(id: string): string {
  const [shape, main, accent] = LOOKS[id] ?? ['star', '#f7c948', '#c99a12'];
  const draw = SHAPES[shape] ?? SHAPES.star!;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${BACKING}${draw(main, accent)}</svg>`;
}

/** A gentle "still to come" spot for a sticker not unlocked yet. */
export const LOCKED_STICKER_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">${PLACEHOLDER}</svg>`;
