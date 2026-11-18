const test = require("node:test");
const assert = require("node:assert");
const M = require("./harness.js");
const { sc, RULES, gTie } = require("./fixtures.js");

const CARD = /^(10|[2-9AJQK])[SHDC]$|^JOKER$/;
const ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = c => c.slice(0, -1), suit = c => c.slice(-1);
const isSet = m => m.length >= 3 && m.every(c => rank(c) === rank(m[0]));
const isRun = m => m.length >= 4 && m.every(c => suit(c) === suit(m[0])) && m.every((c, i) => !i || ORDER.indexOf(rank(c)) === ORDER.indexOf(rank(m[i - 1])) + 1);

// ── The seven contracts ───────────────────────────────────────────
test("rounds: seven contracts, 10 cards then 12, only round 7 goes out", () => {
  assert.strictEqual(M.ROUNDS.length, 7);
  assert.deepStrictEqual(M.ROUNDS.map(r => r.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepStrictEqual(M.ROUNDS.map(r => r.cards), [10, 10, 10, 12, 12, 12, 12]);
  assert.deepStrictEqual(M.ROUNDS.map(r => !!r.goOut), [false, false, false, false, false, false, true]);
});

test("rounds: every example meld is a real set or run made of real cards", () => {
  M.ROUNDS.forEach(r => r.ex.forEach(m => {
    m.forEach(c => assert.match(c, CARD, r.name + ": " + c));
    assert.ok(isSet(m) || isRun(m), r.name + ": " + m.join(" "));
  }));
});

test("rounds: contract lines read the way players say them", () => {
  assert.deepStrictEqual(M.ROUNDS.map(M.contractLine), [
    "2 sets of 3", "1 set of 3 + 1 run of 4", "2 runs of 4", "3 sets of 3",
    "2 sets of 3 + 1 run of 4", "1 set of 3 + 2 runs of 4", "3 runs of 4",
  ]);
});

test("guide: one entry per round, and its card maths matches the contract", () => {
  assert.strictEqual(M.GUIDE.length, 7);
  M.GUIDE.forEach((g, i) => {
    const need = M.ROUNDS[i].ex.reduce((s, m) => s + m.length, 0);
    assert.strictEqual(g.inContract, need, "round " + (i + 1));
    assert.ok(g.inContract <= M.ROUNDS[i].cards, "round " + (i + 1) + " needs more cards than are dealt");
    assert.ok(g.goal && g.after && g.tips.length && g.pro.length, "round " + (i + 1) + " is missing copy");
  });
  assert.strictEqual(M.GUIDE[6].inContract, 12);   // round 7 uses every card
});

// ── Card values ───────────────────────────────────────────────────
test("cardValue: numbers at face value, J/Q/K 10, joker 15", () => {
  const r = RULES;
  assert.deepStrictEqual(["3", "7", "10", "J", "Q", "K", "JOKER"].map(c => M.cardValue(c, r)), [3, 7, 10, 10, 10, 10, 15]);
});

test("cardValue: scanned cards keep their suit and still score", () => {
  assert.deepStrictEqual(["7S", "10H", "KD", "AC"].map(c => M.cardValue(c, RULES)), [7, 10, 10, 1]);
  assert.strictEqual(M.rankPart("10H"), "10");
  assert.strictEqual(M.rankPart("JOKER"), "JOKER");
});

test("cardValue: aces follow the house rule, A1 and A15 are explicit", () => {
  assert.strictEqual(M.cardValue("A", { ...RULES, acesPosition: "low" }), 1);
  assert.strictEqual(M.cardValue("A", { ...RULES, acesPosition: "high" }), 15);
  assert.strictEqual(M.cardValue("A1", { ...RULES, acesPosition: "both" }), 1);
  assert.strictEqual(M.cardValue("A15", { ...RULES, acesPosition: "both" }), 15);
});

test("cardValue: 2s are 15 only when wild; junk scores 0", () => {
  assert.strictEqual(M.cardValue("2", RULES), 2);
  assert.strictEqual(M.cardValue("2H", { ...RULES, twosWild: true }), 15);
  assert.strictEqual(M.cardValue("?", RULES), 0);
});

test("card points are their own rule: an ace is one value wherever it sits in a run", () => {
  const d = M.DEFAULT_RULES;
  assert.strictEqual(d.aceValue, 15);
  assert.strictEqual(d.jokerValue, 15);
  ["low", "high", "both"].forEach(pos => assert.strictEqual(M.cardValue("A", { ...d, acesPosition: pos }), 15, pos));
  assert.strictEqual(M.cardValue("AS", { ...d, aceValue: 20 }), 20);
  assert.strictEqual(M.cardValue("A", { ...d, aceValue: 1 }), 1);
  assert.strictEqual(M.cardValue("JOKER", { ...d, jokerValue: 50 }), 50);
  assert.strictEqual(M.cardValue("2H", { ...d, twosWild: true, jokerValue: 25 }), 25);
  assert.strictEqual(M.rulesLine({ ...d, aceValue: 20, jokerValue: 50 }), "3 buys · jokers wild · aces low · aces 20 pts · jokers 50 pts");
  assert.strictEqual(M.rulesLine(d), "3 buys · jokers wild · aces low");
  assert.match(M.ruleHint("aceValue", d), /costs 15 points/);
  assert.ok(M.RULE_WHY.aceValue && M.RULE_WHY.jokerValue);
});

test("games from before card points keep their old ace scoring", () => {
  const old = { buyLimit: "3", jokersWild: true, acesPosition: "low", twosWild: false };
  assert.strictEqual(M.cardValue("A", old), 1);
  assert.strictEqual(M.cardValue("A", { ...old, acesPosition: "high" }), 15);
  assert.strictEqual(M.cardValue("JOKER", old), 15);
});

// ── House rules ───────────────────────────────────────────────────
test("buy limits: classic 3, custom at least 1, unlimited", () => {
  assert.strictEqual(M.buyLimitOf(RULES), 3);
  assert.strictEqual(M.buyLimitOf({ buyLimit: "custom", customBuyLimit: 5 }), 5);
  assert.strictEqual(M.buyLimitOf({ buyLimit: "custom", customBuyLimit: 0 }), 1);
  assert.strictEqual(M.buyLimitOf({ buyLimit: "unlimited" }), Infinity);
});

test("rules line and hints describe the table's rules", () => {
  assert.strictEqual(M.rulesLine(RULES), "3 buys · jokers wild · aces low");
  assert.strictEqual(M.rulesLine({ ...RULES, buyLimit: "unlimited", jokersWild: false, twosWild: true, acesPosition: "both" }), "Unlimited buys · no jokers · 2s wild · aces either");
  assert.strictEqual(M.ruleHint("buyLimit", { buyLimit: "custom", customBuyLimit: 1 }), "Each player can buy up to 1 time per round. Resets each round.");
  assert.match(M.ruleHint("buyLimit", { buyLimit: "unlimited" }), /as many times/);
  assert.match(M.ruleHint("acesPosition", { acesPosition: "both" }), /can't wrap/);
  ["buyLimit", "jokersWild", "twosWild", "acesPosition"].forEach(k => assert.ok(M.RULE_WHY[k], "no Why? note for " + k));
});

// ── Game maths ────────────────────────────────────────────────────
test("rounds count as done only when every player has a score", () => {
  const g = { players: ["a", "b"], scores: { 0: { a: 0, b: 10 }, 1: { a: 5 } } };
  assert.strictEqual(M.roundDone(g, 0), true);
  assert.strictEqual(M.roundDone(g, 1), false);
  assert.strictEqual(M.roundDone(g, 2), false);
});

test("totals add every round and the lowest total ranks first", () => {
  assert.deepStrictEqual(M.totalsOf(gTie), [{ id: "a", total: 35 }, { id: "b", total: 35 }, { id: "c", total: 130 }]);
  assert.deepStrictEqual(M.rankOf({ players: ["a", "b", "c"], scores: sc(["a", "b", "c"], [[30, 0, 10]]) }).map(x => x.id), ["b", "c", "a"]);
});

test("the deal moves one seat left each round and wraps", () => {
  const g = { dealer: 2, players: ["a", "b", "c"] };
  assert.deepStrictEqual([0, 1, 2, 3, 6].map(r => M.dealerIdx(g, r)), [2, 0, 1, 2, 2]);
  assert.strictEqual(M.dealerIdx({ dealer: 0, players: [] }, 3), 0);   // no players, no crash
});

test("removed players keep their name in old games", () => {
  const group = { players: [{ id: "a", name: "Ana", color: "red" }] };
  const game = { names: { z: { name: "Zed", color: "blue" } } };
  const pl = M.plOf(group, game);
  assert.strictEqual(pl("a").name, "Ana");
  assert.deepStrictEqual(pl("z"), { id: "z", name: "Zed", color: "blue" });
  assert.strictEqual(pl("q").name, "Former player");
  assert.deepStrictEqual(M.namesOf(group, ["a", "q"]), { a: { name: "Ana", color: "red" }, q: { name: "Former player", color: "red" } });
});

// ── Coaching content ──────────────────────────────────────────────
test("coaching content is complete, and the questions it answers are in place", () => {
  assert.ok(M.TURN_STEPS.length >= 4);
  assert.ok(M.MAYI_STEPS.some(s => s.d.includes("{limit}")), "May I? steps lost the buy-limit placeholder");
  // The guide has no separate Q&A: each answer lives in the step it belongs to.
  const turn = M.TURN_STEPS.map(s => s.t + " " + s.d).join(" "), mayi = M.MAYI_STEPS.map(s => s.t + " " + s.d).join(" ");
  assert.match(turn, /set of four or a run of six still counts/, "longer melds");
  assert.match(turn, /Waiting is allowed/, "going down is optional");
  assert.match(turn, /only after going down/i, "laying off needs going down first");
  assert.match(turn, /a meld is a set or run/, "meld is defined where it is first used");
  assert.match(mayi, /first refusal/, "two callers");
  assert.match(M.ROUNDS[6].watch + " " + M.ROUNDS[6].tip, /no final discard/i, "round 7");
});

// ── A whole game ──────────────────────────────────────────────────
test("a full seven-round game: lowest total wins, the deal goes round the table", () => {
  const players = ["a", "b", "c", "d"];
  const rows = [[0, 25, 40, 12], [18, 0, 30, 22], [35, 10, 0, 9], [0, 45, 60, 20], [22, 0, 15, 31], [14, 26, 0, 8], [0, 55, 70, 40]];
  const g = { players, dealer: 1, rules: RULES, scores: sc(players, rows) };
  for (let i = 0; i < 7; i++) assert.ok(M.roundDone(g, i));
  const ranked = M.rankOf(g);
  assert.deepStrictEqual(ranked.map(x => x.id), ["a", "d", "b", "c"]);
  assert.strictEqual(ranked[0].total, 89);
  assert.strictEqual(ranked.reduce((s, x) => s + x.total, 0), rows.flat().reduce((s, v) => s + v, 0));
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(r => players[M.dealerIdx(g, r)]), ["b", "c", "d", "a", "b", "c", "d"]);
});
