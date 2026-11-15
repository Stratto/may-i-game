const test = require("node:test");
const assert = require("node:assert");
const S = require("./harness.js");
const { sc, RULES, NAMES, gTie, gHands, gCome, h1, h2, state } = require("./fixtures.js");
const byKey = a => Object.fromEntries(a.map(x => [x.key, x]));

// ── gameAwards ────────────────────────────────────────────────────
test("gameAwards: ties give no award (clean, bargain, steady)", () => {
  const aw = S.gameAwards(gTie);
  assert.deepStrictEqual(aw.map(x => x.key), ["comeback", "heavy"]);
  const k = byKey(aw);
  assert.deepStrictEqual(k.comeback, { key: "comeback", ic: "bolt", t: "Comeback kid", id: "c", d: "From 25 to 0 in round 5" });
  assert.deepStrictEqual(k.heavy, { key: "heavy", ic: "calc", t: "Heavy pockets", id: "c", d: "Caught with 30 in round 6" });
});

test("gameAwards: hands game gives bargain, comeback, heavy, joker; steady skipped (spread > 20)", () => {
  const k = byKey(S.gameAwards(gHands));
  assert.deepStrictEqual(Object.keys(k), ["bargain", "comeback", "heavy", "joker"]);
  assert.strictEqual(k.bargain.id, "c"); assert.strictEqual(k.bargain.d, "Said “May I?” 3 times"); assert.strictEqual(k.bargain.ic, "mayi");
  assert.strictEqual(k.comeback.id, "b"); assert.strictEqual(k.comeback.d, "From 32 to 0 in round 2");
  assert.strictEqual(k.heavy.id, "c"); assert.strictEqual(k.heavy.d, "Caught with 43 in round 1");
  assert.deepStrictEqual(k.joker, { key: "joker", ic: "flag", t: "Joker juggler", id: "a", d: "Caught with 2 jokers, worth 30" });
});

test("gameAwards: big comeback game and steady/clean in h1", () => {
  const k = byKey(S.gameAwards(gCome));
  assert.deepStrictEqual(Object.keys(k), ["clean", "comeback", "heavy"]);
  assert.deepStrictEqual(k.clean, { key: "clean", ic: "out", t: "Clean hands", id: "b", d: "Went out 2 times" });
  assert.strictEqual(k.comeback.id, "c"); assert.strictEqual(k.comeback.d, "From 70 to 0 in round 3");
  assert.strictEqual(k.heavy.d, "Caught with 70 in round 2");

  const h = byKey(S.gameAwards(h1));
  assert.deepStrictEqual(Object.keys(h), ["clean", "bargain", "comeback", "steady", "heavy"]);
  assert.strictEqual(h.clean.d, "Went out 4 times");
  assert.strictEqual(h.bargain.d, "Said “May I?” 2 times");
  assert.deepStrictEqual(h.steady, { key: "steady", ic: "chart", t: "Steady hand", id: "a", d: "Every round within 10 points" });
  assert.strictEqual(h.comeback.d, "From 35 to 5 in round 5");
  assert.strictEqual(h.heavy.d, "Caught with 40 in round 7");
});

test("gameAwards: every icon is from the allowed set", () => {
  const ok = new Set(["out", "mayi", "bolt", "chart", "calc", "trophy", "flag"]);
  [gTie, gHands, gCome, h1, h2].forEach(g => S.gameAwards(g).forEach(a => assert.ok(ok.has(a.ic), a.ic)));
});

// ── chaseNotes ────────────────────────────────────────────────────
test("chaseNotes: close race copy with leader's name", () => {
  assert.deepStrictEqual(S.chaseNotes(gHands, NAMES), [
    { id: "b", text: "26 behind with 4 rounds left. Beat Ana by about 7 a round and it's yours." },
    { id: "c", text: "36 behind with 4 rounds left. Beat Ana by about 9 a round and it's yours. You've gone out before, so you know how." },
  ]);
});

test("chaseNotes: all three branches (close, long haul, big swing)", () => {
  assert.deepStrictEqual(S.chaseNotes(gCome, state.groups.g2.players), [
    { id: "a", text: "25 behind with 3 rounds left. Beat Ben by about 9 a round and it's yours." },
    { id: "d", text: "60 behind with 3 rounds left, so about 20 a round. Ben has had a 30-point round before. One big swing changes everything." },
    { id: "c", text: "90 behind with 3 rounds left, about 30 a round. Go down early and dump high cards to chip away. Ben's worst round so far was 30. You've gone out before, so you know how." },
  ]);
});

test("chaseNotes: \"Only\" within 15 points; the pep talk is for last place only", () => {
  const g = { ...gCome, players: ["a", "b"], scores: sc(["a", "b"], [[0, 10], [5, 0], [0, 10]]) };
  assert.deepStrictEqual(S.chaseNotes(g, NAMES), [{ id: "b", text: "Only 15 behind with 4 rounds left. Beat Ana by about 4 a round and it's yours. You've gone out before, so you know how." }]);
  const tied = { ...g, scores: sc(["a", "b"], [[0, 10], [10, 0]]) };
  assert.deepStrictEqual(S.chaseNotes(tied, NAMES), []);   // nobody is behind
});

test("chaseNotes: empty when done or nothing scored", () => {
  assert.deepStrictEqual(S.chaseNotes(gTie, NAMES), []);
  assert.deepStrictEqual(S.chaseNotes({ ...gTie, status: "live" }, NAMES), []);   // all 7 rounds scored
  assert.deepStrictEqual(S.chaseNotes({ ...gHands, scores: {} }, NAMES), []);
  assert.strictEqual(S.chaseNotes(gHands)[0].text.includes("Beat the leader by about 7"), true);   // no names given
});

// ── caughtStats ───────────────────────────────────────────────────
test("caughtStats: categories, shares, top card, toughest round, buy warning", () => {
  const r = S.caughtStats(gHands);
  assert.deepStrictEqual(r.cats, [
    { key: "wild", label: "Jokers & wilds", pts: 60, pct: 36 },
    { key: "face", label: "Faces (J/Q/K)", pts: 50, pct: 30 },
    { key: "high", label: "High (8–10)", pts: 27, pct: 16 },
    { key: "ace", label: "Aces", pts: 15, pct: 9 },
    { key: "low", label: "Low (2–7)", pts: 15, pct: 9 },
  ]);
  assert.strictEqual(r.cats.reduce((s, c) => s + c.pts, 0), 167);   // matches the scored rounds exactly
  assert.deepStrictEqual(r.topCard, { token: "K", pts: 40, count: 4 });
  assert.deepStrictEqual(r.toughest, { round: 0, total: 75 });
  assert.strictEqual(r.buyWarning, "Heavy buying is backfiring. Big buyers are averaging 24 a round against a table average of 19. Each buy adds a penalty card.");
});

test("caughtStats: rules change categories and values (2s not wild, aces low)", () => {
  const r = S.caughtStats({ ...gHands, rules: RULES });
  const k = byKey(r.cats);
  assert.strictEqual(k.wild.pts, 45);   // three jokers only
  assert.strictEqual(k.ace.pts, 1);
  assert.strictEqual(k.low.pts, 17);    // 7 + 2 + 3 + 5
});

test("caughtStats: no hands means no categories", () => {
  const r = S.caughtStats(gTie);
  assert.deepStrictEqual(r.cats, []);
  assert.strictEqual(r.topCard, null);
  assert.deepStrictEqual(r.toughest, { round: 5, total: 40 });
  assert.strictEqual(r.buyWarning, null);
});

// ── playerProfile ─────────────────────────────────────────────────
test("playerProfile: Ana across h1, tie, h2 (live and abandoned ignored)", () => {
  const p = S.playerProfile(state, "g1", "a");
  assert.strictEqual(p.games, 3);
  assert.strictEqual(p.wins, 2);
  assert.strictEqual(p.winRate, 2 / 3);
  assert.strictEqual(p.avg, 115 / 3);
  assert.deepStrictEqual(p.bestGame, { total: 20, gameId: "h1" });
  assert.deepStrictEqual(p.bestRound, { v: 0, gameId: "h1", round: 0 });
  assert.strictEqual(p.outs, 8);
  assert.strictEqual(p.buys, 1);
  assert.strictEqual(p.roundsWon, 8);
  assert.deepStrictEqual(p.streak, { current: 0, best: 2 });
  assert.deepStrictEqual(p.badges, { clean: 1, steady: 1, comeback: 1 });
  assert.deepStrictEqual(p.h2h, [{ id: "b", played: 3, wins: 1, losses: 1 }, { id: "c", played: 2, wins: 2, losses: 0 }]);
});

test("playerProfile: Ben's live streak, Cy winless, Dee empty", () => {
  const b = S.playerProfile(state, "g1", "b");
  assert.strictEqual(b.wins, 2);
  assert.deepStrictEqual(b.streak, { current: 2, best: 2 });
  assert.deepStrictEqual(b.badges, { bargain: 1, clean: 1 });

  const c = S.playerProfile(state, "g1", "c");
  assert.strictEqual(c.games, 2); assert.strictEqual(c.wins, 0);
  assert.deepStrictEqual(c.streak, { current: 0, best: 0 });
  assert.deepStrictEqual(c.badges, { comeback: 2, heavy: 2 });
  assert.deepStrictEqual(c.h2h, [{ id: "a", played: 2, wins: 0, losses: 2 }, { id: "b", played: 2, wins: 0, losses: 2 }]);

  const d = S.playerProfile(state, "g1", "d");
  assert.deepStrictEqual(d, { games: 0, wins: 0, winRate: 0, avg: 0, bestGame: null, bestRound: null, outs: 0, buys: 0,
    streak: { current: 0, best: 0 }, badges: {}, roundsWon: 0, h2h: [] });
});

// ── groupRecords ──────────────────────────────────────────────────
test("groupRecords: lowest win, most outs, streak holder, most games", () => {
  assert.deepStrictEqual(S.groupRecords(state, "g1"), {
    lowestWin: { v: 10, id: "b", ids: ["b"], gameId: "h2" },
    mostOuts: { v: 6, id: "b", gameId: "h2" },
    longestStreak: { v: 2, id: "a" },   // Ana reached 2 first (game ending at 2000); Ben matched it at 3000
    mostGames: { v: 3, id: "a" },       // Ana and Ben both 3; group order breaks the tie
  });
  assert.deepStrictEqual(S.groupRecords(state, "g2"), { lowestWin: null, mostOuts: null, longestStreak: null, mostGames: null });
});

test("groupRecords: shared lowest win lists both winners", () => {
  const st = { ...state, games: { tie: gTie } };
  assert.deepStrictEqual(S.groupRecords(st, "g1").lowestWin, { v: 35, id: "a", ids: ["a", "b"], gameId: "tie" });
});

// ── rankMoves ─────────────────────────────────────────────────────
test("rankMoves: Ben up one, Ana down one after round 4", () => {
  assert.deepStrictEqual(S.rankMoves(gCome), { a: -1, b: 1, c: 0, d: 0 });
  assert.deepStrictEqual(S.rankMoves(gHands), { a: 0, b: 0, c: 0 });
});

test("rankMoves: empty with fewer than 2 rounds done", () => {
  assert.deepStrictEqual(S.rankMoves({ ...gCome, scores: sc(["a", "b", "c", "d"], [[0, 30, 60, 40]]) }), {});
  // a half-entered second round doesn't count
  assert.deepStrictEqual(S.rankMoves({ ...gCome, scores: { ...sc(["a", "b", "c", "d"], [[0, 30, 60, 40]]), 1: { a: 5 } } }), {});
});
