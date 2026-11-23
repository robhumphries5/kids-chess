import { describe, expect, it } from 'vitest';
import { STICKERS } from '../core/stickers';
import { hasStickerArt, stickerSvg } from './sticker-art';

describe('Sticker art', () => {
  it('every sticker has its own picture', () => {
    for (const s of STICKERS) expect(hasStickerArt(s.id), s.id).toBe(true);
  });

  it('no two stickers look the same', () => {
    const pictures = STICKERS.map((s) => stickerSvg(s.id));
    expect(new Set(pictures).size).toBe(STICKERS.length);
  });
});
