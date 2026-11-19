// Probes for D1/D2 edits 3 and 4 (headless/prototype/probe-edits.mjs). Both edits replace a whole function header,
// Code uses 26734764 names (session host Ogr.sim); names and offsets inside comments are those of 26519199.
// so the edit counter has no point inside them ('none'); the probes check the effect on a real country instead.
// my (26519199 @11925920): the default test; the patch drops "debt over 170% and rated 16 or worse".
// Y8a: the cross-country rating score; the patch adds the within-country adjustment c.__geobalAdj before the clamp.
export const probes = [
  {
    id: 'd1-d2-default-test-and-score',
    edits: ['d1-d2-rating-within-country#3', 'd1-d2-rating-within-country#4'],
    code: String.raw`
const S = Ogr.sim;
// A real country with debt between 170% and 400% (by the game's own measure _K).
const c = [...S.countries.values()].find(x => { const t = Zx(x); return t > 170 && t <= 400; });
if (!check(!!c, 'a real country with debt between 170% and 400% of GDP', c && { key: c.key, debt: Zx(c) })) return null;
const r0 = c.rating;
c.rating = 16;
const patched = K5(c), original = c.rating >= 18 || Zx(c) > 170 && c.rating >= 16 || Zx(c) > 400;
c.rating = r0;
check(patched === false && original === true, 'D1/D2 edit 3: rated 16 with debt between 170% and 400% is no longer an automatic default', { key: c.key, debt: Zx(c), patched, original });
c.rating = 18; const at18 = K5(c); c.rating = r0;
check(at18 === true, 'D1/D2 edit 3: rated 18 is still a default (unchanged)');
// Y8a with and without the adjustment, restored afterwards.
const a0 = c.__geobalAdj;
c.__geobalAdj = 0; const s0 = mEa(c);
c.__geobalAdj = 1; const s1 = mEa(c);
c.__geobalAdj = a0;
check(s0 < 18 && Math.abs(s1 - s0 - 1) < 1e-9, 'D1/D2 edit 4: the score (below its clamp) moves by the within-country adjustment', { s0, s1 });
return { key: c.key, debt: Zx(c), rating: r0, score0: s0, score1: s1 };
`,
  },
];
