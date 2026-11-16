const test = require("node:test");
const assert = require("node:assert");
const S = require("./harness.js");
const { sc, RULES, NAMES, gTie, gHands, gCome, h1, h2, state } = require("./fixtures.js");
const byKey = a => Object.fromEntries(a.map(x => [x.key, x]));
// The six awards the table's award race shows; the newer ones get their own tests below.
const SIX = new Set(["clean", "bargain", "comeback", "steady", "heavy", "joker"]);
const six = a => a.filter(x => SIX.has(x.key));

// ── gameAwards ────────────────────────────────────────────────────
test("gameAwards: ties give no award (clean, bargain, steady)", () => {
  const aw = six(S.gameAwards(gTie));
  assert.deepStrictEqual(aw.map(x => x.key), ["comeback", "heavy"]);
  const k = byKey(aw);
  assert.deepStrictEqual(k.comeback, { key: "comeback", ic: "bolt", t: "Comeback kid", id: "c", d: "From 25 to 0 in round 5" });
  assert.deepStrictEqual(k.heavy, { key: "heavy", ic: "calc", t: "Heavy pockets", id: "c", d: "Caught with 30 in round 6" });
});

test("gameAwards: hands game gives bargain, comeback, heavy, joker; steady skipped (spread > 20)", () => {
  const k = byKey(six(S.gameAwards(gHands)));
  assert.deepStrictEqual(Object.keys(k), ["bargain", "comeback", "heavy", "joker"]);
  assert.strictEqual(k.bargain.id, "c"); assert.strictEqual(k.bargain.d, "Said “May I?” 3 times"); assert.strictEqual(k.bargain.ic, "mayi");
  assert.strictEqual(k.comeback.id, "b"); assert.strictEqual(k.comeback.d, "From 32 to 0 in round 2");
  assert.strictEqual(k.heavy.id, "c"); assert.strictEqual(k.heavy.d, "Caught with 43 in round 1");
  assert.deepStrictEqual(k.joker, { key: "joker", ic: "flag", t: "Joker juggler", id: "a", d: "Caught with 2 jokers, worth 30" });
});

test("gameAwards: big comeback game and steady/clean in h1", () => {
  const k = byKey(six(S.gameAwards(gCome)));
  assert.deepStrictEqual(Object.keys(k), ["clean", "comeback", "heavy"]);
  assert.deepStrictEqual(k.clean, { key: "clean", ic: "out", t: "Clean hands", id: "b", d: "Went out 2 times" });
  assert.strictEqual(k.comeback.id, "c"); assert.strictEqual(k.comeback.d, "From 70 to 0 in round 3");
  assert.strictEqual(k.heavy.d, "Caught with 70 in round 2");

  const h = byKey(six(S.gameAwards(h1)));
  assert.deepStrictEqual(Object.keys(h), ["clean", "bargain", "comeback", "steady", "heavy"]);
  assert.strictEqual(h.clean.d, "Went out 4 times");
  assert.strictEqual(h.bargain.d, "Said “May I?” 2 times");
  assert.deepStrictEqual(h.steady, { key: "steady", ic: "chart", t: "Steady hand", id: "a", d: "Every round within 10 points" });
  assert.strictEqual(h.comeback.d, "From 35 to 5 in round 5");
  assert.strictEqual(h.heavy.d, "Caught with 40 in round 7");
});

// ── The newer awards and table moments ────────────────────────────
const P6 = ["a", "b", "c", "d", "e", "f"], N6 = { ...NAMES, e: "Eve", f: "Fin" };
// Ana: last after round 1, a point behind Ben before the last round, wins by 4 with three outs in a row to finish.
const g6 = {
  id: "g6", groupId: "g1", players: P6, dealer: 0, rules: RULES, round: 6, status: "done", startedAt: 1000, endedAt: 1000 + 134 * 60000,
  scores: sc(P6, [[30, 0, 5, 5, 10, 20], [0, 10, 10, 10, 20, 20], [5, 10, 0, 13, 20, 20], [5, 10, 15, 0, 20, 20], [0, 4, 8, 10, 10, 20], [0, 5, 5, 5, 5, 10], [0, 5, 5, 5, 5, 10]]),
  buys: { 0: { b: 1 } }, hands: { 1: { c: ["AH", "AS", "A1"], d: ["AD"], e: ["K", "Q"] } },
};

test("gameAwards: winner awards, hat trick and card awards in a six-player game", () => {
  const k = byKey(S.gameAwards(g6));
  assert.deepStrictEqual(Object.keys(k).sort(), ["aceupsleeve", "bargain", "clean", "comeback", "curtaincall", "friends", "hattrick", "heavy", "heist", "hotheels", "photofinish", "quickoff", "selfmade", "soclose", "upfrombottom"]);
  assert.strictEqual(k.hattrick.d, "Went out in rounds 5, 6 and 7");
  assert.strictEqual(k.heist.d, "1 point behind going into the last round, and won");
  assert.strictEqual(k.upfrombottom.d, "Last after round 1, and still won");
  assert.strictEqual(k.photofinish.d, "Won by just 4 points");
  assert.deepStrictEqual([k.hotheels.id, k.hotheels.d], ["b", "Second, just 4 points behind"]);
  assert.strictEqual(k.selfmade.id, "a");
  assert.deepStrictEqual([k.aceupsleeve.id, k.aceupsleeve.d], ["c", "Caught holding 3 Aces"]);
  assert.deepStrictEqual([k.friends.id, k.friends.d], ["e", "Caught with 2 Jacks, Queens and Kings"]);
  assert.deepStrictEqual([k.quickoff.id, k.quickoff.d], ["b", "First to go out, in round 1"]);
  assert.deepStrictEqual([k.soclose.id, k.soclose.d], ["b", "Caught with just 4 in round 5"]);
  // Ana, Cy and Dee each went out once on their own deal: a tie, so no Dealer's choice.
  assert.ok(!k.dealerschoice);
});

test("gameAwards: the newer awards in the shared fixtures", () => {
  const h = byKey(S.gameAwards(h1));
  assert.deepStrictEqual([h.runmaker.id, h.wiretowire.id, h.selfmade.id, h.dealerschoice.d], ["a", "a", "a", "Went out on their own deal twice"]);
  assert.deepStrictEqual([h.goodsport.id, h.goodsport.d], ["c", "Last, but still went out once"]);
  assert.strictEqual(h.rollercoaster.d, "From going out to 40 in one game");
  const t = byKey(S.gameAwards(h2));
  assert.strictEqual(t.hattrick.d, "Went out 6 rounds in a row, 1 to 6");
  assert.strictEqual(t.setcollector.id, "b");
  assert.ok(!t.hotheels, "50 behind is not hot on their heels");
  assert.strictEqual(byKey(S.gameAwards(gCome)).heist.d, "35 points behind going into the last round, and won");
  const g = byKey(S.gameAwards(gHands));
  assert.deepStrictEqual([g.soclose.id, g.soclose.d], ["a", "Caught with just 5 in round 3"]);
  assert.deepStrictEqual([g.friends.id, g.friends.d], ["b", "Caught with 3 Jacks, Queens and Kings"]);
  assert.ok(!byKey(S.gameAwards(gTie)).photofinish, "a tie for the win gives no winner awards");
});

test("gameAwards: Flawless replaces the hat trick", () => {
  const g = { ...h2, id: "fl", scores: sc(["a", "b"], [[0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10]]) };
  const k = byKey(S.gameAwards(g));
  assert.strictEqual(k.flawless.d, "Went out in all seven rounds");
  assert.ok(!k.hattrick);
});

test("gameAwards: every award has a title, art and rarity", () => {
  [gTie, gHands, gCome, h1, h2, g6].forEach(g => S.gameAwards(g).forEach(a => {
    const m = S.AWARDS[a.key]; assert.ok(m && m.t && m.art && m.r > 0 && m.how, a.key);
  }));
  assert.strictEqual(Object.keys(S.AWARDS).length, 24);
});

test("tableMoments: twins, nail-biter, marathon and a packed table; a shared crown on a tie", () => {
  assert.deepStrictEqual(S.tableMoments(g6, id => N6[id]), [
    { key: "twins", t: "Twins", d: "Cy and Dee both finished on 48" },
    { key: "nailbiter", t: "Nail-biter", d: "The top three finished within 8 points of each other" },
    { key: "marathon", t: "Marathon", d: "2 hours 14 minutes from the first deal to the last score" },
    { key: "packedtable", t: "Packed table", d: "6 players around one table" },
  ]);
  assert.deepStrictEqual(S.tableMoments(gTie, id => NAMES[id]), [{ key: "sharedcrown", t: "Shared crown", d: "Ana and Ben share the win on 35" }]);
  assert.deepStrictEqual(S.tableMoments(h1, id => NAMES[id]), []);
});

test("gameAwards: every icon is from the allowed set", () => {
  const ok = new Set(["out", "mayi", "bolt", "chart", "calc", "trophy", "flag", "star"]);
  [gTie, gHands, gCome, h1, h2].forEach(g => S.gameAwards(g).forEach(a => assert.ok(ok.has(a.ic), a.ic)));
});

// ── chaseNotes ────────────────────────────────────────────────────
test("chaseNotes: close race copy with leader's name", () => {
  assert.deepStrictEqual(S.chaseNotes(gHands, NAMES), [
    { id: "b", text: "26 behind with 4 rounds left. Beating Ana by about 7 a round takes the lead." },
    { id: "c", text: "36 behind with 4 rounds left. Beating Ana by about 9 a round takes the lead. Cy has gone out before." },
  ]);
});

test("chaseNotes: all three branches (close, long haul, big swing)", () => {
  assert.deepStrictEqual(S.chaseNotes(gCome, state.groups.g2.players), [
    { id: "a", text: "25 behind with 3 rounds left. Beating Ben by about 9 a round takes the lead." },
    { id: "d", text: "60 behind with 3 rounds left, so about 20 a round. Ben has had a 30-point round before. One big swing changes everything." },
    { id: "c", text: "90 behind with 3 rounds left, about 30 a round. Going down early and dumping high cards chips away. Ben's worst round so far was 30. Cy has gone out before." },
  ]);
});

test("chaseNotes: \"Only\" within 15 points; the pep talk is for last place only", () => {
  const g = { ...gCome, players: ["a", "b"], scores: sc(["a", "b"], [[0, 10], [5, 0], [0, 10]]) };
  assert.deepStrictEqual(S.chaseNotes(g, NAMES), [{ id: "b", text: "Only 15 behind with 4 rounds left. Beating Ana by about 4 a round takes the lead. Ben has gone out before." }]);
  const tied = { ...g, scores: sc(["a", "b"], [[0, 10], [10, 0]]) };
  assert.deepStrictEqual(S.chaseNotes(tied, NAMES), []);   // nobody is behind
});

test("chaseNotes: empty when done or nothing scored", () => {
  assert.deepStrictEqual(S.chaseNotes(gTie, NAMES), []);
  assert.deepStrictEqual(S.chaseNotes({ ...gTie, status: "live" }, NAMES), []);   // all 7 rounds scored
  assert.deepStrictEqual(S.chaseNotes({ ...gHands, scores: {} }, NAMES), []);
  assert.strictEqual(S.chaseNotes(gHands)[0].text.includes("Beating the leader by about 7"), true);   // no names given
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
  assert.deepStrictEqual(p.badges, { clean: 1, steady: 1, runmaker: 1, curtaincall: 2, dealerschoice: 1, quickoff: 2, wiretowire: 1, selfmade: 1, comeback: 1 });
  assert.deepStrictEqual(p.h2h, [{ id: "b", played: 3, wins: 1, losses: 1 }, { id: "c", played: 2, wins: 2, losses: 0 }]);
});

test("playerProfile: Ben's live streak, Cy winless, Dee empty", () => {
  const b = S.playerProfile(state, "g1", "b");
  assert.strictEqual(b.wins, 2);
  assert.deepStrictEqual(b.streak, { current: 2, best: 2 });
  assert.deepStrictEqual(b.badges, { bargain: 1, curtaincall: 1, clean: 1, hattrick: 1, setcollector: 1, dealerschoice: 1, quickoff: 1, wiretowire: 1 });

  const c = S.playerProfile(state, "g1", "c");
  assert.strictEqual(c.games, 2); assert.strictEqual(c.wins, 0);
  assert.deepStrictEqual(c.streak, { current: 0, best: 0 });
  assert.deepStrictEqual(c.badges, { comeback: 2, heavy: 2, rollercoaster: 1, goodsport: 2 });
  assert.deepStrictEqual(c.h2h, [{ id: "a", played: 2, wins: 0, losses: 2 }, { id: "b", played: 2, wins: 0, losses: 2 }]);

  const d = S.playerProfile(state, "g1", "d");
  assert.deepStrictEqual(d, { games: 0, wins: 0, winRate: 0, avg: 0, bestGame: null, bestRound: null, outs: 0, buys: 0,
    streak: { current: 0, best: 0 }, badges: {}, badgeLast: {}, roundsWon: 0, h2h: [] });
});

// ── lifeAchievements ──────────────────────────────────────────────
test("lifeAchievements: earned once, dated, judged across tables by name", () => {
  const at = (d, h, m) => new Date(2026, 0, d, h, m || 0).getTime(), g = (id, gid, pl, rows, start, end, x) => ({ id, groupId: gid, players: pl, dealer: 0, rules: RULES, round: 6, status: "done", startedAt: start, endedAt: end, scores: sc(pl, rows), buys: {}, hands: {}, ...x });
  const G1 = g("G1", "g1", ["a", "b"], [[0, 10], [0, 10], [0, 10], [0, 10], [5, 0], [5, 0], [5, 0]], at(5, 8), at(5, 20));
  const G2 = g("G2", "g1", ["a", "b"], [[10, 0], [10, 5], [10, 0], [10, 5], [10, 0], [10, 4], [10, 0]], at(6, 19), at(6, 21), { hands: { 1: { b: ["7S", "KH"] } } });
  const G3 = g("G3", "g1", ["a", "b"], [[10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [0, 10]], at(6, 23), at(7, 1, 30));
  const G4 = g("G4", "g2", ["z", "q"], [[0, 5], [0, 5], [0, 5], [0, 5], [0, 5], [0, 5], [0, 5]], at(8, 19), at(8, 21));
  const st = { groups: { g1: { id: "g1", name: "T", players: [{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }] }, g2: { id: "g2", name: "U", players: [{ id: "z", name: "ana " }, { id: "q", name: "Quinn" }] } },
    groupOrder: ["g1", "g2"], games: { G1, G2, G3, G4 } };
  const got = l => Object.fromEntries(l.filter(x => x.at != null).map(x => [x.key, x.at]));
  assert.strictEqual(S.LIFE.length, 17);
  const ana = got(S.lifeAchievements(st, "g1", "a")), ben = got(S.lifeAchievements(st, "g1", "b"));
  assert.deepStrictEqual(Object.keys(ana).sort(), ["beginnersluck", "crowned", "earlybird", "grandtour", "nightowl", "outgate", "untouchable"]);
  assert.strictEqual(ana.crowned, G1.endedAt); assert.strictEqual(ana.grandtour, G4.endedAt); // round 7 at the other table completes the tour assert.strictEqual(ana.nightowl, G3.endedAt);
  assert.deepStrictEqual(Object.keys(ben).sort(), ["backtoback", "crowned", "earlybird", "grandtour", "nightowl", "outgate", "payback", "recordbreaker", "saycheese", "untouchable"]);
  assert.strictEqual(ben.payback, G2.endedAt); assert.strictEqual(ben.backtoback, G3.endedAt); assert.strictEqual(ben.grandtour, G3.endedAt); assert.strictEqual(ben.untouchable, G2.endedAt);
  // "ana " at the second table is Ana: her first crown is still the first game at the first table.
  assert.strictEqual(got(S.lifeAchievements(st, "g2", "z")).crowned, G1.endedAt);
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
