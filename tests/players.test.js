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
test("avatars: the deck offers 17 faces, and new players are dealt one of the 13 people", () => {
  assert.strictEqual(M.AV_CARDS.length, 17);
  assert.deepStrictEqual(M.AV_CARDS.slice(0, 4).map(c => c.label), ["King of hearts", "King of diamonds", "King of spades", "King of clubs"]);
  assert.strictEqual(M.AV_CARDS[16].label, "The Joker");
  assert.strictEqual(M.AV_FACES.length, 13);
  assert.ok(M.AV_FACES.every(k => !k.endsWith("-a")), "aces can be picked but aren't dealt");
});

test("avatars: a starting face is chosen from the name, the same every time", () => {
  const a = M.avSeed("Ana"), b = M.avSeed("Ana");
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.type, "card");
  assert.ok(M.AV_FACES.includes(a.card), a.card);
});

test("avatars: a starting face skips faces others at the table hold", () => {
  const held = M.AV_FACES.filter(k => k !== "club-j");
  assert.deepStrictEqual(M.avSeed("Anyone", held), { type: "card", card: "club-j" });
  assert.ok(M.AV_FACES.includes(M.avSeed("Anyone", M.AV_FACES).card), "a full table still gets a face");
});

test("avatars: old 3D characters and missing pictures are dealt a face; real choices are kept", () => {
  const old = { type: "face", v: 4, who: "Boy", tone: "Medium" };
  assert.strictEqual(M.avOf(old, "Cy").type, "card");
  assert.strictEqual(M.avOf(undefined, "Cy").type, "card");
  assert.strictEqual(M.avOf({ type: "card", card: "nonsense" }, "Cy").card !== "nonsense", true);
  const kept = [{ type: "photo", src: "data:x" }, { type: "initials" }, { type: "card", card: "spade-a" }];
  kept.forEach(av => assert.deepStrictEqual(M.avOf(av, "Cy"), av));
  assert.strictEqual(M.avOf({ type: "photo" }, "Cy").type, "card");
});

test("avatars: a table's players are dealt different faces, in seat order, without saving", () => {
  const names = ["Ana", "Ben", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal"];
  const players = names.map((n, i) => ({ id: "p" + i, name: n, color: "red", ...(i === 2 ? { avatar: { type: "card", card: M.avSeed("Ana").card } } : {}) }));
  const raw = { groups: { g: { id: "g", players } }, games: {} };
  const out = M.dealFaces(raw);
  const cards = out.groups.g.players.map(p => p.avatar.card);
  assert.strictEqual(new Set(cards).size, 8, "no repeats: " + cards.join(", "));
  assert.strictEqual(cards[2], M.avSeed("Ana").card, "a face already picked stays put");
  assert.strictEqual(raw.groups.g.players[0].avatar, undefined, "the stored state is untouched");
  const done = { groups: { g: { id: "g", players: [{ id: "a", name: "A", avatar: { type: "initials" } }] } } };
  assert.deepStrictEqual(M.dealFaces(done), done, "nothing to deal leaves the table as it is");
});

test("avatars: share image sources for photos, cards and initials", () => {
  assert.strictEqual(M.avatarSrc({ type: "photo", src: "data:image/jpeg;base64,xx" }), "data:image/jpeg;base64,xx");
  assert.strictEqual(M.avatarSrc({ type: "card", card: "heart-k" }), "art/avatars/heart-k.webp");
  assert.strictEqual(M.avatarSrc({ type: "card", card: "spade-a" }), "art/suits/spade.webp");
  assert.strictEqual(M.avatarSrc({ type: "card", card: "joker" }), "art/avatars/joker.webp");
  assert.strictEqual(M.avatarSrc({ type: "initials" }), null);
  assert.strictEqual(M.avatarSrc(null), null);
});

test("avatars: the real card for a face", () => {
  assert.deepStrictEqual(M.faceProps("diamond-q"), { rank: "Q", suit: "diamond" });
  assert.deepStrictEqual(M.faceProps("club-a"), { rank: "A", suit: "club" });
  assert.deepStrictEqual(M.faceProps("joker"), { joker: true });
});

test("avatars: old games remember card faces but not photos", () => {
  const group = { players: [{ id: "a", name: "Ana", color: "red", avatar: { type: "photo", src: "data:x" } }, { id: "b", name: "Ben", color: "blue", avatar: M.avSeed("Ben") }] };
  const names = M.namesOf(group, ["a", "b"]);
  assert.strictEqual(names.a.avatar, undefined);
  assert.strictEqual(names.b.avatar.type, "card");
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
