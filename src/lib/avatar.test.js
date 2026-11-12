import { describe, expect, it } from 'vitest';
import { AVATAR_TONES, checkPhotoFile, clampCrop, cropRect, initialOf, PHOTO_TOO_BIG, PHOTO_WRONG_TYPE, toneIndex, zoomAt } from './avatar.js';

describe('letter avatars', () => {
  it('uses the first letter of the display name, uppercase', () => {
    expect(initialOf('dika')).toBe('D');
    expect(initialOf('  Admin Beyondcy')).toBe('A');
    expect(initialOf('élise')).toBe('É');
    expect(initialOf('')).toBe('?');
    expect(initialOf(null)).toBe('?');
  });

  it('gives the same person the same tone every time, inside the palette', () => {
    const id = '7c1c5c0e-2d38-4b6e-9f0a-0f6c8d0f1a2b';
    expect(toneIndex(id)).toBe(toneIndex(id));
    for (const x of ['u-admin', 'u-dika', 'u-arum', id, '', null]) {
      expect(toneIndex(x)).toBeGreaterThanOrEqual(0);
      expect(toneIndex(x)).toBeLessThan(AVATAR_TONES);
    }
  });

  it('spreads people over several tones', () => {
    const tones = new Set(['u-admin', 'u-excel', 'u-dika', 'u-zaki', 'u-arum', 'u-ilyas', 'u-anne', 'u-rina', 'u-bagas'].map((id) => toneIndex(id)));
    expect(tones.size).toBeGreaterThanOrEqual(3);
  });
});

describe('checkPhotoFile', () => {
  it('accepts JPG, PNG and WebP up to 10 MB', () => {
    expect(checkPhotoFile({ type: 'image/jpeg', size: 10 * 1024 * 1024 })).toBe(null);
    expect(checkPhotoFile({ type: 'image/png', size: 1 })).toBe(null);
    expect(checkPhotoFile({ type: 'image/webp', size: 500 })).toBe(null);
  });

  it('refuses other types and bigger files', () => {
    expect(checkPhotoFile({ type: 'image/gif', size: 10 })).toBe(PHOTO_WRONG_TYPE);
    expect(checkPhotoFile({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 })).toBe(PHOTO_TOO_BIG);
  });
});

describe('crop maths', () => {
  const landscape = { imgW: 2000, imgH: 1000, view: 280 };
  const near = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, expect.closeTo(v, 6)]));

  it('at zoom 1 the short side fills the square; the centre square is taken', () => {
    expect(cropRect({ ...landscape, zoom: 1, x: 0, y: 0 })).toEqual(near({ sx: 500, sy: 0, size: 1000 }));
  });

  it('cannot drag the image off the square', () => {
    // 2000×1000 at zoom 1 shows 560×280: 140px of travel left and right, none up or down
    expect(clampCrop({ ...landscape, zoom: 1, x: 999, y: 50 })).toEqual(near({ zoom: 1, x: 140, y: 0 }));
    expect(clampCrop({ ...landscape, zoom: 1, x: -999, y: -50 })).toEqual(near({ zoom: 1, x: -140, y: 0 }));
    // dragged fully right = the image's left edge is at the square's left edge
    expect(cropRect({ ...landscape, zoom: 1, x: 140, y: 0 }).sx).toBeCloseTo(0);
    expect(cropRect({ ...landscape, zoom: 1, x: -140, y: 0 }).sx).toBeCloseTo(1000);
  });

  it('keeps zoom between 1 and 4', () => {
    expect(clampCrop({ ...landscape, zoom: 0.2, x: 0, y: 0 }).zoom).toBe(1);
    expect(clampCrop({ ...landscape, zoom: 9, x: 0, y: 0 }).zoom).toBe(4);
  });

  it('zoom 2 takes half the size from the centre', () => {
    expect(cropRect({ ...landscape, zoom: 2, x: 0, y: 0 })).toEqual(near({ sx: 750, sy: 250, size: 500 }));
  });

  it('zooming at a point keeps that point of the image under the cursor', () => {
    const before = { ...landscape, zoom: 1, x: 0, y: 0 };
    const px = 210; // right of centre
    const py = 70;
    const scale1 = 280 / 1000;
    const imgX = 1000 + (px - 140 - before.x) / scale1;
    const after = zoomAt(before, 2, px, py);
    const scale2 = (280 / 1000) * 2;
    const imgXAfter = 1000 + (px - 140 - after.x) / scale2;
    expect(imgXAfter).toBeCloseTo(imgX);
  });

  it('a square source at zoom 1 is taken whole', () => {
    expect(cropRect({ imgW: 512, imgH: 512, view: 280, zoom: 1, x: 0, y: 0 })).toEqual(near({ sx: 0, sy: 0, size: 512 }));
  });
});
