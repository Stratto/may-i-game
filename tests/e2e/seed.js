// A returning player's data: two tables with finished games. Pass {live: true} to add a game in progress at Family.
// Used by tap.py through add_init_script; written to localStorage before the app loads.
window.__mayiSeed = function (opts) {
  const t = Date.now(), day = 864e5;
  const rules = { buyLimit: "3", customBuyLimit: 3, jokersWild: true, acesPosition: "low", twosWild: false };
  const table = (gid, name, P) => ({ id: gid, name, code: gid.toUpperCase() + "2345", players: P.map(([id, n, color]) => ({ id, name: n, color })), createdAt: t - 40 * day, updatedAt: t });
  const fam = [["a", "Ana", "red"], ["b", "Ben", "blue"], ["c", "Cy", "green"], ["d", "Dee", "amber"]];
  const fri = [["e", "Eve", "purple"], ["f", "Fin", "teal"], ["g", "Gus", "pink"]];
  const sc = (ids, rows) => Object.fromEntries(rows.map((row, i) => [i, Object.fromEntries(ids.map((id, k) => [id, row[k]]))]));
  const done = (id, gid, P, ago, rows) => { const ids = P.map(p => p[0]); return { id, groupId: gid, players: ids, dealer: 0, rules, round: 6, status: "done",
    startedAt: t - ago * day, endedAt: t - ago * day + 36e5, updatedAt: t - ago * day + 36e5, scores: sc(ids, rows), buys: {}, hands: {} }; };
  const R = [[0, 15, 20, 30], [5, 0, 25, 10], [0, 10, 30, 15], [10, 0, 35, 20], [0, 20, 5, 10], [5, 10, 0, 25], [0, 25, 40, 5]];
  const games = {
    f1: done("f1", "g1", fam, 9, R), f2: done("f2", "g1", fam, 5, R.map(r => [r[1], r[0], r[2], r[3]])), f3: done("f3", "g1", fam, 2, R),
    r1: done("r1", "g2", fri, 6, R.map(r => r.slice(0, 3))), r2: done("r2", "g2", fri, 1, R.map(r => [r[2], r[0], r[1]])),
  };
  if (opts && opts.live) games.live = { id: "live", groupId: "g1", players: ["a", "b", "c", "d"], dealer: 1, rules, round: 3, status: "live", startedAt: t - 36e5, updatedAt: t,
    scores: sc(["a", "b", "c", "d"], [[0, 30, 60, 40], [5, 0, 70, 40], [10, 20, 0, 30]]), buys: {}, hands: {} };
  localStorage.setItem("mayi:v5", JSON.stringify({ groups: { g1: table("g1", "Family", fam), g2: table("g2", "Friday night", fri) }, games, groupOrder: ["g1", "g2"] }));
  localStorage.setItem("mayi:settings:v6", JSON.stringify({ level: "pro", sound: false }));
};
