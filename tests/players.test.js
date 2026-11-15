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
  assert.deepStrictEqual([a.type, a.v], ["face", 4]);
  assert.ok(M.FIG.looks.includes(a.who) && a.who.startsWith("Person"), "starting characters use the Person forms: " + a.who);
  assert.ok(M.FIG.tones.slice(0, 5).includes(a.tone), a.tone);
  assert.notDeepStrictEqual(M.avSeed("Ana"), M.avSeed("Benjamin"));
});

test("avatars: costumes and moods come in the character's own form", () => {
  assert.strictEqual(M.figGender("Woman curly hair"), "Woman");
  assert.strictEqual(M.figGender("Old man"), "Man");
  assert.strictEqual(M.figGender("Princess"), "Woman");
  assert.strictEqual(M.figGender("Prince"), "Man");
  assert.strictEqual(M.figGender("Child"), "Person");
  assert.deepStrictEqual(["Woman", "Man", "Person"].map(g => M.figRole(g, "cook")), ["Woman cook", "Man cook", "Cook"]);
  assert.deepStrictEqual(["Woman", "Man", "Person"].map(g => M.figRole(g, "mage")), ["Woman mage", "Man mage", "Person mage"]);
  assert.deepStrictEqual(["Woman", "Man", "Person"].map(g => M.figRole(g, "royal")), ["Princess", "Prince", "Person with crown"]);
  assert.deepStrictEqual(["Woman", "Man", "Person"].map(g => M.figRole(g, "claus")), ["Mrs claus", "Santa claus", "Mx claus"]);
  assert.strictEqual(M.figMood("Person", "shrugging"), "Person shrugging");
});

test("avatars: picture addresses follow the pinned Fluent Emoji layout", () => {
  assert.strictEqual(M.figSrc("Woman curly hair", "Medium-Dark"),
    "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/Woman%20curly%20hair/Medium-Dark/3D/woman_curly_hair_3d_medium-dark.png");
  assert.match(M.figSrc("Ninja", "nonsense"), /\/Ninja\/Default\/3D\/ninja_3d_default\.png$/);
});

test("avatars: flat characters from before move to their nearest 3D look", () => {
  const first = { type: "face", skin: "#F7D7BA", hair: "curly", hairColor: "#DDB052", face: "cool", extra: "none", top: "#FFFFFF" };
  assert.deepStrictEqual(M.toFig(first), { type: "face", v: 4, who: "Woman blonde hair", tone: "Light" });
  const flat = { type: "face", v: 3, top: "shortFlat", hairColor: "#2C1B18", skin: "#614335", beard: "beardMedium" };
  assert.deepStrictEqual(M.toFig(flat), { type: "face", v: 4, who: "Man beard", tone: "Dark" });
  assert.strictEqual(M.toFig({ type: "face", v: 3, top: "hijab", skin: "#D08B5B", beard: "none" }).who, "Woman with headscarf");
  const now = { type: "face", v: 4, who: "Boy", tone: "Medium" };
  assert.deepStrictEqual(M.toFig(now), now);
});

test("avatars: a photo reading becomes a character only when it names a real look", () => {
  const base = { type: "face", v: 4, who: "Person", tone: "Dark" };
  assert.deepStrictEqual(M.figFromPhoto({ found: true, look: "Man red hair", tone: "Light" }, base), { type: "face", v: 4, who: "Man red hair", tone: "Light" });
  assert.strictEqual(M.figFromPhoto({ found: false, look: "Man", tone: "Light" }, base), null);
  assert.strictEqual(M.figFromPhoto({ found: true, look: "Dragon", tone: "Light" }, base), null);
  assert.strictEqual(M.figFromPhoto({ found: true, look: "Girl", tone: "Default" }, base).tone, "Dark");
  assert.deepStrictEqual(M.AVATAR_SCHEMA.properties.look.enum, M.FIG.looks);
});

test("avatars: share image sources for photos, characters and initials", () => {
  assert.strictEqual(M.avatarSrc({ type: "photo", src: "data:image/jpeg;base64,xx" }), "data:image/jpeg;base64,xx");
  assert.match(M.avatarSrc(M.avSeed("Cy")), /^https:\/\/cdn\.jsdelivr\.net\/gh\/microsoft\/fluentui-emoji@[0-9a-f]{40}\/assets\//);
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
