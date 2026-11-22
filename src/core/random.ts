/** A source of random numbers in [0, 1). Injected so randomised behaviour is testable. */
export type Random = () => number;

/** A small deterministic generator (mulberry32) for tests and reproducible play. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item uniformly at random. `items` must not be empty. */
export function pickOne<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}
