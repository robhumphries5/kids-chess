// Original picture art for avatars and menus: simple flat shapes on a 100 × 100 grid.

const eyes = (y = 48, gap = 14, r = 5) =>
  `<circle cx="${50 - gap}" cy="${y}" r="${r}" fill="#2b2b2b"/><circle cx="${50 + gap}" cy="${y}" r="${r}" fill="#2b2b2b"/>` +
  `<circle cx="${50 - gap + 1.5}" cy="${y - 1.5}" r="${r / 3}" fill="#fff"/><circle cx="${50 + gap + 1.5}" cy="${y - 1.5}" r="${r / 3}" fill="#fff"/>`;
const smile = (y = 66, w = 9) => `<path d="M${50 - w} ${y} Q50 ${y + 8} ${50 + w} ${y}" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>`;
const cheeks = (y = 62) => `<circle cx="27" cy="${y}" r="5" fill="#ff9fb0" opacity="0.7"/><circle cx="73" cy="${y}" r="5" fill="#ff9fb0" opacity="0.7"/>`;
const svg = (body: string) => `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;

export interface Avatar {
  id: string;
  /** Spoken when tapped. */
  name: string;
  svg: string;
}

export const AVATARS: readonly Avatar[] = [
  {
    id: 'fox',
    name: 'Fox',
    svg: svg(
      `<path d="M14 12 L38 34 L20 48 Z" fill="#e8742c"/><path d="M86 12 L62 34 L80 48 Z" fill="#e8742c"/>` +
        `<path d="M10 40 Q50 18 90 40 Q86 78 50 90 Q14 78 10 40 Z" fill="#f08a3c"/>` +
        `<path d="M24 58 Q50 54 76 58 Q70 84 50 90 Q30 84 24 58 Z" fill="#fff6ea"/>` +
        eyes(48) + `<circle cx="50" cy="66" r="5" fill="#2b2b2b"/>` + smile(72, 6),
    ),
  },
  {
    id: 'bear',
    name: 'Bear',
    svg: svg(
      `<circle cx="22" cy="24" r="14" fill="#8a5a3b"/><circle cx="78" cy="24" r="14" fill="#8a5a3b"/>` +
        `<circle cx="22" cy="24" r="7" fill="#d9a77c"/><circle cx="78" cy="24" r="7" fill="#d9a77c"/>` +
        `<circle cx="50" cy="54" r="38" fill="#9b6845"/>` +
        `<ellipse cx="50" cy="68" rx="17" ry="13" fill="#e2b98f"/>` +
        eyes(46) + `<ellipse cx="50" cy="62" rx="6" ry="4.5" fill="#2b2b2b"/>` + smile(70, 6),
    ),
  },
  {
    id: 'frog',
    name: 'Frog',
    svg: svg(
      `<circle cx="30" cy="30" r="15" fill="#5fb34a"/><circle cx="70" cy="30" r="15" fill="#5fb34a"/>` +
        `<ellipse cx="50" cy="60" rx="42" ry="30" fill="#6cc356"/>` +
        `<circle cx="30" cy="30" r="9" fill="#fff"/><circle cx="70" cy="30" r="9" fill="#fff"/>` +
        `<circle cx="31" cy="31" r="5" fill="#2b2b2b"/><circle cx="71" cy="31" r="5" fill="#2b2b2b"/>` +
        cheeks(64) + `<path d="M28 66 Q50 82 72 66" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    svg: svg(
      `<ellipse cx="34" cy="22" rx="9" ry="22" fill="#e9e4f2"/><ellipse cx="66" cy="22" rx="9" ry="22" fill="#e9e4f2"/>` +
        `<ellipse cx="34" cy="24" rx="4.5" ry="15" fill="#f7b8c8"/><ellipse cx="66" cy="24" rx="4.5" ry="15" fill="#f7b8c8"/>` +
        `<circle cx="50" cy="60" r="34" fill="#f3eff9"/>` +
        eyes(54, 13) + cheeks(66) + `<path d="M46 64 L54 64 L50 69 Z" fill="#f08aa4"/>` + smile(73, 6),
    ),
  },
  {
    id: 'penguin',
    name: 'Penguin',
    svg: svg(
      `<ellipse cx="50" cy="54" rx="38" ry="40" fill="#34404f"/>` +
        `<path d="M50 30 Q20 30 22 58 Q26 86 50 88 Q74 86 78 58 Q80 30 50 30 Z" fill="#fff"/>` +
        eyes(50, 12) + cheeks(62) + `<path d="M42 60 L58 60 L50 70 Z" fill="#f5a623"/>`,
    ),
  },
  {
    id: 'lion',
    name: 'Lion',
    svg: svg(
      `<circle cx="50" cy="52" r="44" fill="#c9782b"/>` +
        `<circle cx="50" cy="54" r="31" fill="#f4c25b"/>` +
        `<circle cx="28" cy="30" r="7" fill="#f4c25b"/><circle cx="72" cy="30" r="7" fill="#f4c25b"/>` +
        eyes(48, 12) + `<path d="M44 60 L56 60 L50 66 Z" fill="#7a4a2a"/>` + smile(70, 7),
    ),
  },
];

export function avatarById(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}

/** The choice on the avatar picker that makes a new Profile. */
export const NEW_PROFILE_SVG = svg(
  `<circle cx="50" cy="50" r="40" fill="none" stroke="#5d9948" stroke-width="6" stroke-dasharray="10 8"/>` +
    `<path d="M50 30 V70 M30 50 H70" stroke="#5d9948" stroke-width="9" stroke-linecap="round"/>`,
);

/** Puzzles: a jigsaw piece. */
export const PUZZLES_SVG = svg(
  `<path d="M20 30 H40 Q36 16 50 16 Q64 16 60 30 H80 V50 Q94 46 94 60 Q94 74 80 70 V90 H20 V70 Q34 74 34 60 Q34 46 20 50 Z" fill="#7c6cd8"/>` +
    eyes(60, 12, 4) + smile(72, 6),
);

/** Play: a friendly snail (the first Opponent). */
export const PLAY_SVG = svg(
  `<path d="M8 82 Q8 70 24 70 H76 Q90 70 92 82 Z" fill="#9fd36b"/>` +
    `<circle cx="52" cy="50" r="28" fill="#d98a4a"/>` +
    `<path d="M52 50 m-4 0 a4 4 0 1 1 8 0 a10 10 0 1 1 -18 0 a16 16 0 1 1 30 0 a22 22 0 1 1 -40 2" stroke="#a65e2e" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<path d="M80 72 Q82 52 84 40" stroke="#9fd36b" stroke-width="10" stroke-linecap="round" fill="none"/>` +
    `<path d="M80 42 L74 26 M88 42 L92 26" stroke="#7fb04f" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="74" cy="25" r="4" fill="#2b2b2b"/><circle cx="92" cy="25" r="4" fill="#2b2b2b"/>`,
);

/** An apple: our own art. The shapes only, so the board can draw it on a square too. */
export const APPLE_SHAPES =
  `<path d="M50 30 Q40 6 26 14" stroke="#7a4a2a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
  `<path d="M52 26 Q66 10 80 20 Q66 32 52 26 Z" fill="#5fb34a"/>` +
  `<path d="M50 32 Q30 20 18 36 Q6 56 22 78 Q34 94 50 86 Q66 94 78 78 Q94 56 82 36 Q70 20 50 32 Z" fill="#e3423b"/>` +
  `<ellipse cx="32" cy="48" rx="6" ry="10" fill="#fff" opacity="0.45"/>`;

/** Mini-games: a shiny apple (Hungry Pieces eats apples). */
export const MINI_GAMES_SVG = svg(APPLE_SHAPES);

/** Hungry Pieces on the Mini-games menu: an apple with a bite out of it. */
export const HUNGRY_PIECES_SVG = svg(
  APPLE_SHAPES + `<circle cx="86" cy="60" r="13" style="fill: var(--card, #fff)"/><circle cx="80" cy="74" r="9" style="fill: var(--card, #fff)"/>`,
);

/** Greedy Pig: a round pink pig with a big snout and a happy grin. */
export const PIG_SVG = svg(
  `<path d="M20 30 L24 8 L42 22 Z" fill="#f08aa4"/><path d="M80 30 L76 8 L58 22 Z" fill="#f08aa4"/>` +
    `<circle cx="50" cy="54" r="38" fill="#f7a8bc"/>` +
    eyes(42, 15) +
    `<ellipse cx="50" cy="62" rx="16" ry="11" fill="#f08aa4"/>` +
    `<ellipse cx="44" cy="62" rx="3.5" ry="5" fill="#b8566f"/><ellipse cx="56" cy="62" rx="3.5" ry="5" fill="#b8566f"/>` +
    `<path d="M36 78 Q50 88 64 78" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>`,
);

/** Dragon: a friendly green dragon with little horns, spiky crest and a puff of smoke. */
export const DRAGON_SVG = svg(
  `<path d="M30 22 L22 4 L40 16 Z" fill="#f5c84c"/><path d="M70 22 L78 4 L60 16 Z" fill="#f5c84c"/>` +
    `<path d="M40 12 L46 2 L50 12 L54 2 L60 12 Z" fill="#3f9a5a"/>` +
    `<path d="M14 46 Q14 14 50 14 Q86 14 86 46 Q86 62 76 70 Q72 92 50 92 Q28 92 24 70 Q14 62 14 46 Z" fill="#56b870"/>` +
    `<ellipse cx="50" cy="74" rx="22" ry="15" fill="#a7e0a1"/>` +
    eyes(44, 16, 6) +
    `<circle cx="43" cy="68" r="2.5" fill="#2b2b2b"/><circle cx="57" cy="68" r="2.5" fill="#2b2b2b"/>` +
    `<path d="M40 79 Q50 86 60 79" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="84" cy="22" r="6" fill="#dfe3e8"/><circle cx="92" cy="12" r="4" fill="#dfe3e8"/>`,
);

/** Silly Puppy: a goofy brown puppy with floppy ears, a patch over one eye and its tongue out. */
export const PUPPY_SVG = svg(
  `<ellipse cx="17" cy="44" rx="11" ry="24" fill="#7a4a2a" transform="rotate(18 17 44)"/>` +
    `<ellipse cx="83" cy="44" rx="11" ry="24" fill="#7a4a2a" transform="rotate(-18 83 44)"/>` +
    `<circle cx="50" cy="52" r="34" fill="#d9a066"/>` +
    `<circle cx="64" cy="46" r="11" fill="#a86a3c"/>` +
    eyes(46, 14) +
    `<ellipse cx="50" cy="64" rx="15" ry="11" fill="#f2d2a9"/>` +
    `<ellipse cx="50" cy="59" rx="6" ry="4.5" fill="#2b2b2b"/>` +
    `<path d="M42 68 Q46 72 50 68 Q54 72 58 68" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M50 70 V80 Q50 86 55 86 Q60 86 60 80 V70 Z" fill="#f07a8c"/>`,
);

/** Clever Cat: a grey cat with pointed ears, green eyes and whiskers. */
export const CAT_SVG = svg(
  `<path d="M16 46 L20 8 L44 28 Z" fill="#8c93a3"/><path d="M84 46 L80 8 L56 28 Z" fill="#8c93a3"/>` +
    `<path d="M22 38 L24 18 L36 28 Z" fill="#f7b8c8"/><path d="M78 38 L76 18 L64 28 Z" fill="#f7b8c8"/>` +
    `<ellipse cx="50" cy="56" rx="38" ry="34" fill="#a3aab8"/>` +
    `<ellipse cx="35" cy="50" rx="7" ry="8" fill="#7fc65a"/><ellipse cx="65" cy="50" rx="7" ry="8" fill="#7fc65a"/>` +
    `<ellipse cx="35" cy="50" rx="2.5" ry="6" fill="#2b2b2b"/><ellipse cx="65" cy="50" rx="2.5" ry="6" fill="#2b2b2b"/>` +
    `<path d="M45 62 L55 62 L50 67 Z" fill="#f08aa4"/>` +
    `<path d="M42 72 Q46 76 50 70 Q54 76 58 72" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M8 60 L30 64 M8 70 L30 68 M92 60 L70 64 M92 70 L70 68" stroke="#4a4f5a" stroke-width="2" stroke-linecap="round"/>`,
);

/** Wise Owl: a round brown owl with big eyes, ear tufts and a little pair of glasses. */
export const OWL_SVG = svg(
  `<path d="M18 30 L22 8 L38 22 Z" fill="#6e5236"/><path d="M82 30 L78 8 L62 22 Z" fill="#6e5236"/>` +
    `<ellipse cx="50" cy="56" rx="38" ry="38" fill="#8f6a45"/>` +
    `<ellipse cx="50" cy="70" rx="22" ry="20" fill="#e8d3b0"/>` +
    `<circle cx="34" cy="44" r="14" fill="#fff6ea"/><circle cx="66" cy="44" r="14" fill="#fff6ea"/>` +
    `<circle cx="34" cy="44" r="7" fill="#2b2b2b"/><circle cx="66" cy="44" r="7" fill="#2b2b2b"/>` +
    `<circle cx="36" cy="42" r="2.5" fill="#fff"/><circle cx="68" cy="42" r="2.5" fill="#fff"/>` +
    `<circle cx="34" cy="44" r="15" fill="none" stroke="#3a3a3a" stroke-width="3"/><circle cx="66" cy="44" r="15" fill="none" stroke="#3a3a3a" stroke-width="3"/>` +
    `<path d="M49 44 H51" stroke="#3a3a3a" stroke-width="3"/>` +
    `<path d="M44 58 L56 58 L50 68 Z" fill="#f5a623"/>` +
    `<path d="M38 76 Q42 80 46 76 M54 76 Q58 80 62 76 M46 84 Q50 88 54 84" stroke="#b89a70" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
);

/** Each Opponent's picture on the Opponent picker, by Opponent id. */
export const OPPONENT_PICTURES: Readonly<Record<string, string>> = {
  snail: PLAY_SVG,
  pig: PIG_SVG,
  puppy: PUPPY_SVG,
  cat: CAT_SVG,
  owl: OWL_SVG,
  dragon: DRAGON_SVG,
};

const pawn = (fill: string, stroke: string) =>
  svg(
    `<circle cx="50" cy="28" r="13" fill="${fill}" stroke="${stroke}" stroke-width="4"/>` +
      `<path d="M38 44 H62 L58 50 Q60 66 68 76 H32 Q40 66 42 50 Z" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect x="24" y="76" width="52" height="12" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`,
  );

/** Play as white: a white pawn. */
export const WHITE_PAWN_SVG = pawn('#ffffff', '#2b2b2b');

/** Play as black: a black pawn. */
export const BLACK_PAWN_SVG = pawn('#2b2b2b', '#2b2b2b');

/** 🎲: let the app pick the colour. */
export const DICE_SVG = svg(
  `<rect x="16" y="16" width="68" height="68" rx="14" fill="#fff" stroke="#e3423b" stroke-width="6"/>` +
    `<circle cx="34" cy="34" r="6" fill="#e3423b"/><circle cx="50" cy="50" r="6" fill="#e3423b"/><circle cx="66" cy="66" r="6" fill="#e3423b"/>` +
    `<circle cx="66" cy="34" r="6" fill="#e3423b"/><circle cx="34" cy="66" r="6" fill="#e3423b"/>`,
);

/** Start a new game instead of carrying on: a fresh little board with a sparkle. */
export const NEW_GAME_SVG = svg(
  `<rect x="14" y="22" width="64" height="64" rx="6" fill="#f0d9b5" stroke="#8a5a32" stroke-width="5"/>` +
    [0, 1, 2, 3]
      .flatMap((row) => [0, 1, 2, 3].filter((col) => (row + col) % 2 === 1).map((col) => [row, col]))
      .map(([row, col]) => `<rect x="${16 + col * 15}" y="${24 + row * 15}" width="15" height="15" fill="#b58863"/>`)
      .join('') +
    `<path d="M80 8 L84 18 L94 22 L84 26 L80 36 L76 26 L66 22 L76 18 Z" fill="#ffc83d" stroke="#e0a000" stroke-width="2" stroke-linejoin="round"/>`,
);

/** Pick someone else: two little faces with a swap arrow between them. */
export const PICK_SOMEONE_ELSE_SVG = svg(
  `<circle cx="26" cy="60" r="18" fill="#f7a8bc"/><circle cx="74" cy="60" r="18" fill="#56b870"/>` +
    `<circle cx="20" cy="56" r="3" fill="#2b2b2b"/><circle cx="32" cy="56" r="3" fill="#2b2b2b"/>` +
    `<circle cx="68" cy="56" r="3" fill="#2b2b2b"/><circle cx="80" cy="56" r="3" fill="#2b2b2b"/>` +
    `<path d="M20 67 Q26 72 32 67 M68 67 Q74 72 80 67" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M30 30 Q50 12 70 30" stroke="#f5a623" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<path d="M62 22 L72 32 L58 34" stroke="#f5a623" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
);

/** A draw: two hands meeting in a friendly high five. */
export const DRAW_SVG = svg(
  `<circle cx="50" cy="50" r="40" fill="#fff4c2"/>` +
    `<path d="M22 70 L40 40 Q44 34 50 40 L50 40 Q56 34 60 40 L78 70" stroke="#d98a4a" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M50 18 V28 M36 22 L40 30 M64 22 L60 30" stroke="#f5a623" stroke-width="4" stroke-linecap="round"/>`,
);
