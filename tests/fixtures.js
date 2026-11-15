// Shared game fixtures. Round indexes are 0-based (round 0 is Two Sets).
// Build scores {round: {pid: v}} from rows of [v per player] in player order.
const sc = (players, rows) => Object.fromEntries(rows.map((row, i) => [i, Object.fromEntries(players.map((p, k) => [p, row[k]]))]));
const RULES = { buyLimit: "3", customBuyLimit: 3, jokersWild: true, acesPosition: "low", twosWild: false };
const NAMES = { a: "Ana", b: "Ben", c: "Cy", d: "Dee" };

// ── Fixture 1: a&b tie for the win ────────────────────────────────
const gTie = {
  id: "tie", groupId: "g1", players: ["a", "b", "c"], dealer: 0, rules: RULES, round: 6, status: "done", startedAt: 1, endedAt: 2000,
  scores: sc(["a", "b", "c"], [[0, 10, 20], [10, 0, 20], [0, 10, 15], [10, 0, 25], [5, 5, 0], [0, 10, 30], [10, 0, 20]]),
  buys: { 0: { a: 1, b: 1 } }, hands: {},
};

// ── Fixture 2: live game with stored hands (2s wild, aces high) ───
const gHands = {
  id: "hands", groupId: "g1", players: ["a", "b", "c"], dealer: 0, rules: { ...RULES, twosWild: true, acesPosition: "high" }, round: 3, status: "live", startedAt: 1,
  scores: sc(["a", "b", "c"], [[0, 32, 43], [30, 0, 28], [5, 29, 0]]),
  buys: { 0: { c: 2 }, 1: { c: 1 }, 2: { a: 1 } },
  hands: {
    0: { b: ["JOKER", "KS", "7H"], c: ["2C", "AH", "10D", "3S"] },
    1: { a: ["JOKER", "JOKER"], c: ["K", "Q", "8"] },
    2: { a: ["5"], b: ["KH", "K", "9C"] },
  },
};

// ── Fixture 3: live 4-player game, Cy's 70 → 0 comeback, Ben overtakes Ana ──
const gCome = {
  id: "come", groupId: "g2", players: ["a", "b", "c", "d"], dealer: 0, rules: RULES, round: 4, status: "live", startedAt: 1,
  scores: sc(["a", "b", "c", "d"], [[0, 30, 60, 40], [5, 0, 70, 40], [10, 20, 0, 30], [60, 0, 10, 0]]),
  buys: {}, hands: {},
};

// ── Fixture 4: history around gTie for streaks and h2h ────────────
const h1 = {
  id: "h1", groupId: "g1", players: ["a", "b", "c"], dealer: 0, rules: RULES, round: 6, status: "done", startedAt: 1, endedAt: 1000,
  scores: sc(["a", "b", "c"], [[0, 15, 20], [5, 0, 25], [0, 10, 30], [10, 0, 35], [0, 20, 5], [5, 10, 0], [0, 25, 40]]),
  buys: { 3: { b: 2 } }, hands: {},
};
const h2 = {
  id: "h2", groupId: "g1", players: ["a", "b"], dealer: 0, rules: RULES, round: 6, status: "done", startedAt: 1, endedAt: 3000,
  scores: sc(["a", "b"], [[10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [0, 10]]),
  buys: {}, hands: {},
};
const abandoned = { ...h2, id: "ab", status: "abandoned", endedAt: 4000, scores: sc(["a", "b"], [[0, 99]]) };

const state = {
  groups: {
    g1: { id: "g1", name: "Thursday", code: "X", players: ["a", "b", "c", "d"].map(id => ({ id, name: NAMES[id], color: "red" })), createdAt: 1, updatedAt: 1 },
    g2: { id: "g2", name: "Other", code: "Y", players: ["a", "b", "c", "d"].map(id => ({ id, name: NAMES[id], color: "red" })), createdAt: 1, updatedAt: 1 },
  },
  games: { tie: gTie, hands: gHands, come: gCome, h1, h2, ab: abandoned },
  groupOrder: ["g1", "g2"],
};

module.exports = { sc, RULES, NAMES, gTie, gHands, gCome, h1, h2, abandoned, state };
