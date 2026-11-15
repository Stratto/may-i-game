const test = require("node:test");
const assert = require("node:assert");
const M = require("./harness.js");

// ── Live sync: two phones scoring the same game ──────────────────
const base = { id: "g", groupId: "t", players: ["a", "b"], round: 1, status: "live", updatedAt: 100,
  scores: { 0: { a: 0, b: 20 } }, buys: { 0: { a: 1 } }, hands: {} };

test("sync merge: a round only one phone has is kept", () => {
  const phone1 = { ...base, updatedAt: 200, scores: { ...base.scores, 1: { a: 15 } } };
  const phone2 = { ...base, updatedAt: 150, scores: { ...base.scores, 1: { b: 0 } } };
  assert.deepStrictEqual(M.mergeGame(phone1, phone2).scores, { 0: { a: 0, b: 20 }, 1: { a: 15, b: 0 } });
  assert.deepStrictEqual(M.mergeGame(phone2, phone1).scores, { 0: { a: 0, b: 20 }, 1: { a: 15, b: 0 } });   // order doesn't matter
});

test("sync merge: on a clash the newer edit wins", () => {
  const fixed = { ...base, updatedAt: 300, scores: { 0: { a: 0, b: 25 } } };
  assert.strictEqual(M.mergeGame(base, fixed).scores[0].b, 25);
  assert.strictEqual(M.mergeGame(fixed, base).scores[0].b, 25);
});

test("sync merge: buys and counted hands are kept, the furthest round and a finish win", () => {
  const other = { ...base, updatedAt: 90, round: 3, buys: { 0: { b: 2 } }, hands: { 0: { b: ["KH", "7S"] } }, status: "done", endedAt: 95 };
  const g = M.mergeGame(base, other);
  assert.deepStrictEqual(g.buys, { 0: { a: 1, b: 2 } });
  assert.deepStrictEqual(g.hands, { 0: { b: ["KH", "7S"] } });
  assert.strictEqual(g.round, 3);
  assert.strictEqual(g.status, "done");
  assert.strictEqual(M.mergeGame(undefined, base).id, "g");
});

test("sync: an older table document still brings its new rounds in", () => {
  const group = { id: "t", name: "Family", players: [], updatedAt: 500 };
  const state = { groups: { t: group }, games: { g: base }, groupOrder: ["t"] };
  const doc = { group: { ...group, name: "Old name", updatedAt: 400 }, games: [{ ...base, updatedAt: 50, scores: { 1: { a: 5, b: 10 } } }], updatedAt: 400 };
  const out = M.applyDoc(state, doc);
  assert.strictEqual(out.groups.t.name, "Family");   // newer table details stay
  assert.deepStrictEqual(out.games.g.scores, { 0: { a: 0, b: 20 }, 1: { a: 5, b: 10 } });
});

// ── Avatars ───────────────────────────────────────────────────────
test("avatars: a starting character is chosen from the name, the same every time", () => {
  const a = M.avSeed("Ana"), b = M.avSeed("Ana");
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.type, "face");
  for (const [k, list] of [["top", "hair"], ["hairColor"], ["skin"], ["eyes"], ["eyebrows"], ["mouth"], ["beard"], ["acc"], ["clothes"], ["clothesColor"]]) assert.ok(M.AV[list || k].includes(a[k]), k);
  assert.notDeepStrictEqual(M.avSeed("Ana"), M.avSeed("Benjamin"));
});

test("avatars: every part draws a complete SVG with its own ids", () => {
  const base = M.avSeed("Ana");
  for (const [k, list] of [["top", "hair"], ["top", "hats"], ["hairColor"], ["skin"], ["eyes"], ["eyebrows"], ["mouth"], ["beard"], ["acc"], ["clothes"], ["clothesColor"]]) for (const v of M.AV[list || k]) {
    const svg = M.faceSVG({ ...base, [k]: v });
    assert.match(svg, /^<svg [^>]*viewBox="[\d ]+"[\s\S]*<\/svg>$/);
    assert.ok(!/undefined|NaN|\[object/.test(svg), k + "/" + v);
  }
  const a = M.faceSVG({ ...base, acc: "sunglasses" }), b = M.faceSVG({ ...base, acc: "sunglasses" });
  const ids = s => [...s.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids(a).length && !ids(a).some(id => ids(b).includes(id)), "two avatars on one page must not share ids");
  assert.ok(M.faceSVG({ ...base, skin: "#614335" }).includes("#614335"));
});

test("avatars: characters made with the first drawn faces move to the new parts", () => {
  const old = { type: "face", skin: "#F7D7BA", hair: "curly", hairColor: "#DDB052", face: "cool", extra: "none", top: "#FFFFFF" };
  const t = M.toAva(old);
  assert.deepStrictEqual([t.top, t.hairColor, t.skin, t.acc, t.v], ["curly", "#D6B370", "#FFDBB4", "sunglasses", 3]);
  assert.ok(!/undefined|NaN/.test(M.faceSVG(old)));
});

test("avatars: share image sources for photos, characters and initials", () => {
  assert.strictEqual(M.avatarSrc({ type: "photo", src: "data:image/jpeg;base64,xx" }), "data:image/jpeg;base64,xx");
  assert.match(M.avatarSrc(M.avSeed("Cy")), /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.strictEqual(M.avatarSrc(null), null);
});

test("avatars: old games remember drawn characters but not photos", () => {
  const group = { players: [{ id: "a", name: "Ana", color: "red", avatar: { type: "photo", src: "data:x" } }, { id: "b", name: "Ben", color: "blue", avatar: M.avSeed("Ben") }] };
  const names = M.namesOf(group, ["a", "b"]);
  assert.strictEqual(names.a.avatar, undefined);
  assert.strictEqual(names.b.avatar.type, "face");
});

// ── Joining and leaving mid-game ──────────────────────────────────
const mid = { id: "m", players: ["a", "b", "c"], dealer: 0, round: 2, rules: M.DEFAULT_RULES,
  scores: { 0: { a: 0, b: 30, c: 12 }, 1: { a: 25, b: 0, c: 40 }, 2: { a: 10 } }, names: {} };

test("a late player takes each finished round's highest score and nobody loses the deal", () => {
  const dealing = mid.players[M.dealerIdx(mid, mid.round)];
  const g = M.addToGame(mid, "d", { name: "Dee", color: "teal" }, "worst");
  assert.deepStrictEqual(g.players, ["a", "b", "c", "d"]);
  assert.strictEqual(g.scores[0].d, 30);
  assert.strictEqual(g.scores[1].d, 40);
  assert.strictEqual(g.scores[2].d, undefined);          // the round in play still needs their score
  assert.ok(M.roundDone(g, 0) && M.roundDone(g, 1) && !M.roundDone(g, 2));
  assert.strictEqual(g.players[M.dealerIdx(g, g.round)], dealing);
  assert.deepStrictEqual(g.names.d, { name: "Dee", color: "teal" });
  assert.strictEqual(g.joined.d, 2);
});

test("a late player can start from zero instead", () => {
  const g = M.addToGame(mid, "d", { name: "Dee", color: "teal" }, "zero");
  assert.strictEqual(g.scores[0].d + g.scores[1].d, 0);
});

test("a player can leave; the deal stays put, or passes on if they were dealing", () => {
  const dealing = mid.players[M.dealerIdx(mid, mid.round)];        // c deals round 3
  const other = mid.players.find(id => id !== dealing);
  const g = M.dropFromGame(mid, other);
  assert.ok(!g.players.includes(other));
  assert.strictEqual(g.players[M.dealerIdx(g, g.round)], dealing);
  const h = M.dropFromGame(mid, dealing);
  const next = mid.players[(mid.players.indexOf(dealing) + 1) % 3];
  assert.strictEqual(h.players[M.dealerIdx(h, h.round)], next);
  const two = { ...mid, players: ["a", "b"] };
  assert.deepStrictEqual(M.dropFromGame(two, "a"), two);          // two players is the minimum
});
