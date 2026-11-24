import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, Fragment } from "react";
import ReactDOM from "react-dom";

const ce = React.createElement;

// Ensure window.storage shim is initialized
(function(){
  try {
    var ls = window.localStorage;
    ls.setItem('__t','1'); ls.removeItem('__t');
    if (!window.storage) {
      window.storage = {
        get: function(k){ var v = ls.getItem(k); return Promise.resolve(v==null?null:{key:k,value:v}); },
        set: function(k,v){ ls.setItem(k,String(v)); return Promise.resolve({key:k,value:String(v)}); },
        delete: function(k){ ls.removeItem(k); return Promise.resolve({key:k,deleted:true}); },
        list: function(){ return Promise.resolve({keys:Object.keys(ls)}); }
      };
    }
  } catch(e){}
})();

/* ================================================================
   May I? · v5 "Score Track"
   Groups → games. Every player row is a lane; pegs race to the finish.
   ================================================================ */

// ── Live sharing (Supabase). Leave blank to run on this device only. ─
const SUPPORT_URL = "https://ko-fi.com/mayigame";

// ── Storage ───────────────────────────────────────────────────────
const STORE_KEY = "mayi:v5";
const MAX_PLAYERS = 8;
function loadJSON(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function haptic(ms) { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }
// Table sounds, made on the fly (no files). iPhones can't vibrate from the web, so sound is the feedback there.
let audioCtx = null, soundOn = true;
function sound(kind) {
  if (!soundOn) return;
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime, out = audioCtx.createGain(); out.gain.value = .16; out.connect(audioCtx.destination);
    const note = (f, at, len, type, vol) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol || 1, t0 + at + .008); g.gain.exponentialRampToValueAtTime(.001, t0 + at + len);
      o.connect(g); g.connect(out); o.start(t0 + at); o.stop(t0 + at + len + .02); };
    if (kind === "tap") note(1800, 0, .03, "triangle", .35);
    else if (kind === "chip") { note(2400, 0, .05, "square", .18); note(3100, .045, .07, "square", .14); }
    else if (kind === "save") { note(660, 0, .09, "triangle", .6); note(990, .07, .12, "triangle", .5); }
    else if (kind === "out") { [784, 988, 1175].forEach((f, i) => note(f, i * .07, .35, "sine", .7)); }
    else if (kind === "deal") { note(420, 0, .06, "triangle", .4); note(560, .05, .08, "triangle", .35); }
    else if (kind === "win") { [523, 659, 784, 1047].forEach((f, i) => note(f, i * .11, .5, "triangle", .7)); note(1319, .5, .9, "sine", .5); }
  } catch (e) {}
}
// Calm mode, reading scores aloud, Undo after a round and keeping the screen awake are set in Settings.
let calmOn = false, speakOn = false, undoOn = true, awakeOn = true;
const reducedMotion = () => calmOn || !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join("");
const now = () => Date.now();
// Copy with a fallback for browsers without the async clipboard (older iOS, http).
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(a); a.select(); const ok = document.execCommand("copy"); a.remove(); return ok; } catch (e) { return false; }
}
// A player in a game: the table's current player, else the name saved with the game.
const plOf = (group, game) => id => (group && group.players.find(p => p.id === id)) || (game && game.names && game.names[id] && { id, ...game.names[id] }) || { id, name: "Former player", color: "red" };
const namesOf = (group, ids) => Object.fromEntries(ids.map(id => { const p = group.players.find(x => x.id === id); return [id, p ? { name: p.name, color: p.color, ...(p.avatar && p.avatar.type !== "photo" ? { avatar: p.avatar } : {}) } : { name: "Former player", color: "red" }]; }));

// Peg colours: each player keeps one for life in a group.
const PEGS = [
  { k: "red",    c: "#D63B3B", ink: "#FFFFFF" },
  { k: "blue",   c: "#2563D9", ink: "#FFFFFF" },
  { k: "green",  c: "#178A4C", ink: "#FFFFFF" },
  { k: "amber",  c: "#F0A81C", ink: "#13233F" },
  { k: "purple", c: "#7A4BD8", ink: "#FFFFFF" },
  { k: "teal",   c: "#0B8F9E", ink: "#FFFFFF" },
  { k: "pink",   c: "#D13F93", ink: "#FFFFFF" },
  { k: "orange", c: "#E5631A", ink: "#FFFFFF" },
];
const peg = k => PEGS.find(p => p.k === k) || PEGS[0];

// ── Game data ─────────────────────────────────────────────────────
const ROUNDS = [
  { n:1, name:"Two Sets",         cards:10, ex:[["7S","7H","7C"],["KD","KS","KH"]], tip:"Keep pairs. Each is one card from a set.", watch:"Suits don't matter in a set." },
  { n:2, name:"Set & Run",        cards:10, ex:[["5C","5D","5H"],["8H","9H","10H","JH"]], tip:"Keep cards that touch, like 8♥ 9♥.", watch:"A run needs 4 cards in one suit." },
  { n:3, name:"Two Runs",         cards:10, ex:[["3S","4S","5S","6S"],["9D","10D","JD","QD"]], tip:"Pick two suits early.", watch:"One run of 8 is still one run." },
  { n:4, name:"Three Sets",       cards:12, ex:[["4S","4H","4D"],["9C","9S","9H"],["QH","QD","QC"]], tip:"Buying is strong here. One May I? can finish a set.", watch:"12 cards now, so a caught hand costs more." },
  { n:5, name:"Two Sets & a Run", cards:12, ex:[["6S","6D","6C"],["JH","JS","JD"],["2C","3C","4C","5C"]], tip:"Build the run first. Sets often arrive on their own.", watch:"The run must be one suit." },
  { n:6, name:"Set & Two Runs",   cards:12, ex:[["8S","8H","8D"],["2H","3H","4H","5H"],["9C","10C","JC","QC"]], tip:"Wild cards are worth the most this round.", watch:"Wilds can't outnumber natural cards." },
  { n:7, name:"Three Runs",       cards:12, goOut:true, ex:[["AS","2S","3S","4S"],["6H","7H","8H","9H"],["10D","JD","QD","KD"]], tip:"Every card has to fit. There's no final discard.", watch:"Going down means going out." },
];
const contractLine = r => {
  const s = r.ex.filter(m => m[0].slice(0, -1) === m[1].slice(0, -1)).length, u = r.ex.length - s;
  return [s && s + (s > 1 ? " sets" : " set") + " of 3", u && u + (u > 1 ? " runs" : " run") + " of 4"].filter(Boolean).join(" + ");
};
const HOW_TO = [
  ["deal", "Deal", "10 cards in rounds 1–3, 12 in rounds 4–7. The deal moves left each round."],
  ["draw", "Draw, then discard", "Take the top of the stock or the discard pile, then discard one."],
  ["down", "Go down once", "Lay the round's whole goal in one turn. No extra melds after."],
  ["layoff", "Lay off", "Once down, a player can add cards to any meld on the table."],
  ["mayi", "Say “May I?”", "Want a discard out of turn? Take it plus one penalty card from the stock."],
  ["out", "Go out", "First with no cards ends the round. Everyone else counts what's left. Lowest total after 7 rounds wins."],
];
// ── Rules & coaching content ──────────────────────────────────────
// Ported from builds 039ea2e (round coaching)
// and d1be84c ("Why this rule?" notes, live rule hints, May I? timeline).
// Index 0 of GUIDE is round 1 and lines up with ROUNDS.

const GUIDE = [
  { // 1 · Two Sets · deal 10
    goal: "Collect two sets: three cards of the same rank, twice. Suits don't matter.",
    inContract: 6,
    after: "No more sets or runs this round. Lay off on melds already on the table and discard each turn until out.",
    tips: [
      "Hold on to pairs. Every pair is one card away from a set.",
      "If a discard would finish a set on someone else's turn, say “May I?”",
    ],
    pro: [
      "Sets are the fastest goal. Go down early, then lay off high cards on everyone's sets.",
      "Watch which ranks other players pick up, and don't discard those ranks.",
    ],
  },
  { // 2 · Set & Run · deal 10
    goal: "One set of three matching ranks, plus a run of four cards in a row in one suit.",
    inContract: 7,
    after: "No more new melds this round. Runs on the table are easy homes for spare cards, so lay off at either end and discard until out.",
    tips: [
      "A run is one suit, in order, like 8♥ 9♥ 10♥ J♥.",
      "Keep cards that touch, like 8♥ 9♥, rather than lone cards.",
      "Three in a row isn't a run yet. A run needs four.",
    ],
    pro: [
      "Middle cards (5 to 9) can grow a run at either end. Aces and kings only grow one way.",
      "Once down, every run on the table is a place to shed cards.",
    ],
  },
  { // 3 · Two Runs · deal 10
    goal: "Two separate runs of four or more, each in a single suit.",
    inContract: 8,
    after: "A third run can't go down, even if it's in hand. Lay off on the table and discard until out.",
    tips: [
      "Pick two suits early and commit to them.",
      "Both runs can be the same suit if they're separate, like 3–6♠ and 9–Q♠.",
      "One long run of eight is still one run. The goal needs two.",
    ],
    pro: [
      "Save wild cards to fill gaps in the middle of a run.",
      "Discard from suits already given up on. It hides the plan.",
    ],
  },
  { // 4 · Three Sets · deal 12
    goal: "Three sets of three matching ranks. From this round on, everyone gets 12 cards.",
    inContract: 9,
    after: "Usually just a few cards are left. Lay off on any set on the table and discard each turn to finish fast.",
    tips: [
      "Aim for three pairs. Keep pairs, let single cards go.",
      "Buying is strong here. One “May I?” can finish a set.",
    ],
    pro: [
      "Going down with exactly nine leaves about three cards, so going out comes quickly.",
      "Late in the round, dump 10s and face cards. They cost 10 each in a caught hand.",
    ],
  },
  { // 5 · Two Sets & a Run · deal 12
    goal: "Two sets of three matching ranks, plus a run of four in one suit.",
    inContract: 10,
    after: "No more new melds. Lay off on any set or run on the table, discard each turn, and race to an empty hand.",
    tips: [
      "Build the run first. It's harder, and sets often arrive on their own.",
      "Keep one spare pair in case a set falls through.",
      "The run must be one suit. A mixed-suit sequence doesn't count.",
    ],
    pro: [
      "Buy for the run, not the sets. Run cards are harder to find later.",
      "Ten of the 12 cards must fit the goal, so commit early.",
    ],
  },
  { // 6 · Set & Two Runs · deal 12
    goal: "One set of three matching ranks, plus two separate runs of four in a row.",
    inContract: 11,
    after: "Very little is left once down. Lay off what fits and discard until out.",
    tips: [
      "Runs are the hard part. Settle on two suits by the third turn.",
      "Wild cards are worth the most this round, but they can't outnumber natural cards in a meld.",
    ],
    pro: [
      "Eleven of the 12 cards must fit, so there's little room to wait.",
      "Far off? Stop chasing and shed high cards to limit the damage.",
    ],
  },
  { // 7 · Three Runs · deal 12 · go out
    goal: "Three runs of four, using every card in hand. There's no final discard, so going down and going out happen in one move.",
    inContract: 12,
    after: "There is no after. In round 7, going down means going out: all three runs and every card in hand go down at once, with no discard.",
    tips: [
      "Every card has to fit. Plan the whole hand, including the card drawn, not just the runs.",
      "Each “May I?” adds two cards that also need a place, so buy carefully.",
      "Runs can be longer than four. That's where extra cards go.",
    ],
    pro: [
      "If it won't come together, shed high cards early to limit the damage.",
      "Everyone is chasing runs, so middle cards vanish from the discard pile fast.",
    ],
  },
];

const TURN_STEPS = [
  { t: "Draw", d: "Take the top card of the stock or the discard pile." },
  { t: "Go down (once, when ready)", d: "Holding the round's goal? Lay it down: once a round, and only the goal. A set of four or a run of six still counts. Waiting is allowed, but if someone goes out first, the whole hand counts against its holder." },
  { t: "Lay off (only after going down)", d: "Add cards to any meld on the table (a meld is a set or run someone has laid down), a player's own or anyone else's. Once down, this is the only way to play cards." },
  { t: "Discard", d: "Each turn ends with one card face up on the discard pile. If it was the last card, that player is out. In round 7 there's no final discard: going out means laying down every card." },
];

const MAYI_STEPS = [
  { t: "A card is discarded", d: "Someone else's turn, but that card is wanted." },
  { t: "Ask “May I?”", d: "Speak up before the next player draws. Once they pick up, the chance is gone." },
  { t: "Next player chooses", d: "The player whose turn is next gets first refusal. If they take it as their draw, the asker doesn't get it." },
  { t: "Two cards come in", d: "Otherwise the asker takes the discard, plus one face-down penalty card from the stock. Their hand grows by two." },
  { t: "Two people ask at once", d: "The next player still gets first refusal. If they pass, the card usually goes to whoever sits closest to them in turn order." },
  { t: "Buy limit", d: "This table allows {limit} per player, per round. The count resets each round." },
];

const RULE_WHY = {
  buyLimit: "The classic rule is 3 buys per round. It keeps the game moving without letting one player take over. Unlimited suits a more relaxed, social game.",
  jokersWild: "Some families take the jokers out to keep scoring simple and cut down on luck. With jokers in, almost any hand can be rescued.",
  twosWild: "Making 2s wild came from families who found runs hard to build. They score 15 in hand, the same as a joker, so holding one is risky.",
  acesPosition: "Aces low is the original rule. High and both ends came from families who wanted more ways to build runs. J–Q–K–A feels good to lay down. Where an ace sits never changes what it scores.",
  aceValue: "Most families score an ace at 15, the same as a joker, so holding one late is a real risk. Continental tables use 20. Scoring it at 1 makes aces cheap to keep.",
  jokerValue: "15 is the classic May I? value. Continental and Shanghai tables charge 50, which makes getting caught with a joker a disaster.",
};

function ruleHint(key, rules) {
  if (key === "buyLimit") {
    const n = buyLimitOf(rules);
    if (n === Infinity) return "Players can say “May I?” as many times as they like each round.";
    return "Each player can buy up to " + n + " time" + (n === 1 ? "" : "s") + " per round. Resets each round.";
  }
  if (key === "jokersWild") return rules.jokersWild
    ? "Jokers stand in for any card. Worth " + wildPoints(rules) + " points in hand."
    : "No jokers. Take them out of the deck before dealing.";
  if (key === "twosWild") return rules.twosWild
    ? "2s are wild too. Worth " + wildPoints(rules) + " points in hand, the same as a joker."
    : "2s are ordinary cards. Only jokers are wild.";
  if (key === "acesPosition") return rules.acesPosition === "high"
    ? "Aces only end a run (J–Q–K–A)."
    : rules.acesPosition === "both"
      ? "Aces can start or end a run, but a run can't wrap round (K–A–2)."
      : "Aces only start a run (A–2–3–4).";
  if (key === "aceValue") return "Every ace left in a hand costs " + acePoints(rules) + (acePoints(rules) === 1 ? " point." : " points.");
  if (key === "jokerValue") return "Every joker" + (rules.twosWild ? " and wild 2" : "") + " left in a hand costs " + wildPoints(rules) + " points.";
  return "";
}
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SUIT = { S:["♠",0], H:["♥",1], D:["♦",1], C:["♣",0] };
const DEFAULT_RULES = { buyLimit: "3", customBuyLimit: 3, jokersWild: true, acesPosition: "low", twosWild: false, aceValue: 15, jokerValue: 15 };
// Card points are their own house rule. Games from before aceValue existed keep the old
// scoring (aces 1, or 15 when played high) so finished games never change.
const acePoints = r => r.aceValue != null ? r.aceValue : r.acesPosition === "high" ? 15 : 1;
const wildPoints = r => r.jokerValue || 15;
// Hand cards are ranks ("7", "K", "JOKER"); photo scans may add a suit ("7S", "KH").
const rankPart = c => /^(10|[2-9AJQK])[SHDC]$/.test(c) ? c.slice(0, -1) : c;
function cardValue(raw, r) {
  const c = rankPart(raw);
  if (c === "JOKER") return wildPoints(r); if (c === "A1") return 1; if (c === "A15") return 15;
  if (c === "A") return acePoints(r);
  if (c === "2" && r.twosWild) return wildPoints(r);
  if (c === "J" || c === "Q" || c === "K") return 10;
  return parseInt(c, 10) || 0;
}
const buyLimitOf = r => r.buyLimit === "unlimited" ? Infinity : r.buyLimit === "custom" ? Math.max(1, r.customBuyLimit || 1) : 3;
const rulesLine = r => [(r.buyLimit === "unlimited" ? "Unlimited" : buyLimitOf(r)) + " buys", r.jokersWild ? "jokers wild" : "no jokers", r.twosWild ? "2s wild" : null, r.acesPosition === "low" ? "aces low" : r.acesPosition === "high" ? "aces high" : "aces either",
  r.aceValue != null && r.aceValue !== 15 ? "aces " + r.aceValue + " pts" : null, r.jokerValue && r.jokerValue !== 15 ? "jokers " + r.jokerValue + " pts" : null].filter(Boolean).join(" · ");

// ── Game maths ────────────────────────────────────────────────────
const roundDone = (g, i) => !!g.scores[i] && g.players.every(id => typeof g.scores[i][id] === "number");
const totalsOf = g => g.players.map(id => ({ id, total: Object.values(g.scores).reduce((s, r) => s + (r && typeof r[id] === "number" ? r[id] : 0), 0) }));
const rankOf = g => totalsOf(g).sort((a, b) => a.total - b.total);
const dealerIdx = (g, r) => (g.dealer + r) % Math.max(g.players.length, 1);
// Joining and leaving mid-game. Whoever is dealing now keeps the deal either way.
const keepDealer = (players, who, round) => { const n = players.length, at = Math.max(0, players.indexOf(who)); return ((at - round) % n + n) % n; };
// A late player takes the highest score of every finished round (or 0 if the table prefers),
// so joining late never helps, and finished rounds stay finished.
function addToGame(g, pid, info, start) {
  const dealing = g.players[dealerIdx(g, g.round)], players = [...g.players, pid], scores = { ...g.scores };
  ROUNDS.forEach((_, i) => { if (!roundDone(g, i)) return; const row = g.scores[i];
    scores[i] = { ...row, [pid]: start === "zero" ? 0 : Math.max(...g.players.map(id => row[id])) }; });
  return { ...g, players, scores, names: { ...(g.names || {}), [pid]: info }, joined: { ...(g.joined || {}), [pid]: g.round }, dealer: keepDealer(players, dealing, g.round) };
}
// Joining mid-game (or coming back from sitting out): every finished round they missed gets a score, so their
// total lands on the starting score. The default is the highest total at the table, so arriving late never helps.
const highestTotal = g => Math.max(0, ...totalsOf(g).map(t => t.total));
function joinGame(g, pid, info, target) {
  if (g.players.includes(pid)) return g;
  const dealing = g.players[dealerIdx(g, g.round)], players = [...g.players, pid], scores = { ...g.scores };
  const missing = ROUNDS.map((_, i) => i).filter(i => roundDone(g, i) && typeof (g.scores[i] || {})[pid] !== "number");
  const have = ROUNDS.reduce((s, _, i) => s + (typeof (g.scores[i] || {})[pid] === "number" ? g.scores[i][pid] : 0), 0);
  let need = Math.max(0, (target == null ? highestTotal(g) : target) - have);
  missing.forEach((i, k) => { const left = missing.length - k, v = Math.max(1, k === missing.length - 1 ? need : Math.round(need / left));
    need = Math.max(0, need - v); scores[i] = { ...scores[i], [pid]: Math.min(999, v) }; });
  const left = { ...(g.left || {}) }; delete left[pid];
  return { ...g, players, scores, left, names: { ...(g.names || {}), [pid]: info }, joined: { ...(g.joined || {}), [pid]: g.round }, dealer: keepDealer(players, dealing, g.round) };
}
const sameName = (list, n, skip) => !!n.trim() && list.some(p => p.id !== skip && p.name.trim().toLowerCase() === n.trim().toLowerCase());
const sittingOut = g => Object.keys(g.left || {}).filter(id => !g.players.includes(id) && !(g.gone || {})[id]);
const removeFromGame = (g, pid) => ({ ...g, gone: { ...(g.gone || {}), [pid]: true } });
function moveSeat(g, from, to) {
  if (to < 0 || to >= g.players.length || from === to) return g;
  const dealing = g.players[dealerIdx(g, g.round)], players = [...g.players]; players.splice(to, 0, players.splice(from, 1)[0]);
  return { ...g, players, dealer: keepDealer(players, dealing, g.round) };
}
const setDealer = (g, pid) => ({ ...g, dealer: keepDealer(g.players, pid, g.round) });
// Leaving keeps the player's name for the results. Nobody can leave a two-player game.
function dropFromGame(g, pid) {
  const i = g.players.indexOf(pid); if (i < 0 || g.players.length <= 2) return g;
  const dealing = g.players[dealerIdx(g, g.round)], next = dealing === pid ? g.players[(i + 1) % g.players.length] : dealing;
  const players = g.players.filter(id => id !== pid);
  return { ...g, players, left: { ...(g.left || {}), [pid]: g.round }, dealer: keepDealer(players, next, g.round) };
}

// ── May I? stats ──────────────────────────────────────────────────
// Pure functions over the v6 data model. Classic script: everything is
// top-level so the app can load it with a plain <script>. Private helpers
// are prefixed `st` so they never collide with the app's own globals
// (cardValue, ROUNDS, roundDone, totalsOf, rankOf, DEFAULT_RULES).
// Round indexes are 0-based throughout (round 0 = "Two Sets").

const ST_ROUND_COUNT = 7;
const ST_DEFAULT_RULES = { buyLimit: "3", customBuyLimit: 3, jokersWild: true, acesPosition: "low", twosWild: false };
const ST_CATS = [
  { key: "wild", label: "Jokers & wilds" },
  { key: "ace", label: "Aces" },
  { key: "face", label: "Faces (J/Q/K)" },
  { key: "high", label: "High (8–10)" },
  { key: "low", label: "Low (2–7)" },
];

function stFallbackCardValue(c, r) {
  if (c === "JOKER") return 15; if (c === "A1") return 1; if (c === "A15") return 15;
  if (c === "A") return r.acesPosition === "high" ? 15 : 1;
  if (c === "2" && r.twosWild) return 15;
  if (c === "J" || c === "Q" || c === "K") return 10;
  return parseInt(c, 10) || 0;
}
function stValue(token, rules) {
  const fn = typeof cardValue === "function" ? cardValue : stFallbackCardValue;
  return fn(token, rules);
}
function stRules(g) { return Object.assign({}, ST_DEFAULT_RULES, (g && g.rules) || {}); }

// "7S" → "7", "AH" → "A", "10D" → "10", "JOKER" stays. Only strips when what's left is a real rank.
function stNorm(token) {
  const t = String(token || "").toUpperCase();
  if (t.length > 1 && /[SHDC]$/.test(t)) {
    const base = t.slice(0, -1);
    if (/^(A|A1|A15|[2-9]|10|J|Q|K)$/.test(base)) return base;
  }
  return t;
}
const stRank = t => (t === "A1" || t === "A15" ? "A" : t);   // aces collapse to one rank for counting
function stCategory(t, rules) {
  if (t === "JOKER" || (t === "2" && rules.twosWild)) return "wild";
  if (t === "A" || t === "A1" || t === "A15") return "ace";
  if (t === "J" || t === "Q" || t === "K") return "face";
  const n = parseInt(t, 10);
  if (n >= 8 && n <= 10) return "high";
  if (n >= 2 && n <= 7) return "low";
  return null;
}

const stIsDone = (g, i) => !!(g.scores && g.scores[i]) && g.players.length > 0 && g.players.every(id => typeof g.scores[i][id] === "number");
const stDoneRounds = g => { const a = []; for (let i = 0; i < ST_ROUND_COUNT; i++) if (stIsDone(g, i)) a.push(i); return a; };
// Totals over the given rounds (default: every stored score, like the app's totalsOf).
function stTotals(g, rounds) {
  const idx = rounds || Object.keys(g.scores || {});
  const out = {};
  g.players.forEach(id => {
    out[id] = idx.reduce((s, i) => { const r = g.scores[i]; return s + (r && typeof r[id] === "number" ? r[id] : 0); }, 0);
  });
  return out;
}
// Competition ranking: 1 + number of players strictly lower.
function stPositions(totals) {
  const ids = Object.keys(totals), pos = {};
  ids.forEach(id => { pos[id] = 1 + ids.filter(o => totals[o] < totals[id]).length; });
  return pos;
}
const stBuysOf = (g, id) => Object.values(g.buys || {}).reduce((s, r) => s + ((r && r[id]) || 0), 0);
const stPlural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
// Single strict leader on a positive number; null on ties or when nobody scores.
function stTopOne(rows, val) {
  const a = rows.filter(x => val(x) > 0).sort((x, y) => val(y) - val(x));
  return a.length && (a.length < 2 || val(a[0]) > val(a[1])) ? a[0] : null;
}

function stPerPlayer(g) {
  const done = stDoneRounds(g);
  return g.players.map(id => {
    const rs = done.map(i => ({ i, v: g.scores[i][id] }));
    let worst = null, best = null, cb = null;
    rs.forEach((x, k) => {
      if (!worst || x.v > worst.v) worst = x;
      if (!best || x.v < best.v) best = x;
      if (k > 0) { const d = rs[k - 1].v - x.v; if (!cb || d > cb.d) cb = { d, from: rs[k - 1].v, to: x.v, i: x.i }; }
    });
    const avg = rs.length ? rs.reduce((s, x) => s + x.v, 0) / rs.length : 0;
    return { id, rs, outs: rs.filter(x => x.v === 0).length, buyN: stBuysOf(g, id), worst, best, cb, avg, spread: rs.length ? worst.v - best.v : 0 };
  });
}

// ── 1. Awards ─────────────────────────────────────────────────────
// Every game award: title, art in art/icons, rarity (higher shows first in the finale) and the rule in a line.
const AWARDS = {
  flawless: { t: "Flawless", r: 100, how: "Went out in all seven rounds" },
  hattrick: { t: "Hat trick", r: 70, how: "Went out three rounds in a row" },
  heist: { t: "Last-round heist", r: 60, how: "Behind before the last round, and won anyway" },
  upfrombottom: { t: "Up from the bottom", r: 52, how: "Was last at some point, and still won" },
  wiretowire: { t: "Wire to wire", r: 50, how: "Led after every round and won" },
  photofinish: { t: "Photo finish", r: 45, how: "Won by 5 points or fewer" },
  runmaker: { t: "Run maker", r: 40, how: "Went out in Two Runs and in Three Runs" },
  setcollector: { t: "Set collector", r: 40, how: "Went out in Two Sets and in Three Sets" },
  selfmade: { t: "Self-made", r: 35, how: "Won without a single May I?" },
  hotheels: { t: "Hot on their heels", r: 30, how: "Came second, within 10 points of the winner" },
  aceupsleeve: { t: "Ace up the sleeve", r: 25, how: "Caught holding the most Aces" },
  goodsport: { t: "Good sport", r: 25, how: "Finished last, but still went out" },
  joker: { t: "Joker juggler", r: 22, how: "Caught holding the most Jokers" },
  steady: { t: "Steady hand", r: 20, how: "Every round within 20 points" },
  friends: { t: "Friends in high places", r: 20, how: "Caught holding the most Jacks, Queens and Kings" },
  comeback: { t: "Comeback kid", r: 15, how: "Biggest jump up the table in one round" },
  curtaincall: { t: "Curtain call", r: 14, how: "Went out in Three Runs, the last round" },
  rollercoaster: { t: "Rollercoaster", r: 12, how: "Biggest gap between their best and worst round" },
  dealerschoice: { t: "Dealer’s choice", r: 12, how: "Went out in a round they dealt" },
  heavy: { t: "Heavy pockets", r: 10, how: "Caught with the biggest hand" },
  soclose: { t: "So close", r: 10, how: "Smallest hand caught that wasn’t zero" },
  clean: { t: "Clean hands", r: 8, how: "Went out the most times" },
  bargain: { t: "Bargain hunter", r: 8, how: "Said May I? the most" },
  quickoff: { t: "Quick off the mark", r: 5, how: "First to go out in the game" },
};
Object.keys(AWARDS).forEach(k => { AWARDS[k].art = k === "clean" ? "out" : k === "bargain" ? "mayi" : k; });
function gameAwards(game) {
  const per = stPerPlayer(game), awards = [];

  const o = stTopOne(per, x => x.outs);
  if (o) awards.push({ key: "clean", ic: "out", t: "Clean hands", id: o.id, d: "Went out " + stPlural(o.outs, "time") });

  const b = stTopOne(per, x => x.buyN);
  if (b) awards.push({ key: "bargain", ic: "mayi", t: "Bargain hunter", id: b.id, d: "Said “May I?” " + stPlural(b.buyN, "time") });

  const c = stTopOne(per.filter(x => x.cb && x.cb.d >= 10), x => x.cb.d);
  if (c) awards.push({ key: "comeback", ic: "bolt", t: "Comeback kid", id: c.id, d: "From " + c.cb.from + " to " + c.cb.to + " in round " + (c.cb.i + 1) });

  const eligible = per.filter(x => x.rs.length >= 3);
  if (eligible.length > 1) {
    const s = [...eligible].sort((x, y) => x.spread - y.spread);
    if (s[0].spread <= 20 && s[0].spread < s[1].spread)
      awards.push({ key: "steady", ic: "chart", t: "Steady hand", id: s[0].id, d: "Every round within " + s[0].spread + " points" });
  }

  const h = stTopOne(per.filter(x => x.worst), x => x.worst.v);
  if (h) awards.push({ key: "heavy", ic: "calc", t: "Heavy pockets", id: h.id, d: "Caught with " + h.worst.v + " in round " + (h.worst.i + 1) });

  const jokers = game.players.map(id => ({ id, n: 0 }));
  Object.values(game.hands || {}).forEach(r => jokers.forEach(j => {
    ((r && r[j.id]) || []).forEach(t => { if (stNorm(t) === "JOKER") j.n++; });
  }));
  const j = stTopOne(jokers, x => x.n);
  if (j) awards.push({ key: "joker", ic: "flag", t: "Joker juggler", id: j.id, d: "Caught with " + stPlural(j.n, "joker") + ", worth " + j.n * 15 });

  // The rest. A threshold award can go to more than one player; a "most" award needs a single leader.
  const done = stDoneRounds(game), full = done.length === ST_ROUND_COUNT, P = game.players.length;
  const add = (key, id, d) => awards.push({ key, ic: "star", t: AWARDS[key].t, id, d });
  const sc = (i, id) => game.scores[i] && game.scores[i][id];
  const times = n => ["no times", "once", "twice"][n] || n + " times";
  per.forEach(x => {
    const outAt = done.filter(i => sc(i, x.id) === 0);
    if (full && outAt.length === ST_ROUND_COUNT) add("flawless", x.id, "Went out in all seven rounds");
    else {
      let run = [], longest = [];
      done.forEach(i => {
        if (sc(i, x.id) !== 0) { run = []; return; }
        run = run.length && run[run.length - 1] === i - 1 ? [...run, i] : [i];
        if (run.length > longest.length) longest = run;
      });
      const n = longest.length, r1 = longest[0] + 1;
      if (n === 3) add("hattrick", x.id, "Went out in rounds " + r1 + ", " + (r1 + 1) + " and " + (r1 + 2));
      else if (n > 3) add("hattrick", x.id, "Went out " + n + " rounds in a row, " + r1 + " to " + (r1 + n - 1));
    }
    if (outAt.includes(2) && outAt.includes(6)) add("runmaker", x.id, "Went out in Two Runs and in Three Runs");
    if (outAt.includes(0) && outAt.includes(3)) add("setcollector", x.id, "Went out in Two Sets and in Three Sets");
    if (outAt.includes(6)) add("curtaincall", x.id, "Went out in Three Runs, the last round");
    x.dealt = typeof game.dealer === "number" ? outAt.filter(i => game.players[dealerIdx(game, i)] === x.id) : [];
  });
  const dc = stTopOne(per, x => x.dealt.length);
  if (dc) add("dealerschoice", dc.id, dc.dealt.length === 1 ? "Went out on their own deal in round " + (dc.dealt[0] + 1) : "Went out on their own deal " + times(dc.dealt.length));

  const firstOut = done.find(i => game.players.some(id => sc(i, id) === 0));
  if (firstOut != null) {
    const who = game.players.filter(id => sc(firstOut, id) === 0);
    if (who.length === 1) add("quickoff", who[0], "First to go out, in round " + (firstOut + 1));
  }

  const caughtHands = [];
  done.forEach(i => game.players.forEach(id => { const v = sc(i, id); if (v > 0) caughtHands.push({ id, v, i }); }));
  caughtHands.sort((p, q) => p.v - q.v);
  if (caughtHands.length > 1 && caughtHands.filter(x => x.v === caughtHands[0].v).every(x => x.id === caughtHands[0].id))
    add("soclose", caughtHands[0].id, "Caught with just " + caughtHands[0].v + " in round " + (caughtHands[0].i + 1));

  const rc = stTopOne(per.filter(x => x.rs.length >= 3 && x.spread >= 40), x => x.spread);
  if (rc) add("rollercoaster", rc.id, rc.best.v === 0 ? "From going out to " + rc.worst.v + " in one game" : "Rounds from " + rc.best.v + " all the way to " + rc.worst.v);

  const held = game.players.map(id => ({ id, face: 0, ace: 0 }));
  Object.values(game.hands || {}).forEach(r => held.forEach(x => ((r && r[x.id]) || []).forEach(t => {
    const k = stRank(stNorm(t)); if (k === "A") x.ace++; else if (k === "J" || k === "Q" || k === "K") x.face++;
  })));
  const fc = stTopOne(held.filter(x => x.face >= 2), x => x.face);
  if (fc) add("friends", fc.id, "Caught with " + fc.face + " Jacks, Queens and Kings");
  const ac = stTopOne(held.filter(x => x.ace >= 2), x => x.ace);
  if (ac) add("aceupsleeve", ac.id, "Caught holding " + ac.ace + " Aces");

  const tot = stTotals(game), order = [...game.players].sort((p, q) => tot[p] - tot[q]);
  const win = P > 1 && tot[order[0]] < tot[order[1]] ? order[0] : null;
  if (win) {
    const gap = tot[order[1]] - tot[win];
    if (gap <= 5) add("photofinish", win, gap === 1 ? "Won by a single point" : "Won by just " + gap + " points");
    const after = done.map((_, k) => stTotals(game, done.slice(0, k + 1)));
    if (done.length >= 3 && after.every(t => game.players.every(id => id === win || t[id] > t[win]))) add("wiretowire", win, "Led after every round, start to finish");
    if (done.length >= 2) {
      const before = after[after.length - 2], low = Math.min(...game.players.filter(id => id !== win).map(id => before[id]));
      if (low < before[win]) add("heist", win, stPlural(before[win] - low, "point") + " behind going into the last round, and won");
    }
    if (P >= 3) {
      const k = after.slice(0, -1).findIndex(t => game.players.every(id => id === win || t[id] < t[win]));
      if (k >= 0) add("upfrombottom", win, "Last after round " + (done[k] + 1) + ", and still won");
    }
    if (game.players.some(id => stBuysOf(game, id) > 0) && stBuysOf(game, win) === 0) add("selfmade", win, "Won without a single May I?");
    const second = order[1], g2 = tot[second] - tot[win];
    if ((P === 2 || tot[order[2]] > tot[second]) && g2 <= 10) add("hotheels", second, "Second, just " + stPlural(g2, "point") + " behind");
  }
  if (P >= 3) {
    const lastId = order[P - 1], lastP = per.find(x => x.id === lastId);
    if (tot[lastId] > tot[order[P - 2]] && lastP && lastP.outs >= 1) add("goodsport", lastId, "Last, but still went out " + times(lastP.outs));
  }

  return awards;
}

// Moments belong to the whole table, not one player. nameOf: id → name.
function tableMoments(game, nameOf) {
  const tot = stTotals(game), ids = [...game.players].sort((p, q) => tot[p] - tot[q]), out = [];
  const and = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const top = ids.filter(id => tot[id] === tot[ids[0]]);
  if (ids.length > 1 && top.length > 1) out.push({ key: "sharedcrown", t: "Shared crown", d: and(top.map(nameOf)) + " share the win on " + tot[ids[0]] });
  const same = {};
  ids.forEach(id => { if (tot[id] !== tot[ids[0]]) (same[tot[id]] = same[tot[id]] || []).push(id); });
  const pair = Object.entries(same).find(([, a]) => a.length > 1);
  if (pair) out.push({ key: "twins", t: "Twins", d: and(pair[1].map(nameOf)) + (pair[1].length === 2 ? " both" : " all") + " finished on " + pair[0] });
  const gap3 = ids.length >= 3 ? tot[ids[2]] - tot[ids[0]] : 99;
  if (stDoneRounds(game).length === ST_ROUND_COUNT && gap3 <= 10 && top.length < 3)
    out.push({ key: "nailbiter", t: "Nail-biter", d: "The top three finished within " + stPlural(gap3, "point") + " of each other" });
  const mins = game.startedAt && game.endedAt ? Math.round((game.endedAt - game.startedAt) / 60000) : 0;
  if (mins > 120 && mins < 720)
    out.push({ key: "marathon", t: "Marathon", d: stPlural(Math.floor(mins / 60), "hour") + (mins % 60 ? " " + stPlural(mins % 60, "minute") : "") + " from the first deal to the last score" });
  if (ids.length >= 6) out.push({ key: "packedtable", t: "Packed table", d: ids.length + " players around one table" });
  return out;
}

// ── 2. Still in it ────────────────────────────────────────────────
// nameOf (optional): function id→name, a {id: name} map, or an array of {id, name}.
function stNamer(nameOf) {
  if (typeof nameOf === "function") return nameOf;
  if (Array.isArray(nameOf)) return id => { const p = nameOf.find(x => x.id === id); return p ? p.name : "the leader"; };
  if (nameOf && typeof nameOf === "object") return id => nameOf[id] || "the leader";
  return () => "the leader";
}
function chaseNotes(game, nameOf) {
  if (game.status && game.status !== "live") return [];
  const done = stDoneRounds(game), left = ST_ROUND_COUNT - done.length;
  if (!done.length || !left || game.players.length < 2) return [];
  const name = stNamer(nameOf);
  const totals = stTotals(game, done);
  const ranked = game.players.map(id => ({ id, total: totals[id] })).sort((a, b) => a.total - b.total);
  const per = stPerPlayer(game), leader = ranked[0], L = per.find(x => x.id === leader.id);
  const lw = L.worst ? L.worst.v : 0, la = L.avg, ln = name(leader.id);
  const rounds = stPlural(left, "round");

  return ranked.slice(1).filter(p => p.total > leader.total).map(p => {
    const gap = p.total - leader.total, pr = Math.ceil(gap / left);
    const me = per.find(x => x.id === p.id);
    let text;
    if (pr <= 12 || gap <= la * left * 0.6)
      text = left === 1 ? (gap <= 15 ? "Only " + gap : gap) + " behind with one round left. A round " + gap + " better than " + ln + "'s takes it."
        : (gap <= 15 ? "Only " + gap : gap) + " behind with " + rounds + " left. Beating " + ln + " by about " + pr + " a round takes the lead.";
    else if (lw >= gap / 2)
      text = left === 1 ? gap + " behind with one round left. " + ln + " would need a " + gap + "-point round, and has had a " + lw + " before." : gap + " behind with " + rounds + " left, so about " + pr + " a round. " + ln + " has had a " + lw + "-point round before. One big swing changes everything.";
    else
      text = (left === 1 ? gap + " behind with one round left. Only a miracle round closes that." : gap + " behind with " + rounds + " left, about " + pr + " a round. Going down early and dumping high cards chips away.") +
        (lw > 0 ? " " + ln + "'s worst round so far was " + lw + "." : "");
    if (me && me.outs > 0 && p.id === ranked[ranked.length - 1].id) text += " " + name(p.id) + " has gone out before.";
    return { id: p.id, text };
  });
}

// ── 3. What got people caught ─────────────────────────────────────
function caughtStats(game) {
  const rules = stRules(game), done = stDoneRounds(game);
  const pts = {}, ranks = {};
  ST_CATS.forEach(c => { pts[c.key] = 0; });
  Object.values(game.hands || {}).forEach(r => game.players.forEach(pid => {
    ((r && r[pid]) || []).forEach(raw => {
      const t = stNorm(raw), cat = stCategory(t, rules), v = stValue(t, rules);
      if (!cat) return;
      pts[cat] += v;
      const rk = stRank(t);
      ranks[rk] = ranks[rk] || { token: rk, pts: 0, count: 0 };
      ranks[rk].count++; ranks[rk].pts += v;
    });
  }));
  const total = Object.values(pts).reduce((s, v) => s + v, 0);
  const cats = total > 0
    ? ST_CATS.filter(c => pts[c.key] > 0).map(c => ({ key: c.key, label: c.label, pts: pts[c.key], pct: Math.round(pts[c.key] / total * 100) }))
        .sort((a, b) => b.pts - a.pts)
    : [];

  const top = Object.values(ranks).sort((a, b) => b.count - a.count || b.pts - a.pts)[0];
  const topCard = top && top.count > 1 ? { token: top.token, pts: top.pts, count: top.count } : null;

  let toughest = null;
  if (done.length > 1) done.forEach(i => {
    const t = game.players.reduce((s, id) => s + game.scores[i][id], 0);
    if (!toughest || t > toughest.total) toughest = { round: i, total: t };
  });

  let buyWarning = null;
  const per = stPerPlayer(game), heavy = per.filter(x => x.buyN >= 3);
  if (heavy.length && done.length) {
    const avgAll = per.reduce((s, x) => s + x.avg, 0) / per.length;
    const avgBuy = heavy.reduce((s, x) => s + x.avg, 0) / heavy.length;
    if (avgBuy > avgAll + 3)
      buyWarning = "Heavy buying is backfiring. Big buyers are averaging " + Math.round(avgBuy) + " a round against a table average of " +
        Math.round(avgAll) + ". Each buy adds a penalty card.";
  }
  return { cats, topCard, toughest, buyWarning };
}

// ── Group history helpers ─────────────────────────────────────────
function stGroupGames(state, groupId) {
  return Object.values((state && state.games) || {})
    .filter(g => g.groupId === groupId && g.status === "done")
    .sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));
}
function stWinners(g) {
  const t = stTotals(g), best = Math.min(...g.players.map(id => t[id]));
  return { totals: t, best, ids: g.players.filter(id => t[id] === best) };
}
function stStreaks(games, pid) {
  let cur = 0, best = 0, bestAt = null;
  games.filter(g => g.players.includes(pid)).forEach(g => {
    if (stWinners(g).ids.includes(pid)) { cur++; if (cur > best) { best = cur; bestAt = g.endedAt || 0; } } else cur = 0;
  });
  return { current: cur, best, bestAt };
}

// ── 4. Player profile ─────────────────────────────────────────────
function playerProfile(state, groupId, playerId) {
  const games = stGroupGames(state, groupId).filter(g => g.players.includes(playerId));
  let wins = 0, sum = 0, outs = 0, buys = 0, roundsWon = 0, bestGame = null, bestRound = null;
  const badges = {}, badgeLast = {}, h2h = {};
  games.forEach(g => {
    const w = stWinners(g), mine = w.totals[playerId];
    if (w.ids.includes(playerId)) wins++;
    sum += mine;
    if (!bestGame || mine < bestGame.total) bestGame = { total: mine, gameId: g.id };
    buys += stBuysOf(g, playerId);
    stDoneRounds(g).forEach(i => {
      const r = g.scores[i], v = r[playerId];
      if (v === 0) outs++;
      if (v === Math.min(...g.players.map(id => r[id]))) roundsWon++;
      if (!bestRound || v < bestRound.v) bestRound = { v, gameId: g.id, round: i };
    });
    gameAwards(g).forEach(a => { if (a.id === playerId) { badges[a.key] = (badges[a.key] || 0) + 1; badgeLast[a.key] = g.endedAt || 0; } });
    g.players.forEach(o => {
      if (o === playerId) return;
      const h = h2h[o] = h2h[o] || { id: o, played: 0, wins: 0, losses: 0 };
      h.played++;
      if (mine < w.totals[o]) h.wins++; else if (mine > w.totals[o]) h.losses++;
    });
  });
  const s = stStreaks(games, playerId);
  return {
    games: games.length, wins, winRate: games.length ? wins / games.length : 0,
    avg: games.length ? sum / games.length : 0,
    bestGame, bestRound, outs, buys,
    streak: { current: s.current, best: s.best },
    badges, badgeLast, roundsWon,
    h2h: Object.values(h2h).sort((a, b) => b.played - a.played),
  };
}

// ── 5. Group records ──────────────────────────────────────────────
// Ties go to whoever set the record first (chronologically); for most games, group order.
function groupRecords(state, groupId) {
  const games = stGroupGames(state, groupId);
  const group = state && state.groups && state.groups[groupId];
  const members = [];
  (group ? group.players.map(p => p.id) : []).concat(...games.map(g => g.players)).forEach(id => { if (!members.includes(id)) members.push(id); });

  let lowestWin = null, mostOuts = null, longestStreak = null, mostGames = null;
  games.forEach(g => {
    const w = stWinners(g);
    if (!lowestWin || w.best < lowestWin.v) lowestWin = { v: w.best, id: w.ids[0], ids: w.ids, gameId: g.id };
    const done = stDoneRounds(g);
    g.players.forEach(id => {
      const n = done.filter(i => g.scores[i][id] === 0).length;
      if (n > 0 && (!mostOuts || n > mostOuts.v)) mostOuts = { v: n, id, gameId: g.id };
    });
  });
  members.forEach(id => {
    const s = stStreaks(games, id);
    if (s.best > 0 && (!longestStreak || s.best > longestStreak.v || (s.best === longestStreak.v && s.bestAt < longestStreak.at)))
      longestStreak = { v: s.best, id, at: s.bestAt };
    const n = games.filter(g => g.players.includes(id)).length;
    if (n > 0 && (!mostGames || n > mostGames.v)) mostGames = { v: n, id };
  });
  if (longestStreak) longestStreak = { v: longestStreak.v, id: longestStreak.id };
  return { lowestWin, mostOuts, longestStreak, mostGames };
}

// ── 6. Rank moves ─────────────────────────────────────────────────
function rankMoves(game) {
  const done = stDoneRounds(game);
  if (done.length < 2) return {};
  const now = stPositions(stTotals(game, done)), before = stPositions(stTotals(game, done.slice(0, -1)));
  const out = {};
  game.players.forEach(id => { out[id] = before[id] - now[id]; });
  return out;
}

// ── Icons (one stroke family) ─────────────────────────────────────
const IC = {
  chart: '<path d="M5 20V12M12 20V5M19 20v-8"/>', gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14"/>',
  deal: '<rect x="4" y="6" width="10" height="14" rx="2"/><path d="M9 3h9a2 2 0 0 1 2 2v12"/>', draw: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  down: '<path d="M3 17h18M6 17V9h4v8M14 17V6h4v11"/>', layoff: '<path d="M4 12h12M12 6l6 6-6 6"/>', mayi: '<path d="M5 5h14v10H10l-5 4z"/><path d="M10.5 8.5a1.6 1.6 0 1 1 2 1.6c-.5.2-.5.6-.5 1M12 13h.01"/>',
  out: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  die: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
  hanger: '<path d="M9.8 5.2a2.2 2.2 0 1 1 3.3 1.9c-.7.4-1.1.9-1.1 1.6v.2M12 8.9l-8.4 6.3c-.9.7-.4 2.3.8 2.3h15.2c1.2 0 1.7-1.6.8-2.3L12 8.9z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
};
function Icon({ n, size, stroke }) {
  return ce("svg", { width: size || 22, height: size || 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke || 2,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, dangerouslySetInnerHTML: { __html: IC[n] } });
}

// ── Primitives ────────────────────────────────────────────────────
// Player pictures: one of the deck's own faces (the default), a photo, or initials.
// Faces: Kings, Queens, Jacks and Aces in every suit, then the Joker. Courts and the Joker are head-and-shoulders crops of the deck's art.
const AV_SUITN = { heart: "hearts", diamond: "diamonds", spade: "spades", club: "clubs" }, AV_RANKN = { k: "King", q: "Queen", j: "Jack", a: "Ace" };
const AV_CARDS = ["k", "q", "j", "a"].flatMap(r => ["heart", "diamond", "spade", "club"].map(su => ({ key: su + "-" + r, suit: su, rank: r, label: AV_RANKN[r] + " of " + AV_SUITN[su] })))
  .concat([{ key: "joker", label: "The Joker" }]);
const AV_FACES = AV_CARDS.filter(c => c.rank !== "a").map(c => c.key);   // what new players are dealt: the people on the cards
const cardOfAv = k => AV_CARDS.find(c => c.key === k) || null;
const cardAvSrc = c => c.key === "joker" ? "art/avatars/joker.webp" : c.rank === "a" ? "art/suits/" + c.suit + ".webp" : "art/avatars/" + c.key + ".webp";
const faceProps = k => { const c = cardOfAv(k) || cardOfAv("joker"); return c.key === "joker" ? { joker: true } : { rank: c.rank.toUpperCase(), suit: c.suit }; };
// A face dealt from the name, so it's the same every time, skipping faces others at the table already hold.
function avSeed(name, held) {
  let h = 7; for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const free = AV_FACES.filter(k => !(held || []).includes(k)), pool = free.length ? free : AV_FACES;
  return { type: "card", card: pool[(h >>> 4) % pool.length] };
}
// A picture worth keeping. Anything else (none, or a 3D character from before) is dealt a face.
const avKept = av => !!av && (av.type === "photo" && !!av.src || av.type === "initials" || av.type === "card" && !!cardOfAv(av.card));
const avOf = (av, name) => avKept(av) ? av : avSeed(name);
const heldFaces = players => players.map(p => p.avatar && p.avatar.type === "card" ? p.avatar.card : null).filter(Boolean);
// Each table's players without a picture are dealt one in seat order, so nobody at a table shares a face. Only the view changes.
function dealFaces(s) {
  if (!s || !s.groups) return s;
  let changed = false; const groups = {};
  for (const [id, g] of Object.entries(s.groups)) {
    const ps = g.players || [];
    if (ps.every(p => avKept(p.avatar))) { groups[id] = g; continue; }
    changed = true; const held = heldFaces(ps.filter(p => avKept(p.avatar)));
    groups[id] = { ...g, players: ps.map(p => { if (avKept(p.avatar)) return p; const av = avSeed(p.name, held); held.push(av.card); return { ...p, avatar: av }; }) };
  }
  return changed ? { ...s, groups } : s;
}
// A picture URL for the avatar, used by the share image.
const avatarSrc = av => av && av.type === "photo" ? av.src || null : av && av.type === "card" && cardOfAv(av.card) ? cardAvSrc(cardOfAv(av.card)) : null;
// Crowns for 1st, 2nd and 3rd: gold, silver and bronze, numbered like a game's prize.
const CROWN_INK = { 1: ["#FFCF33", "#FFF0A6", "#C98500", "#6B4300"], 2: ["#D3DCE6", "#F8FAFC", "#7F8C9B", "#36414D"], 3: ["#EE9A5E", "#FFD3B0", "#AD5A25", "#55260B"] };
function crownSVG(place) {
  const [f, hi, edge, ink] = CROWN_INK[place] || CROWN_INK[1], ball = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '" stroke="' + edge + '" stroke-width="2"/>';
  return '<svg viewBox="0 0 40 32" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5 11.5l7.5 6.5L20 6l7.5 12 7.5-6.5-3 15.6c-.3 1.6-1.4 2.4-3 2.4H11c-1.6 0-2.7-.8-3-2.4z" fill="' + f + '" stroke="' + edge + '" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M8.6 15.4l4.2 3.6L20 9.6l7.2 9.4 4.2-3.6-.7 3.9H9.3z" fill="' + hi + '" opacity=".7"/>' + ball(5, 10.6, 3.1) + ball(20, 5, 3.3) + ball(35, 10.6, 3.1) +
    '<text x="20" y="27.4" text-anchor="middle" font-family="\'Barlow Semi Condensed\', \'Barlow Condensed\', system-ui, sans-serif" font-weight="800" font-size="11" fill="' + ink + '">' + place + "</text></svg>";
}
function Peg({ color, name, size, ring, av }) {
  av = avOf(av, name);
  const p = peg(color), cls = "peg" + (ring ? " ring" : ""), style = { "--peg": p.c, "--peg-ink": p.ink, width: size, height: size, fontSize: size * .42 };
  if (av.type === "photo") return ce("span", { className: cls + " photo", "aria-hidden": true, style: { ...style, backgroundImage: "url(" + av.src + ")" } });
  if (av.type === "card") { const c = cardOfAv(av.card);
    return ce("span", { className: cls + " card" + (c.rank === "a" ? " ace" : ""), "aria-hidden": true, style },
      ce("img", { src: cardAvSrc(c), alt: "", loading: "lazy", decoding: "async", draggable: false })); }
  return ce("span", { className: cls, "aria-hidden": true, style }, (name || "?").trim()[0].toUpperCase());
}
function Card({ code }) {
  if (code === "JKR" || code === "JOKER") return ce("span", { className: "pc joker", role: "img", "aria-label": "Joker" },
    ce("span", { className: "pc-corner", "aria-hidden": true }, ce("b", null, "J"), ce("i", null, "★")), ce("span", { className: "pc-pip", "aria-hidden": true }, "★"));
  const rank = code.slice(0, -1), [ch, red] = SUIT[code.slice(-1)];
  return ce("span", { className: "pc" + (red ? " red" : "") + " s-" + code.slice(-1).toLowerCase(), role: "img", "aria-label": rank + ch },
    ce("span", { className: "pc-corner", "aria-hidden": true }, ce("b", null, rank), ce("i", null, ch)),
    ce("span", { className: "pc-pip", "aria-hidden": true }, ch));
}
// The illustrated deck from the kit: a 63 × 88 face with a double gold rule, true pip layouts and double-ended courts.
const DECK_PIPS = (() => { const L = 32, C = 50, R = 68, T = 21, B = 79, four = [[L, T], [R, T], [L, B], [R, B]], six = four.concat([[L, 50], [R, 50]]),
  tall = [[L, T], [R, T], [L, 40.3], [R, 40.3], [L, 59.7], [R, 59.7], [L, B], [R, B]];
  return { 2: [[C, T], [C, B]], 3: [[C, T], [C, 50], [C, B]], 4: four, 5: four.concat([[C, 50]]), 6: six, 7: six.concat([[C, 35.5]]),
    8: six.concat([[C, 35.5], [C, 64.5]]), 9: tall.concat([[C, 50]]), 10: tall.concat([[C, 30.7], [C, 69.3]]) }; })();
const suitArt = suit => "art/suits/" + suit + ".webp";
const useSym = (id, cls) => ce("svg", { className: cls, "aria-hidden": true }, ce("use", { href: "#" + id }));
function DeckCard({ rank, suit, joker, back, label, style, className, mono, photo, color }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true }, cls = "dcard" + (className ? " " + className : "");
  // A player's own card: their initial in the corners, and their initial or photo in the ring where an ace keeps its pip.
  if (mono) { const ix = ce("b", null, mono);
    return ce("div", { className: cls + " mono", style: { ...style, "--suit": color }, ...a11y }, ce("div", { className: "face" }, useSym("cardframe", "frame"),
      ce("span", { className: "ix tl" }, ix), ce("span", { className: "mid" }, useSym("acering", "ring"), photo ? ce("img", { className: "ph", src: photo, alt: "" }) : ce("b", { className: "ml" }, mono)), ce("span", { className: "ix br" }, ix))); }
  if (back) return ce("div", { className: cls + " back", style, ...a11y }, ce("div", { className: "face" }, ce("img", { src: "art/card-back-hi.webp", alt: "", width: 796, height: 1112, decoding: "async" })));
  if (joker) { const ix = [ce(Fragment, { key: "s" }, useSym("s-star")), ce("b", { key: "b" }, "JOKER")];
    return ce("div", { className: cls + " joker", style, ...a11y }, ce("div", { className: "face" }, useSym("cardrules", "frame"),
      ce("span", { className: "ix tl" }, ix), ce("img", { className: "jk", src: "art/courts/joker.webp", alt: "", decoding: "async" }), ce("span", { className: "ix br" }, ix))); }
  const pips = DECK_PIPS[rank], court = !pips && rank !== "A", ten = rank === "10" ? " ten" : "";
  const ix = [ce("b", { key: "b" }, rank), ce(Fragment, { key: "s" }, useSym("s-" + suit))];
  const body = rank === "A" ? ce("span", { className: "mid" }, useSym("acering", "ring"), ce("img", { src: suitArt(suit), alt: "", decoding: "async" }))
    : pips ? pips.map(([x, y], i) => ce("img", { key: i, className: "pip" + (y > 50 ? " flip" : ""), style: { "--x": x, "--y": y }, src: suitArt(suit), alt: "", decoding: "async" }))
    : ce("span", { className: "portrait" }, ["top", "bot"].map(k => ce("span", { key: k, className: "half " + k },
        ce("img", { className: "fig", src: "art/courts/" + suit + "-" + rank.toLowerCase() + ".webp", alt: "", decoding: "async" }), ce("img", { className: "s", src: suitArt(suit), alt: "" }))), ce("i", { className: "cut" }));
  return ce("div", { className: cls, "data-suit": suit, style, ...a11y }, ce("div", { className: "face" }, useSym(court ? "cardrules" : "cardframe", "frame"),
    ce("span", { className: "ix tl" + ten }, ix), body, ce("span", { className: "ix br" + ten }, ix)));
}
function Melds({ ex }) { return ce("span", { className: "melds" }, ex.map((m, i) => ce("span", { key: i, className: "meld" }, m.map(c => ce(Card, { key: c, code: c }))))); }
function Switch({ on, onChange, label }) {
  return ce("button", { role: "switch", "aria-checked": on, "aria-label": label, className: "switch" + (on ? " on" : ""), onClick: () => { haptic(5); onChange(!on); } },
    ce("span", { "aria-hidden": true }, on ? "On" : "Off"), ce("i", { "aria-hidden": true }));
}
function useCount(value, from = value, delay = 0) {
  const [v, setV] = useState(from), prev = useRef(from);
  useEffect(() => {
    const a = prev.current, b = value; prev.current = value;
    if (a === b || reducedMotion()) { setV(b); return; }
    const t0 = performance.now() + delay; let raf;
    const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / 650)), e = 1 - Math.pow(1 - k, 4); setV(Math.round(a + (b - a) * e)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}
function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q), h = () => setM(mq.matches); h(); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [q]);
  return m;
}
// Overlays render straight onto <body>, so one opened from inside another always lands on top,
// and nothing they sit inside (a transformed page or sheet) can clip or misplace them.
const onTop = el => ReactDOM.createPortal(el, document.body);
let openSheets = 0;
const lockPage = on => { openSheets = Math.max(0, openSheets + (on ? 1 : -1)); document.documentElement.classList.toggle("locked", openSheets > 0);
  const root = document.getElementById("root"); if (root) { if (openSheets > 0) root.setAttribute("inert", ""); else root.removeAttribute("inert"); } };
// Move focus into a dialog when it opens and back to whatever opened it when it closes.
function useDialogFocus(me, skip) {
  useEffect(() => { if (skip) return; const prev = document.activeElement;
    const t = setTimeout(() => { const el = me.current; if (!el || el.contains(document.activeElement)) return;
      const f = el.querySelector("[autofocus], input:not([type=hidden]):not([type=file]):not([readonly]), textarea"); const box = el.querySelector("[role=dialog]") || el;
      if (f && matchMedia("(pointer: fine)").matches) f.focus({ preventScroll: true }); else { box.setAttribute("tabindex", "-1"); box.focus({ preventScroll: true }); } }, 40);
    return () => { clearTimeout(t); setTimeout(() => { if (document.activeElement !== document.body) return; const back = prev && prev !== document.body && prev.isConnected ? prev : document.querySelector("#root [aria-label^='Game menu'], #root main h1, #root h1"); if (back) { if (!back.matches("button, a, input, [tabindex]")) back.setAttribute("tabindex", "-1"); back.focus({ preventScroll: true }); } }, 60); }; }, []);
}
// The on-screen keyboard shrinks the visual viewport but not the layout one. Track it so
// sheets sit above the keyboard instead of behind it.
(function trackViewport() {
  const vv = window.visualViewport; if (!vv || !document.documentElement.style) return;
  const set = () => { const st = document.documentElement.style; st.setProperty("--vv-h", Math.round(vv.height) + "px"); st.setProperty("--vv-top", Math.round(vv.offsetTop) + "px"); };
  vv.addEventListener("resize", set); vv.addEventListener("scroll", set); set();
})();

// The kit's sheet (docs/ui-kit.html .ksheet), docked to the bottom edge with a top rim only.
function KSheet({ title, heading, onClose, children, foot, footCls, cls, closeLabel, lead, bare, inline }) {
  const [closing, setClosing] = useState(false), [drag, setDrag] = useState(0), d = useRef(null), me = useRef(null);
  useEffect(() => { if (inline) return; lockPage(true); return () => lockPage(false); }, []);
  useDialogFocus(me, inline);
  const close = () => { if (closing) return; if (reducedMotion() || inline) return onClose(); setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => { const k = e => { if (e.key !== "Escape") return; const all = document.querySelectorAll(".scrim, .kport"); if (all[all.length - 1] === me.current) close(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  if (inline) return ce("section", { className: "ksheet ks-inline" + (cls ? " " + cls : ""), "aria-label": title },
    ce("div", { className: "head" }, lead, ce("h2", null, heading || title)), ce("div", { className: "body" }, children), foot && ce("div", { className: "foot" + (footCls ? " " + footCls : "") }, foot));
  const onFocus = e => { const el = e.target; if (el.matches && el.matches("input:not([type=file]):not([type=range]), textarea")) setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 320); };
  const start = e => { if (e.target.closest("button")) return; d.current = { y: e.clientY, t: performance.now() }; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => d.current && setDrag(Math.max(0, e.clientY - d.current.y));
  const end = e => { if (!d.current) return; const dy = Math.max(0, e.clientY - d.current.y), v = dy / (performance.now() - d.current.t); d.current = null; if (dy > 100 || v > .6) close(); else setDrag(0); };
  return onTop(ce("div", { ref: me, className: "kit kport" + (closing ? " out" : ""), onFocus },
    ce("div", { className: "lr-dim", onClick: close }),
    ce("div", { className: "ksheet lr-sheet" + (cls ? " " + cls : ""), role: "dialog", "aria-modal": true, "aria-label": title, style: drag ? (closing ? { transform: "translateY(100%)", transition: "transform .2s ease-in", animation: "none" } : { transform: "translateY(" + drag + "px)", animation: "none" }) : null },
      ce("div", { className: "kgrab", onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end },
        ce("div", { className: "grab" }),
        bare ? ce("button", { className: "ib cream ks-x", onClick: close, "aria-label": closeLabel || "Close" }, kIcon("xmark"))
          : ce("div", { className: "head" }, lead, ce("h2", null, heading || title), ce("button", { className: "ib cream", onClick: close, "aria-label": closeLabel || "Close" }, kIcon("xmark")))),
      ce("div", { className: "body" }, children),
      foot && ce("div", { className: "foot" + (footCls ? " " + footCls : "") }, foot))));
}

// ── Store: groups + games, saved locally, synced per group ────────
function migrate() {
  const st = loadJSON(STORE_KEY, null); if (st) return st;
  const s = { groups: {}, games: {}, groupOrder: [] };
  const old = loadJSON("mayi:game:v4", null), hist = loadJSON("mayi:history:v1", []);
  if ((old && old.players && old.players.length) || hist.length) {
    const gid = uid(), names = (old && old.players) || [];
    const players = names.map((p, i) => ({ id: p.id, name: p.name, color: PEGS[i % 8].k }));
    s.groups[gid] = { id: gid, name: "My table", code: newCode(), players, createdAt: now(), updatedAt: now() };
    s.groupOrder = [gid];
    if (old && old.started) {
      const id = uid();
      s.games[id] = { id, groupId: gid, players: players.map(p => p.id), dealer: old.dealer || 0, rules: { ...DEFAULT_RULES, ...(old.houseRules || {}) },
        round: Math.min(6, old.currentRound || 0), scores: old.scores || {}, buys: old.buys || {}, hands: old.hands || {}, status: "live", startedAt: now(), updatedAt: now() };
    }
  }
  return s;
}
function useStore() {
  const [s, setS] = useState(migrate);
  useEffect(() => { saveJSON(STORE_KEY, s); }, [s]);
  const api = useMemo(() => ({
    set: setS,
    group: (id, fn) => setS(x => ({ ...x, groups: { ...x.groups, [id]: { ...fn(x.groups[id]), updatedAt: now() } } })),
    game: (id, fn) => setS(x => { const g = fn(x.games[id]); return { ...x, games: { ...x.games, [id]: { ...g, updatedAt: now() } }, groups: { ...x.groups, [g.groupId]: { ...x.groups[g.groupId], updatedAt: now() } } }; }),
  }), []);
  return [s, api];
}

// ── Merging two copies of a table ─────────────────────────────────
// Not used while live sharing is parked; kept (and tested) for when it comes back.
// Two phones scoring the same game: the newer copy wins a clash, but a score,
// buy or counted hand that only one side has is kept, so no round is lost.
function mergeGame(a, b) {
  if (!a) return b; if (!b) return a;
  const [base, other] = (b.updatedAt || 0) > (a.updatedAt || 0) ? [b, a] : [a, b];
  const fill = (x, y) => { const out = { ...(x || {}) }; Object.entries(y || {}).forEach(([r, row]) => { out[r] = { ...(row || {}), ...(out[r] || {}) }; }); return out; };
  const g = { ...base, scores: fill(base.scores, other.scores), buys: fill(base.buys, other.buys), hands: fill(base.hands, other.hands), round: Math.max(base.round || 0, other.round || 0) };
  if (other.status === "done" && base.status === "live") { g.status = "done"; g.endedAt = other.endedAt; }
  return g;
}
function applyDoc(x, doc) {
  const gid = doc.group.id, cur = x.groups[gid];
  const games = { ...x.games }; doc.games.forEach(g => { games[g.id] = mergeGame(games[g.id], g); });
  const group = cur && cur.updatedAt >= doc.updatedAt ? cur : doc.group;
  return { ...x, groups: { ...x.groups, [gid]: group }, games, groupOrder: x.groupOrder.includes(gid) ? x.groupOrder : [...x.groupOrder, gid] };
}
/* ================================================================
   v7 "Game Night": iOS chrome, dotted band, seats, looks
   ================================================================ */

// ── Looks: one device-level choice, applied as CSS variables ─────
// Bright toy-box colours, like a family card game. The ids are kept from earlier versions so saved choices carry over.
const CTA = { cta: "#FFC83D", ctaHi: "#FFE07E", ctaEdge: "#E09A00", ctaInk: "#1B2150" };
// Lagoon, from the kit: deep teal water, cream text, gold accents. The same in light and dark, because the water is always dark.
const LAGOON = { bg: "#0B5866", surface: "rgba(3,38,46,.5)", fill: "rgba(3,38,46,.42)", line: "rgba(255,233,166,.18)", ink: "#FFF7E2", ink2: "#D9F3EC", ink3: "#A9D6CD",
  band: "#136F78", band2: "#0D5761", bandInk: "#FFF7E2", bandInk2: "rgba(255,247,226,.84)", accent: "#FFE7A3", accentInk: "#0F3247", accentSoft: "rgba(255,231,163,.14)",
  cta: "#136F78", ctaHi: "#24979C", ctaEdge: "#083E46", ctaInk: "#FFF7E2",
  gold: "#F4D27A", goldRing: "#E9B44C", goldSoft: "rgba(233,180,76,.18)", red: "#FFB4BC", out: "#8CF0C4", outSoft: "rgba(140,240,196,.16)", focus: "#FFE39A" };
const LOOKS = {
  table: { name: "Game night", desc: "Royal blue and sunny yellow", swatch: ["#2A5BEA", "#FFC83D"], water: true,
    light: { bg: "#EAF0FF", surface: "#FFFFFF", fill: "#DEE6FB", line: "rgba(20,36,92,.14)", ink: "#141B3D", ink2: "#3E4770", ink3: "#5A6390",
      band: "#2A5BEA", band2: "#1A3BC0", bandInk: "#FFFFFF", bandInk2: "rgba(255,255,255,.86)", accent: "#2152E0", accentInk: "#FFFFFF", accentSoft: "#DCE6FF", ...CTA,
      gold: "#9A6200", goldRing: "#FFB800", goldSoft: "#FFF1C9", red: "#D6243A", out: "#0F8043", outSoft: "#DDF5E7", focus: "#7D4FE0" },
    dark: { bg: "#1A2B74", surface: "rgba(6,12,46,.5)", fill: "rgba(6,12,46,.42)", line: "rgba(255,255,255,.12)", ink: "#F1F4FF", ink2: "#BBC4EA", ink3: "#959FCA",
      band: "#2A57E0", band2: "#162E98", bandInk: "#FFFFFF", bandInk2: "rgba(255,255,255,.84)", accent: "#8FB0FF", accentInk: "#0A1440", accentSoft: "rgba(143,176,255,.16)", ...CTA,
      gold: "#FFD166", goldRing: "#FFC83D", goldSoft: "rgba(255,200,61,.14)", red: "#FF7B8A", out: "#4FD98C", outSoft: "rgba(79,217,140,.16)", focus: "#B9A4FF" } },
  lime: { name: "Lime", desc: "Fresh green, like a picnic table", swatch: ["#8ED245", "#2A5BEA"], water: true,
    light: { bg: "#EEF8E4", surface: "#FFFFFF", fill: "#E1EFD3", line: "rgba(24,52,18,.14)", ink: "#13240F", ink2: "#3D5136", ink3: "#566B4E",
      band: "#8ED245", band2: "#5DB52A", bandInk: "#123015", bandInk2: "rgba(18,48,21,.8)", accent: "#2E7D12", accentInk: "#FFFFFF", accentSoft: "#DDF0CC", ...CTA,
      gold: "#8A5800", goldRing: "#FFB800", goldSoft: "#FFF1C9", red: "#D6243A", out: "#0F8043", outSoft: "#DDF5E7", focus: "#2A5BEA" },
    dark: { bg: "#2C5212", surface: "rgba(6,22,6,.5)", fill: "rgba(6,22,6,.42)", line: "rgba(255,255,255,.12)", ink: "#F0F8EA", ink2: "#BCD0B2", ink3: "#97AD8C",
      band: "#7BC23A", band2: "#4E9A22", bandInk: "#0F2610", bandInk2: "rgba(15,38,16,.8)", accent: "#A6E36A", accentInk: "#0F2610", accentSoft: "rgba(166,227,106,.15)", ...CTA,
      gold: "#FFD166", goldRing: "#FFC83D", goldSoft: "rgba(255,200,61,.14)", red: "#FF7B8A", out: "#4FD98C", outSoft: "rgba(79,217,140,.16)", focus: "#8FB0FF" } },
  midnight: { name: "Lagoon", desc: "Deep teal water and gold", swatch: ["#0B5866", "#E9B44C"], ground: true, light: LAGOON, dark: LAGOON },
  parlour: { name: "Cherry", desc: "Candy red and lemon yellow", swatch: ["#D42445", "#FFC83D"], water: true,
    light: { bg: "#FFEEF0", surface: "#FFFFFF", fill: "#F8DFE3", line: "rgba(80,14,28,.13)", ink: "#2A0E15", ink2: "#5B3940", ink3: "#78545B",
      band: "#D42445", band2: "#A3133A", bandInk: "#FFFFFF", bandInk2: "rgba(255,255,255,.86)", accent: "#C4163A", accentInk: "#FFFFFF", accentSoft: "#FFDDE3", ...CTA,
      gold: "#8A5800", goldRing: "#FFB800", goldSoft: "#FFF1C9", red: "#B0102F", out: "#0F8043", outSoft: "#DDF5E7", focus: "#2A5BEA" },
    dark: { bg: "#6C1835", surface: "rgba(34,4,14,.5)", fill: "rgba(34,4,14,.42)", line: "rgba(255,255,255,.12)", ink: "#FFF0F2", ink2: "#E0B9C0", ink3: "#BE959D",
      band: "#C21E40", band2: "#7E0C2C", bandInk: "#FFFFFF", bandInk2: "rgba(255,255,255,.84)", accent: "#FF8FA3", accentInk: "#2A0710", accentSoft: "rgba(255,143,163,.15)", ...CTA,
      gold: "#FFD166", goldRing: "#FFC83D", goldSoft: "rgba(255,200,61,.14)", red: "#FF7B8A", out: "#4FD98C", outSoft: "rgba(79,217,140,.16)", focus: "#8FB0FF" } },
  daylight: { name: "Daylight", desc: "Maximum contrast for playing outside", swatch: ["#000000", "#FFFFFF"],
    light: { bg: "#FFFFFF", surface: "#FFFFFF", fill: "#EDEFF1", line: "rgba(0,0,0,.28)", ink: "#000000", ink2: "#1E1E1E", ink3: "#3D3D3D",
      band: "#FFFFFF", band2: "#FFFFFF", bandInk: "#000000", bandInk2: "#1E1E1E", accent: "#000000", accentInk: "#FFFFFF", accentSoft: "#EDEFF1",
      cta: "#000000", ctaHi: "#000000", ctaEdge: "#000000", ctaInk: "#FFFFFF",
      gold: "#6B4700", goldRing: "#B07A00", goldSoft: "#FFF1C7", red: "#A00000", out: "#005A2B", outSoft: "#D6F2E1", focus: "#0047D6" } },
};
// ── Card scanner and hand coach (Claude, with the player's own API key) ──
// The key stays on this device. Requests go straight from the browser to Anthropic.
const AI_MODEL = "claude-opus-5-5";
const AI_SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm"; // pinned
const AI_KEY = "mayi:aikey";
const getAiKey = () => { try { return localStorage.getItem(AI_KEY) || ""; } catch (e) { return ""; } };
const setAiKey = k => { try { k ? localStorage.setItem(AI_KEY, k) : localStorage.removeItem(AI_KEY); } catch (e) {} };
let sdkPromise = null;
const loadSDK = () => sdkPromise || (sdkPromise = import(AI_SDK_URL).then(m => m.default || m.Anthropic).catch(e => { sdkPromise = null; throw e; }));
function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, (max || 1568) / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.86)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't open that photo. Try taking it again.")); };
    img.src = url;
  });
}
async function askClaude(dataUrl, prompt, schema, who = "card reader") {
  const apiKey = getAiKey(); if (!apiKey) throw new Error("Add an Anthropic API key in Settings to use the card scanner.");
  let Anthropic;
  try { Anthropic = await loadSDK(); } catch (e) { throw new Error("Couldn't load the " + who + ". Check the internet connection."); }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  let res;
  try {
    res = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) } },
        { type: "text", text: prompt } ] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("The API key was rejected. Check it in Settings.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error("This API key can't use the " + who + " model.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Too many photos at once. Wait a moment and try again.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach the " + who + ". Check the connection.");
    if (e instanceof Anthropic.APIError) throw new Error("The " + who + " had a problem (" + (e.status || "error") + "). Try again.");
    throw new Error("Something went wrong reading the photo.");
  }
  if (res.stop_reason === "refusal") throw new Error(who === "card reader" ? "The card reader couldn't process this photo. Try a clearer shot of just the cards." : "That photo couldn't be used. Try another one.");
  if (res.stop_reason === "max_tokens") throw new Error("That photo had too much in it. Try a closer shot.");
  const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  try { return JSON.parse(text); } catch (e) { throw new Error("The reply couldn't be read. Try another photo."); }
}
const SCAN_SCHEMA = { type: "object", additionalProperties: false, required: ["cards", "unclear"], properties: {
  cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["rank", "suit", "sure"], properties: {
    rank: { type: "string", enum: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "JOKER"] },
    suit: { type: "string", enum: ["S", "H", "D", "C", "none"] }, sure: { type: "boolean" } } } },
  unclear: { type: "integer" } } };
// Returns hand tokens with suits ("7S", "KH", "JOKER") plus which ones the reader wasn't sure of.
async function scanHand(dataUrl) {
  const d = await askClaude(dataUrl,
    "This photo shows playing cards left in one player's hand at the end of a round of contract rummy, fanned in a hand or spread on a table. " +
    "Identify every card whose face you can see. Two decks are in play, so duplicates are possible; list each physical card once. " +
    "Set sure to false for any card you had to guess. Use suit none only for jokers. Count cards you can see but cannot read at all in unclear.", SCAN_SCHEMA);
  const cards = (d.cards || []).map(c => ({ token: c.rank === "JOKER" ? "JOKER" : c.rank + (c.suit !== "none" ? c.suit : ""), sure: c.sure !== false }));
  return { cards, unclear: Math.max(0, d.unclear | 0) };
}
const COACH_SCHEMA = { type: "object", additionalProperties: false, required: ["cards", "have", "aim", "keep", "discard", "tip"],
  properties: Object.fromEntries(["cards", "have", "aim", "keep", "discard", "tip"].map(k => [k, { type: "string" }])) };
function adviseHand(dataUrl, round, rules) {
  const r = ROUNDS[round];
  return askClaude(dataUrl,
    "You are a friendly coach for the card game May I? (contract rummy, two decks). This round's contract is " + contractLine(r) + " (" + r.name + "). " +
    "A set is 3+ cards of the same rank, any suits. A run is 4+ cards in a row in one suit. Wilds can't outnumber natural cards in a meld. House rules: " + rulesLine(rules) + ". " +
    "Players go down once per round with the contract; after that they may only lay off onto melds on the table. " + (r.goOut ? "This is the final round: the player must go down and go out in one move with no discard. " : "") +
    "The photo shows the player's hand. Read the cards, then coach them in plain, short sentences a beginner understands. " +
    "cards: the cards you read, like 7♠ 7♥ 9♦. have: melds or near-melds they already hold. aim: what to build toward. keep: cards to keep and why. discard: the best card to discard next and why. tip: one extra tip.", COACH_SCHEMA);
}
const SETTINGS_KEY = "mayi:settings:v6";
const loadSettings = () => ({ look: "midnight", ...loadJSON(SETTINGS_KEY, {}) });
// Looks mapped onto the Lagoon materials. Daylight shows Lagoon until it is mapped too.
const MAPPED_LOOKS = ["midnight", "table", "lime", "parlour"];
// Looks belong to tables (owner's call, 22 Nov): a table's page and its games wear its look; Play, Learn, Stats and Settings stay on the lagoon.
// A table made before looks belonged to tables has none, and shows Lagoon.
const tableLook = g => g && MAPPED_LOOKS.includes(g.look) ? g.look : "midnight";
// A new table is dealt a look the other tables are not wearing yet, while there is one.
const dealLook = groups => { const used = Object.values(groups || {}).map(tableLook), free = MAPPED_LOOKS.filter(k => !used.includes(k)), pool = free.length ? free : MAPPED_LOOKS;
  return pool[Math.floor(Math.random() * pool.length)]; };
// The tile for each look in the picker: its water and its jewel. The table card on Play takes the look's colour too.
const LOOK_TILE = { midnight: { c: ["#3DBDB1", "#1C8E9D", "#0B5866"], art: "crown", blk: "teal" }, table: { c: ["#6F96FF", "#3463D8", "#17337E"], art: "jewel-spade", blk: "sap" },
  lime: { c: ["#A8DB62", "#458F25", "#1F5212"], art: "jewel-club", blk: "jade" }, parlour: { c: ["#F07080", "#C42645", "#680D26"], art: "jewel-heart", blk: "ruby" } };
function applyLook(chosen) {
  // Every mapped look is deep water under cream text, so each one uses its deep colours in light and dark alike. (A pale ground would hide the cream headings.)
  const name = MAPPED_LOOKS.includes(chosen) ? chosen : "midnight", L = LOOKS[name] || LOOKS.table, dark = !!L.dark, t = dark ? L.dark : L.light;
  const root = document.documentElement;
  Object.entries(t).forEach(([k, v]) => root.style.setProperty("--" + k.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), v));
  root.dataset.look = name; root.dataset.scheme = dark ? "dark" : "light"; root.style.colorScheme = L.ground || dark ? "dark" : "light";
  if (L.ground || L.water) root.dataset.ground = ""; else delete root.dataset.ground;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bg;
}

// ── iOS chrome: large title that collapses into a blurred bar ─────
function useScrolled(px) {
  const [s, setS] = useState(false);
  useEffect(() => { const h = () => setS(scrollY > px); h(); addEventListener("scroll", h, { passive: true }); return () => removeEventListener("scroll", h); }, []);
  return s;
}
function Page({ title, back, onBack, actions, children, className, footer, hero, brand, top }) {
  const collapsed = useScrolled(44);
  const heroTop = !top && hero ? ce("section", { className: "ptop" }, ce("div", { className: "ptop-in" }, ce("h1", { className: "ptop-title" }, title), hero)) : null;
  return ce("div", { className: "page " + (className || "") + (top || hero ? " has-top" : "") },
    ce("header", { className: "nav" + (collapsed ? " collapsed" : "") },
      ce("div", { className: "nav-row" },
        ce("div", { className: "nav-l" }, onBack && ce("button", { className: "nav-back", onClick: onBack }, ce("span", { className: "nb-ic", "aria-hidden": true }, ce(Icon, { n: "back", size: 20 })), ce("span", null, back))),
        ce("div", { className: "nav-title", "aria-hidden": !collapsed }, title),
        ce("div", { className: "nav-r" }, actions))),
    top || heroTop,
    ce("main", { className: "content" }, top || hero ? null : brand || ce("h1", { className: "large-title" }, title), children),
    footer);
}
function List({ header, footer, children }) {
  return ce("section", { className: "group" }, header && ce("h2", { className: "group-h" }, header), ce("div", { className: "list" }, children), footer && ce("p", { className: "group-f" }, footer));
}function Row({ lead, title, sub, trail, onClick, chevron, tone }) {
  const C = onClick ? "button" : "div";
  return ce(C, { className: "row" + (onClick ? " tap" : "") + (tone ? " " + tone : ""), onClick },
    lead && ce("span", { className: "row-lead" }, lead),
    ce("span", { className: "row-main" }, ce("b", null, title), sub && ce("small", null, sub)),
    trail != null && ce("span", { className: "row-trail" }, trail),
    chevron && ce("span", { className: "chev" }, ce(Icon, { n: "chevron", size: 18 })));
}

/* ================================================================
   App
   ================================================================ */
function App() {
  const [raw, api] = useStore(), s = useMemo(() => dealFaces(raw), [raw]);
  const wide = useMedia("(min-width: 900px)"), desk = useMedia("(min-width: 1100px)");
  const [settings, setSettings] = useState(loadSettings);
  // Calm is known before the first screen draws, so nothing on it starts moving and then stops.
  calmOn = !!settings.calm;
  useEffect(() => { saveJSON(SETTINGS_KEY, settings); soundOn = settings.sound !== false;
    calmOn = !!settings.calm; speakOn = !!settings.speak; undoOn = settings.undo !== false; awakeOn = settings.awake !== false;
    const de = document.documentElement; de.classList.toggle("calm", calmOn); de.classList.toggle("hicon", !!settings.contrast); de.classList.toggle("pat", !!settings.patterns); de.classList.toggle("lefty", settings.hand === "left");
    de.style.fontSize = settings.text && +settings.text !== 1 ? +settings.text * 100 + "%" : ""; }, [settings]);
  const [view, setView] = useState(() => {
    const live = Object.values(s.games).find(g => g.status === "live");
    return live ? { at: "game", gameId: live.id } : { at: "home" };
  });
  // The look follows the place: a table's page, its games and its results wear the table's look.
  const lookGame = view.gameId && s.games[view.gameId], lookGroup = ["group", "game", "recap"].includes(view.at) && s.groups[view.groupId || (lookGame && lookGame.groupId)];
  // Settings, Learn and Stats wear the look of the table played last, so they match the game just left (owner, 24 Nov). Play stays the lagoon.
  const lastGroup = useMemo(() => { const g = Object.values(s.games).filter(x => s.groups[x.groupId]).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    return g ? s.groups[g.groupId] : s.groups[(s.groupOrder || [])[0]]; }, [s.games, s.groups]);
  const backGame = view.back && view.back.gameId && s.games[view.back.gameId];
  const tabGroup = ["learn", "stats", "settings"].includes(view.at) && ((backGame && s.groups[backGame.groupId]) || lastGroup);
  const lookNow = lookGroup ? tableLook(lookGroup) : tabGroup ? tableLook(tabGroup) : "midnight";
  useLayoutEffect(() => { applyLook(lookNow); }, [lookNow]);
  const [sheet, setSheet] = useState(null), [intro, setIntro] = useState(introDue);
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast || toast.stay) return; const t = setTimeout(() => setToast(null), toast.undo ? 6000 : toast.sub ? 3800 : 2800); return () => clearTimeout(t); }, [toast]);
  // After something is removed (a game ended, a table deleted), focus lands on Undo, so a screen reader hears what happened and can take it back.
  useEffect(() => { if (!toast || !toast.undo) return; const t = setTimeout(() => { const b = document.querySelector(".toast-undo"); if (b) b.focus({ preventScroll: true }); }, 80); return () => clearTimeout(t); }, [toast]);
  // Destructive actions happen at once and offer Undo, instead of asking twice.
  // Updates while the app is open (owner, 24 Nov): check version.json on opening, on coming back to the app, and every 30 minutes.
  // With nothing going on, a newer version reloads straight away (every score is already saved). During a game or with a sheet open,
  // a toast offers Refresh instead, and the reload waits until the table is back on Play.
  const upd = useRef({ view, sheet, due: false }); upd.current.view = view; upd.current.sheet = sheet;
  const busyNow = () => upd.current.view.at === "game" || upd.current.sheet || document.querySelector("body > .kport, body > .kscreen, input:focus, textarea:focus");
  useEffect(() => {
    const mine = typeof __BUILD__ !== "undefined" ? __BUILD__ : null;
    if (!mine || !/^https?:$/.test(location.protocol)) return;
    let told = false;
    const check = () => fetch("./version.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d || !d.v || d.v === mine) return;
      upd.current.due = true;
      if (!busyNow()) { location.reload(); return; }
      if (!told) { told = true; setToast({ text: "New version ready", sub: "Refresh when it suits the table", stay: true, act: { label: "Refresh", fn: () => location.reload() } }); }
    }).catch(() => {});
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis); const iv = setInterval(check, 30 * 60e3);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(iv); }; }, []);
  // A waiting update lands once the table is back on Play with nothing open.
  useEffect(() => { if (upd.current.due && view.at === "home" && !sheet) { const t = setTimeout(() => { if (!busyNow()) location.reload(); }, 400); return () => clearTimeout(t); } }, [view.at, sheet]);
  const withUndo = (text, change) => { const before = s; change(); setToast({ text, undo: () => { api.set(() => before); setToast(null); } }); };
  const startGame = (groupId, players, dealer, rules) => {
    const id = uid();
    // The rules a game is dealt with become the table's rules, so its next game starts from them.
    api.set(x => ({ ...x, groups: { ...x.groups, [groupId]: { ...x.groups[groupId], rules: { ...DEFAULT_RULES, ...rules } } },
      games: { ...x.games, [id]: { id, groupId, players, dealer, rules: { ...DEFAULT_RULES, ...rules }, names: namesOf(x.groups[groupId], players), round: 0, scores: {}, buys: {}, hands: {}, status: "live", startedAt: now(), updatedAt: now() } } }));
    close(); go({ at: "game", gameId: id });
  };
  // Rematch: same players and rules, the deal moves one seat left.
  const rematch = (g, extra) => { const ids = [...g.players, ...(extra || [])].filter(id => s.groups[g.groupId].players.some(p => p.id === id)); if (ids.length < 2) return open("newgame", { groupId: g.groupId, rules: g.rules }); startGame(g.groupId, ids, (g.dealer + 1) % ids.length, g.rules); };
  useEffect(() => { scrollTo(0, 0); }, [view.at, view.groupId, view.gameId]);
  // Headers sit on the background; once the page scrolls under one it frosts over.
  useEffect(() => { const f = () => document.documentElement.classList.toggle("scrolled", scrollY > 8); addEventListener("scroll", f, { passive: true }); f(); return () => removeEventListener("scroll", f); }, []);
  // First run: the table is made from the names typed, and the first hand is dealt.
  const firstGame = (name, players, dealer, rules) => { const gid = uid();
    api.set(x => ({ ...x, groups: { ...x.groups, [gid]: { id: gid, name, auto: true, code: newCode(), look: dealLook(x.groups), players, createdAt: now(), updatedAt: now() } }, groupOrder: [...x.groupOrder, gid] }));
    startGame(gid, players.map(p => p.id), dealer || 0, rules || DEFAULT_RULES); };
  // A new face at a table, from New game's Add.
  const addToTable = (gid, name) => { const grp = s.groups[gid], used = grp.players.map(q => q.color), id = uid();
    const p = { id, name: name.slice(0, 20), color: (PEGS.find(c => !used.includes(c.k)) || PEGS[grp.players.length % 8]).k, avatar: avSeed(name, heldFaces(grp.players)) };
    api.group(gid, x => ({ ...x, players: [...x.players, p] })); haptic(10); sound("chip"); return id; };
  const open = (type, extra) => { if (type === "settings") { setSheet(null); haptic(6); return setView(v => v.at === "settings" ? v : { at: "settings", back: v }); } setSheet({ type, ...(extra || {}) }); };
  const close = () => setSheet(null);
  const go = v => { haptic(6); setView(v); };
  // The phone's Back (or a swipe back) closes the top sheet first, then steps back one screen. It never leaves a game.
  const backRef = useRef(null), backTold = useRef(false);
  backRef.current = () => {
    if (intro) { setIntro(false); return true; }
    const g0 = view.gameId && s.games[view.gameId];
    if (view.at === "game" && g0) { if (!backTold.current) { backTold.current = true; setToast({ text: "Still playing", sub: "End or leave the game from \u2022\u2022\u2022" }); } return true; }
    if (view.at === "recap" && g0) { go({ at: "group", groupId: g0.groupId }); return true; }
    if (view.at === "settings" && view.back) { go(view.back); return true; }
    if (view.at !== "home") { go({ at: "home" }); return true; }
    return false;
  };
  useEffect(() => {
    const guard = () => history.pushState({ mayi: 1 }, "");
    if (!(history.state && history.state.mayi)) guard();
    const onPop = () => {
      const tops = document.querySelectorAll("body > .kport, body > .kscreen");
      if (tops.length) { dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); return guard(); }
      if (backRef.current()) return guard();
      history.back();
    };
    addEventListener("popstate", onPop); return () => removeEventListener("popstate", onPop);
  }, []);

  let screen;
  const g = view.gameId && s.games[view.gameId], grp = view.groupId && s.groups[view.groupId];
  if (view.at === "group" && grp) screen = ce(GroupPage, { s, group: grp, open, go });
  else if (view.at === "newtable") screen = ce(FirstRun, { onDeal: firstGame, go, open, sub: true, taken: Object.values(s.groups).map(x => x.name) });
  else if (view.at === "game" && g) screen = ce(GameScreen, { s, api, game: g, open, go, wide, setToast, level: settings.level, fixAsk: view.fix != null ? view.fix + ":" + view.k : null });
  else if (view.at === "recap" && g) screen = ce(Recap, { s, game: g, go, setToast, rematch, settings, setSettings, onTable: patch => api.group(g.groupId, x => ({ ...x, ...patch })),
    onReopen: g.status === "done" && !Object.values(s.games).some(x => x.groupId === g.groupId && x.status === "live") ? () => {
      api.game(g.id, x => { const { endedAt, early, ...rest } = x, gap = ROUNDS.findIndex((_, i) => !roundDone(x, i)); return { ...rest, status: "live", round: gap >= 0 ? gap : 6, reopened: x }; });
      setToast({ text: "Game reopened" }); go({ at: "game", gameId: g.id }); } : null,
    onDelete: () => withUndo("Game deleted", () => { api.set(x => { const games = { ...x.games }; delete games[g.id]; return { ...x, games }; }); go({ at: "group", groupId: g.groupId }); }) });
  else if (view.at === "settings") screen = ce(SettingsPage, { s, settings, setSettings, go, open, setToast, tab: !view.back, onBack: () => go(view.back || { at: "home" }),
    onRestore: st => withUndo("Backup loaded", () => api.set(() => st)) });
  else if (view.at === "learn") screen = ce(LearnPage, { s, open, go });
  else if (view.at === "stats") screen = ce(StatsPage, { s, open, go });
  else screen = ce(Home, { s, open, go, onFirst: firstGame });
  const topLevel = !(view.at === "group" && grp) && !(view.at === "game" && g) && !(view.at === "recap" && g);

  let sheetEl = null;
  if (sheet) {
    const sg = sheet.gameId && s.games[sheet.gameId];

    if (sheet.type === "players" && s.groups[sheet.groupId]) sheetEl = ce(PlayersSheet, { onClose: close, group: s.groups[sheet.groupId], api, s });
    if (["newgame", "start", "quick"].includes(sheet.type) && s.groupOrder.some(id => s.groups[id])) sheetEl = ce(NewGameSheet, { s, groupId: sheet.groupId, rules: sheet.rules, onClose: close,
      onStart: (gid, players, dealer, rules) => startGame(gid, players, dealer, rules),
      onResume: gm => { close(); go({ at: "game", gameId: gm.id }); },
      onNewTable: () => { close(); go({ at: "newtable" }); },
      onAddPlayer: addToTable, onFace: (gid, pid, color, avatar) => api.group(gid, x => ({ ...x, players: x.players.map(q => q.id === pid ? { ...q, color, avatar } : q) })) });
    if (sheet.type === "table") { const tg = s.groups[sheet.groupId]; sheetEl = tg && ce(TableSheet, { onClose: close, group: tg, games: Object.values(s.games).filter(x => x.groupId === tg.id && x.status !== "abandoned").length,
      onRename: name => api.group(tg.id, x => ({ ...x, name, auto: false })), onLook: look => api.group(tg.id, x => ({ ...x, look })),
      onPlayers: () => open("players", { groupId: tg.id }),
      onDelete: () => { close(); withUndo(tg.name + " deleted", () => { api.set(x => { const groups = { ...x.groups }, games = { ...x.games }; delete groups[tg.id];
        Object.values(games).forEach(gm => { if (gm.groupId === tg.id) delete games[gm.id]; }); return { ...x, groups, games, groupOrder: x.groupOrder.filter(i => i !== tg.id) }; }); go({ at: "home" }); }); } }); }
    if (sheet.type === "profile" && s.groups[sheet.groupId]) sheetEl = ce(ProfileSheet, { onClose: close, s, group: s.groups[sheet.groupId], playerId: sheet.playerId,
      onDress: () => open("dress", { groupId: sheet.groupId, playerId: sheet.playerId, back: true }) });
    if (sheet.type === "dress" && s.groups[sheet.groupId]) { const dg = s.groups[sheet.groupId], dp = dg.players.find(q => q.id === sheet.playerId);
      const done = () => sheet.back ? open("profile", { groupId: dg.id, playerId: dp.id }) : close();
      sheetEl = dp && ce(AvatarSheet, { dress: true, player: dp, taken: dg.players.filter(q => q.id !== dp.id).map(q => q.color), onClose: done,
        onSave: (color, avatar) => { api.group(dg.id, x => ({ ...x, players: x.players.map(q => q.id === dp.id ? { ...q, color, avatar } : q) })); haptic(12); sound("save"); done(); } }); }
    if (sheet.type === "rules") sheetEl = ce(RulesSheet, { onClose: close, round: sg ? sg.round : 0, rules: sg ? sg.rules : DEFAULT_RULES, level: settings.level, onLevel: lv => setSettings(x => ({ ...x, level: lv })), initialTab: sheet.tab, backTo: sheet.backTo, live: !!(sg && sg.status === "live"),
      setRules: sg && sg.status === "live" ? fn => api.game(sg.id, x => ({ ...x, rules: fn(x.rules) })) : null });
    if (sheet.type === "gamePlayers" && sg) sheetEl = ce(GamePlayersSheet, { onClose: close, game: sg, group: s.groups[sg.groupId], s,
      onChange: fn => api.game(sg.id, fn),
      onJoin: (pid, name, target, look) => { let who = name;
        api.set(x => { const grp = x.groups[sg.groupId], gm = x.games[sg.id]; let p = pid && grp.players.find(q => q.id === pid), groups = x.groups;
          if (!p && pid && gm.names && gm.names[pid]) p = { id: pid, ...gm.names[pid] };
          if (!p) { const used = grp.players.map(q => q.color); p = { id: uid(), name, color: look && look.color || (PEGS.find(c => !used.includes(c.k)) || PEGS[grp.players.length % 8]).k, avatar: look && look.avatar || avSeed(name, heldFaces(dealFaces({ groups: { g: grp } }).groups.g.players)) };
            groups = { ...groups, [grp.id]: { ...grp, players: [...grp.players, p], updatedAt: now() } }; }
          who = p.name;
          return { ...x, groups, games: { ...x.games, [gm.id]: { ...joinGame(gm, p.id, namesOf({ players: [p] }, [p.id])[p.id], target), updatedAt: now() } } }; });
        haptic(10); sound("chip"); setToast({ text: (who || "New player") + " joined the game" }); } });
    if (sheet.type === "house" && sg) sheetEl = ce(HouseSheet, { onClose: () => open("game", { gameId: sg.id }), rules: sg.rules, setRules: fn => { api.game(sg.id, x => ({ ...x, rules: fn(x.rules) })); api.group(sg.groupId, x => ({ ...x, rules: fn({ ...DEFAULT_RULES, ...(x.rules || sg.rules) }) })); } });
    if (sheet.type === "game" && sg) sheetEl = ce(GameMenu, { onClose: close, game: sg, group: s.groups[sg.groupId], onSettings: () => open("settings"), onLook: look => api.group(sg.groupId, x => ({ ...x, look })),
      onPlayers: () => open("gamePlayers", { gameId: sg.id }), onHouse: () => open("house", { gameId: sg.id }),
      onFix: i => { close(); go({ at: "game", gameId: sg.id, fix: i, k: Date.now() }); },
      onEnd: () => { close(); const back = !!sg.reopened;
        withUndo(back ? "Changes discarded" : "Game ended without saving", () => { api.game(sg.id, x => x.reopened ? x.reopened : ({ ...x, status: "abandoned" })); go(back ? { at: "recap", gameId: sg.id } : { at: "group", groupId: sg.groupId }); }); },
      onFinish: () => { close(); const n = ROUNDS.filter((_, i) => roundDone(sg, i)).length;
        withUndo("Finished after " + n + (n === 1 ? " round" : " rounds"), () => { api.game(sg.id, x => { const scores = {}, hands = {};
          ROUNDS.forEach((_, i) => { if (roundDone(x, i)) { scores[i] = x.scores[i]; if (x.hands[i]) hands[i] = x.hands[i]; } });
          const { reopened, ...y } = x; return { ...y, scores, hands, status: "done", endedAt: reopened ? reopened.endedAt : now(), early: n < 7 }; }); go({ at: "recap", gameId: sg.id }); }); } });
  }
  const railOn = desk && s.groupOrder.some(id => s.groups[id]) && !(view.at === "game" && g);
  return ce(Fragment, null, railOn ? ce("div", { className: "deskwrap" }, ce(DeskRail, { s, view, go }), ce("div", { className: "deskmain" }, screen)) : screen,
    !railOn && topLevel && (["learn", "stats"].includes(view.at) || (view.at === "settings" && !view.back)) && ce(TabBar, { at: view.at, go }), sheetEl, intro && ce(Splash, { onDone: () => setIntro(false) }),
    toast && onTop(ce("div", { key: toast.text, className: "toast" + (toast.undo ? " has-undo" : "") + (toast.art ? " kt" : ""), role: "status" },
      toast.art && ce("img", { src: "art/" + toast.art + ".webp", alt: "" }),
      toast.sub ? ce("span", null, ce("b", null, toast.text), ce("small", null, toast.sub)) : ce("span", null, toast.text),
      toast.undo && ce("button", { className: "toast-undo", onClick: toast.undo }, "Undo"),
      toast.act && ce("button", { className: "toast-undo", onClick: toast.act.fn }, toast.act.label))));
}

// ── Home ──────────────────────────────────────────────────────────
function groupStats(s, gid) {
  const games = Object.values(s.games).filter(g => g.groupId === gid && g.status === "done").sort((a, b) => b.endedAt - a.endedAt);
  const wins = {}; games.forEach(g => { const r = rankOf(g), best = r[0].total; r.filter(x => x.total === best).forEach(x => { wins[x.id] = (wins[x.id] || 0) + 1; }); });
  const live = Object.values(s.games).find(g => g.groupId === gid && g.status === "live");
  return { games, wins, live };
}
const ago = t => { if (!t) return ""; const d = Math.floor((now() - t) / 864e5); return d < 1 ? "today" : d === 1 ? "yesterday" : d < 7 ? d + " days ago" : new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
function Avatars({ players, size }) { return ce("span", { className: "avs" }, players.slice(0, 4).map(p => ce(Peg, { key: p.id, color: p.color, name: p.name, av: p.avatar, size: size || 30 }))); }
function Home({ s, open, go, onFirst }) {
  const groups = s.groupOrder.map(id => s.groups[id]).filter(Boolean);
  if (!groups.length) return ce(FirstRun, { onDeal: onFirst, go, open });
  const lives = groups.map(g => ({ g, game: groupStats(s, g.id).live })).filter(x => x.game);
  const cur = lives.slice().sort((a, b) => (b.game.updatedAt || 0) - (a.game.updatedAt || 0))[0];
  const doneGames = Object.values(s.games).filter(g => g.status === "done" && s.groups[g.groupId]).sort((a, b) => b.endedAt - a.endedAt);
  const lastAtActive = cur && doneGames.find(g => g.groupId === cur.g.id || (s.groups[g.groupId] && s.groups[g.groupId].name.trim().toLowerCase() === cur.g.name.trim().toLowerCase()));
  const last = lastAtActive || doneGames[0];
  // "New game" is another game for a table that already exists, so the button names the table: the one played at most recently.
  const lastAny = Object.values(s.games).filter(g => s.groups[g.groupId]).sort((a, b) => (b.updatedAt || b.endedAt || 0) - (a.updatedAt || a.endedAt || 0))[0], nextT = lastAny ? s.groups[lastAny.groupId] : groups[groups.length - 1];
  return ce("div", { className: "kit kscreen khome" },
    ce("div", { className: "ph-nav lc-brand" }, ce("img", { className: "lc-mark", src: "art/logo-emblem.webp", alt: "", decoding: "async" }), ce("h1", { className: "lbl" }, "May I?")),
    ce("main", { className: "ph-body lc-pad lc-home" + (lives.length ? " busy" : "") },
      lives.map(({ g, game }) => { const pl = plOf(g, game), tt = ROUNDS.some((_, i) => roundDone(game, i)) ? [...totalsOf(game)].sort((a, b) => a.total - b.total) : [], lead = tt[0] && !(tt[1] && tt[1].total === tt[0].total) ? pl(tt[0].id) : null;
        const lav = lead && avOf(lead.avatar, lead.name), lcard = lav && lav.type === "card" && cardOfAv(lav.card);
        return ce("button", { key: game.id, className: "now lc-now2" + (lcard ? " has-card" : ""), onClick: () => { haptic(8); go({ at: "game", gameId: game.id }); }, "aria-label": "Resume " + g.name + ": round " + (game.round + 1) + " of 7, " + ROUNDS[game.round].name },
          ce("span", { className: "live" }, "Playing now"),
          ce("span", { className: "name" }, g.name),
          ce("span", { className: "meta" }, "Round " + (game.round + 1) + " of 7 · ", ce("b", null, ROUNDS[game.round].name)),
          tt.length > 0 && ce("span", { className: "meta lc-nowlead" }, lead && ce("img", { src: "art/crown.webp", alt: "" }), lead ? lead.name + " leads" : "All square"),
          lcard && ce("span", { className: "lc-now-c", "aria-hidden": true }, ce(DeckCard, faceProps(lav.card))),
          ce("span", { className: "foot" }, ce("span", { className: "avs" }, game.players.slice(0, 6).map(id => ce(Tok, { key: id, p: pl(id) }))), ce("span", { className: "grow" }),
            ce("span", { className: "lc-resume" }, "Resume", kIcon("chev", "chev")))); }),
      // Tables lead (owner's call, 22 Nov): a returning table finds itself first. The last game sits under the tables.
      // Tables with a game under way sit above as Playing now; the rest are "Your tables", each with a Finished stamp on its last game (owner, 24 Nov).
      ce("div", { className: "lc-hact" }, ce("h2", { className: "lc-h" }, lives.length ? "Your tables" : groups.length === 1 ? "The table" : "Tables"),
        ce("button", { className: "qp", onClick: () => go({ at: "newtable" }) }, kIcon("plus"), "New table")),
      ce("div", { className: "lc-tables" },
        groups.filter(g => !lives.some(x => x.g.id === g.id)).map((g, i) => { const st = groupStats(s, g.id), board = Object.entries(st.wins).sort((a, b) => b[1] - a[1]);
          const champ = board[0] && !(board[1] && board[1][1] === board[0][1]) && g.players.find(p => p.id === board[0][0]);
          const av = champ && avOf(champ.avatar, champ.name), card = av && av.type === "card" && cardOfAv(av.card);
          const line = champ ? champ.name + " holds it · " + stPlural(board[0][1], "win") : st.games.length ? stPlural(st.games.length, "game") + " · all square" : st.live ? "First game under way" : stPlural(g.players.length, "player");
          const lastG = Object.values(s.games).filter(x => x.groupId === g.id && x.status === "done").sort((a, b) => b.endedAt - a.endedAt)[0];
          const lw = lastG && (() => { const r = rankOf(lastG), top = r.filter(x => x.total === r[0].total), lp = plOf(g, lastG); return (top.length > 1 ? "shared" : lp(top[0].id).name + " won") + " · " + ago(lastG.endedAt); })();
          return ce("div", { key: g.id, className: "lc-tcard" },
            ce("button", { className: "blk " + LOOK_TILE[tableLook(g)].blk, onClick: () => go({ at: "group", groupId: g.id }), "aria-label": g.name + ": " + line + (lw ? ". Last game finished, " + lw : "") + ". Open the table" },
              ce("span", { className: "lc-tt" }, ce("b", null, g.name), ce("small", null, line), lw && ce("small", { className: "lc-tlast" }, ce("span", { className: "lc-stamp" }, "Finished"), lw)),
              ce("span", { className: "avs" }, g.players.slice(0, 4).map(p => ce(Tok, { key: p.id, p }))),
              champ && (card ? ce("span", { className: "lc-champ-c", "aria-hidden": true }, ce(DeckCard, faceProps(av.card))) : ce(Tok, { p: champ, cls: "lc-champ-t" })),
              champ && ce("img", { className: "lc-crown", src: "art/crown.webp", alt: "" })),
            ); })),
      last && ce(LastGame, { s, game: last, go, withTable: true, activeGroup: cur ? cur.g : null }),),
    ce("div", { className: "ph-dock lc-dock-home" + (lives.length ? " bare" : "") },
      // One main action: while a game is going, its card is the way back in, so the dock is only the tabs. Otherwise: start one.
      !lives.length && ce("button", { className: "kb", onClick: () => open("newgame", { groupId: nextT.id }) }, nextT.name.length <= 15 ? "New game at " + nextT.name : "New game"),
      ce(KTabs, { at: "home", go })));
}
// A die that shows a face, so a roll can be watched: the pips change with every tumble and settle on the last one.
const DIE_PIPS = [null, [[12, 12]], [[9, 9], [15, 15]], [[9, 9], [12, 12], [15, 15]], [[9, 9], [15, 9], [9, 15], [15, 15]], [[9, 9], [15, 9], [12, 12], [9, 15], [15, 15]], [[9, 8.6], [15, 8.6], [9, 12], [15, 12], [9, 15.4], [15, 15.4]]];
function KDie({ n }) {
  const f = DIE_PIPS[n] ? n : 3;
  return ce("svg", { className: "kdie", viewBox: "0 0 24 24", "aria-hidden": true }, ce("rect", { x: 4, y: 4, width: 16, height: 16, rx: 4, fill: "none", stroke: "currentColor", strokeWidth: 2 }),
    DIE_PIPS[f].map(([x, y], i) => ce("circle", { key: f + "-" + i, cx: x, cy: y, r: f === 6 ? 1.25 : 1.4, fill: "currentColor" })));
}
const dieNext = f => { let n = f; while (n === f) n = 1 + Math.floor(Math.random() * 6); return n; };
// Table names dealt from the game's own words, so a new table has a name with some life in it from the first hand. Anyone can type their own.
const TN_ADJ = ["Wild", "Lucky", "Cheeky", "Merry", "Crafty", "Sly", "Golden", "Midnight", "Steady", "Daring", "Jolly", "Nimble"];
const TN_NOUN = ["Jokers", "Kings", "Queens", "Jacks", "Aces", "Sevens", "Dealers", "Buyers", "Shufflers", "Wildcards", "Hearts", "Spades", "Diamonds", "Clubs"];
const TN_FIXED = ["The May I? Society", "Three of a Kind", "The Last Discard", "The Going Out Gang", "Penalty Card Club", "The Clean Hands Club", "Round Seven Regulars", "Two Decks and Tea",
  "The Run Makers", "The Set Collectors", "Jokers and Friends", "The Second Deck", "One More Round", "The Late Buyers", "May I? Maybe Not", "The Seven Rounders"];
function dealTableName(taken) {
  const pick = a => a[Math.floor(Math.random() * a.length)], used = taken || [];
  for (let k = 0; k < 40; k++) { const n = Math.random() < .4 ? pick(TN_FIXED) : "The " + pick(TN_ADJ) + " " + pick(TN_NOUN); if (!used.includes(n)) return n; }
  return "The " + pick(TN_ADJ) + " " + pick(TN_NOUN);
}
// A table's name field, with a die that deals a themed name into it.
function KNameField({ id, label, value, onChange, taken, placeholder, onEnter }) {
  const [spin, setSpin] = useState(0), [face, setFace] = useState(3), ts = useRef([]);
  useEffect(() => () => ts.current.forEach(clearTimeout), []);
  const deal = () => { haptic(8); sound("tap"); setSpin(x => x + 1); onChange(dealTableName((taken || []).concat(value ? [value] : [])));
    ts.current.forEach(clearTimeout); setFace(dieNext); ts.current = reducedMotion() ? [] : [90, 180, 270, 360].map(ms => setTimeout(() => setFace(dieNext), ms)); };
  return ce("div", { className: "kfield kname" }, ce("label", { htmlFor: id }, label),
    ce("div", { className: "kname-row" },
      ce("input", { id, value, maxLength: 30, placeholder, enterKeyHint: "done", autoComplete: "off", onChange: e => onChange(e.target.value), onKeyDown: e => e.key === "Enter" && onEnter && (e.preventDefault(), onEnter()) }),
      ce("button", { type: "button", className: "ib cream kname-die", onClick: deal, "aria-label": "Deal a name for the table" }, ce("span", { key: spin, className: spin ? "roll" : "" }, ce(KDie, { n: face })))));
}
// The plus beside an "add a player" field is a real button: empty, it puts the cursor in the field; with a name typed, it adds them.
function KAddPlus() {
  const tap = e => { const f = e.currentTarget.form, inp = f && f.querySelector("input"); if (!inp) return;
    if (inp.value.trim()) { f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); } else inp.focus(); };
  return ce("button", { type: "button", className: "pe-plus", "aria-label": "Add a player", onMouseDown: e => e.preventDefault(), onClick: tap }, kIcon("plus"));
}
// The crest is the hero, four court cards fanned behind it. A tap fans them wider, the way you'd check a hand.
const HOME_FAN = [["K", "spade", -50], ["Q", "heart", -17], ["J", "diamond", 17], [null, null, 50]];
// The crest with its fan, large: the first thing a new table sees. A tap fans the cards for a moment.
function HomeHero() {
  const [spread, setSpread] = useState(false), t = useRef(0);
  const fan = () => { clearTimeout(t.current); setSpread(true); haptic(6); t.current = setTimeout(() => setSpread(false), 700); };
  useEffect(() => () => clearTimeout(t.current), []);
  return ce("div", { className: "lc-hero" + (spread ? " spread" : ""), onPointerDown: fan },
    ce("div", { className: "lc-fan", "aria-hidden": true }, HOME_FAN.map(([r, su, a], i) => ce(DeckCard, { key: i, joker: !r, rank: r, suit: su, style: { "--r": a + "deg", "--i": i } }))),
    ce("h1", { className: "lc-h1" }, ce("img", { className: "lc-crest", src: "art/logo-emblem.webp", alt: "May I?", decoding: "async" })));
}
// The last game, kept together: the winner's own card under the crown and how it was won, then every award that game handed out, each with the face and name of who took it.
// It opens that game's results. Play shows the most recent game anywhere; a table's page shows its own.
function LastGame({ s, game, go, withTable, activeGroup }) {
  const lg = s.groups[game.groupId], pl = plOf(lg, game), r = rankOf(game), best = r[0].total, top = r.filter(x => x.total === best), next = r.find(x => x.total > best);
  const nm = top.map(t => pl(t.id).name), w = pl(top[0].id), av = avOf(w.avatar, w.name), card = av.type === "card" && cardOfAv(av.card);
  const isSameTable = !!(activeGroup && lg && (activeGroup.id === lg.id || activeGroup.name.trim().toLowerCase() === lg.name.trim().toLowerCase()));
  const title = top.length > 1 ? nm.join(" and ") + " shared it" : nm[0] + " won" + (next ? " by " + (next.total - best) : ""), sub = (withTable ? lg.name + " · " : "") + ago(game.endedAt);
  const aws = gameAwards(game).map(a => ({ a, A: AWARDS[a.key] || {}, p: pl(a.id) })).filter(x => x.A.art).sort((x, y) => (y.a.id === top[0].id) - (x.a.id === top[0].id));
  return ce("section", { className: "lc-lastgame", "aria-label": isSameTable ? "Last game at " + lg.name : "Last game" },
    ce("div", { className: "lc-last-head" },
      ce("h2", { className: "lc-h" }, isSameTable ? "Last game at " + lg.name : "Last game"),
      isSameTable && ce("span", { className: "lc-last-pill" }, "Active table")),
    ce("button", { className: "lc-moment", onClick: () => go({ at: "recap", gameId: game.id }), "aria-label": title + ". " + sub + ". See the results" },
      ce("span", { className: "lc-mo-art", "aria-hidden": true }, card ? ce(DeckCard, faceProps(av.card)) : ce(Tok, { p: w, cls: "lc-mo-tok" }), ce("img", { className: "lc-mo-crown", src: "art/crown.webp", alt: "" })),
      ce("span", { className: "lc-mo-t" }, ce("b", null, title), ce("small", null, sub)),
      kIcon("chev", "chev")),
    // Awards that night: the three rarest as labelled rows, and the rest on Results (owner, 24 Nov: the sideways strip didn't say what it was).
    aws.length > 0 && ce("div", { className: "lc-awn" }, ce("h3", { className: "lc-awh" }, "Awards that night"),
      ce("ul", { className: "lc-awl" }, [...aws].sort((x, y) => (y.A.r || 0) - (x.A.r || 0)).slice(0, 3).map(({ a, A, p }) =>
        ce("li", { key: a.key + ":" + a.id }, ce("img", { src: "art/icons/" + A.art + ".webp", alt: "", width: 40, height: 40 }),
          ce("span", { className: "grow" }, ce("b", null, A.t || a.t), ce("small", null, (a.d || A.how || "").replace(/\.$/, ""))),
          ce("span", { className: "lc-awwho" }, ce(Tok, { p }), p.name)))),
      aws.length > 3 && ce("button", { className: "link lc-awall", onClick: () => go({ at: "recap", gameId: game.id }) }, "All " + aws.length + " awards")));
}
// The opening: the crest arrives and the fan deals out behind it, then the crest settles into Play's corner. About a second, once a visit. A tap skips it.
const INTRO_KEY = "mayi:intro";
const introDue = () => { try { return !sessionStorage.getItem(INTRO_KEY) && !reducedMotion(); } catch (e) { return false; } };
function Splash({ onDone }) {
  const [out, setOut] = useState(false), [step, setStep] = useState(0), me = useRef(null), left = useRef(false);
  const leave = () => { if (left.current) return; left.current = true;
    const el = me.current, m = document.querySelector(".kfirst .lc-hero .lc-crest") || document.querySelector(".lc-mark"), c = el && el.querySelector(".lc-crest");
    if (m && c) { const a = c.getBoundingClientRect(), b = m.getBoundingClientRect();
      el.style.setProperty("--tx", (b.left + b.width / 2 - a.left - a.width / 2).toFixed(1) + "px"); el.style.setProperty("--ty", (b.top + b.height / 2 - a.top - a.height / 2).toFixed(1) + "px");
      el.style.setProperty("--ts", (b.width / a.width).toFixed(3)); el.classList.add("lands"); }
    setOut(true); setTimeout(onDone, 480); };
  // The bar is honest: it fills as the lettering and the art arrive, and the opening leaves once they have and the cards have been dealt out. It never waits more than four seconds.
  useEffect(() => { try { sessionStorage.setItem(INTRO_KEY, "1"); } catch (e) {}
    let live = true; const wait = ms => new Promise(r => setTimeout(r, ms)), c = me.current && me.current.querySelector(".lc-crest");
    const fonts = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => live && setStep(x => Math.max(x, 1)));
    const art = (c && c.decode ? c.decode().catch(() => {}) : Promise.resolve()).then(() => live && setStep(x => Math.max(x, 1)));
    Promise.race([Promise.all([fonts, art, wait(1100)]), wait(4000)]).then(() => { if (!live) return; setStep(2); setTimeout(leave, 260); });
    addEventListener("keydown", leave); return () => { live = false; removeEventListener("keydown", leave); }; }, []);
  return ce("div", { ref: me, className: "kit ksplash" + (out ? " out" : ""), onPointerDown: leave },
    ce("div", { className: "lc-hero", role: "img", "aria-label": "May I?" },
      ce("div", { className: "lc-fan", "aria-hidden": true }, HOME_FAN.map(([r, su, a], i) => ce(DeckCard, { key: i, joker: !r, rank: r, suit: su, style: { "--r": a + "deg", "--i": i } }))),
      ce("img", { className: "lc-crest", src: "art/logo-emblem.webp", alt: "" })),
    ce("div", { className: "sp-load s" + step, role: "progressbar", "aria-label": "Getting the table ready", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": [30, 70, 100][step] },
      ce("i", null), ce("span", null, ["Shuffling the deck", "Dealing the cards", "Ready"][step])));
}
// The kit's tab bar: Learn, Play and Stats, each with its own art. The current room lifts and wears the gold pip.
const KTAB_ORDER = [["learn", "rules", "Learn"], ["home", "play", "Play"], ["stats", "trophy", "Stats"], ["settings", "settings", "Settings"]];
function KTabs({ at, go, sub }) {
  return ce("nav", { className: "tabbar", "aria-label": "Main" }, KTAB_ORDER.map(([k, art, label]) =>
    ce("button", { key: k, className: "tab", "aria-current": at === k ? "page" : undefined, onClick: () => (at !== k || sub) && go({ at: k }) },
      ce("img", { src: "art/icons/" + art + ".webp", alt: "", width: 48, height: 48, decoding: "async" }), label)));
}
// Seating a table: names, and a face dealt the moment each is typed. The Play tab shows this until a table exists;
// "New table" is the same screen with a way back. Either way it deals straight into round one.
const FIRST_KEY = "mayi:first";
function FirstRun({ onDeal, go, open, sub, taken }) {
  // Names typed so far are kept for the visit, so the guide, a reload or a wrong turn never costs them.
  const saved = useRef(null);
  if (!saved.current) { try { const v = JSON.parse(sessionStorage.getItem(FIRST_KEY) || "null"), ps = v && Array.isArray(v.players) ? v.players.filter(p => p && p.id && typeof p.name === "string").slice(0, MAX_PLAYERS) : []; saved.current = { players: ps, deal: v && ps.some(p => p.id === v.deal) ? v.deal : null, rules: v && v.rules && typeof v.rules === "object" ? v.rules : null }; } catch (e) { saved.current = { players: [], deal: null, rules: null }; } }
  const [players, setPlayers] = useState(saved.current.players);
  const [draft, setDraft] = useState(""), [editing, setEditing] = useState(null), [deal, setDeal] = useState(saved.current.deal), [rolling, setRolling] = useState(false), [dface, setDface] = useState(3);
  const [rules, setRules] = useState(() => ({ ...DEFAULT_RULES, ...(saved.current.rules || {}) })), [house, setHouse] = useState(false);
  useEffect(() => { try { sessionStorage.setItem(FIRST_KEY, JSON.stringify({ players, deal, rules })); } catch (e) {} }, [players, deal, rules]);
  const ref = useRef(null), ready = players.filter(p => p.name.trim()), ed = players.find(p => p.id === editing);
  const dealer = ready.find(p => p.id === deal) || ready[0] || null, two = ready.length >= 2;
  const face = (name, others) => avSeed(name || "?", heldFaces(others));
  const addName = v => { const n = v.slice(0, 20); if (!n.trim() || players.length >= MAX_PLAYERS || sameName(players, n)) return setDraft(n);
    const used = players.map(p => p.color); haptic(8); sound("chip");
    setPlayers([...players, { id: uid(), name: n, color: (PEGS.find(c => !used.includes(c.k)) || PEGS[players.length % 8]).k, avatar: face(n, players) }]); setDraft(""); };
  const rename = (id, v) => setPlayers(players.map(p => p.id === id ? { ...p, name: v.slice(0, 20), avatar: v.trim() && !p.keep ? face(v, players.filter(q => q.id !== id)) : p.avatar } : p));
  // The first name typed deals. The D passes round the table one seat a tap, or the die picks for the table.
  const pass = () => { if (rolling || !two) return; haptic(6); sound("tap"); setDeal(ready[(ready.indexOf(dealer) + 1) % ready.length].id); };
  const roll = () => { if (rolling || !two) return; setRolling(true); const ids = ready.map(p => p.id), end = Math.floor(Math.random() * ids.length), hops = reducedMotion() ? 0 : ids.length * 2 + end; let n = 0;
    const step = () => { setDeal(ids[n % ids.length]); setDface(dieNext); sound("tap"); if (n++ < hops) setTimeout(step, 60 + n * 12); else { setDeal(ids[end]); setRolling(false); sound("chip"); haptic(12); } }; step(); };
  // Seats follow the list. The dots drag a player up or down; the arrow keys do the same.
  // The deal stays with the person who has it, wherever they end up sitting.
  const moveTo = (i, to) => { if (to === i || to < 0 || to >= players.length) return; const a = players.slice(), x = a.splice(i, 1)[0]; a.splice(to, 0, x); if (deal == null && dealer) setDeal(dealer.id); setPlayers(a); haptic(8); };
  const grip = (i, nm) => ce("button", { type: "button", className: "lr-grip lc-grip", "aria-label": "Move " + nm + ". Use the arrow keys to change seats",
      onKeyDown: e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); moveTo(i, i + (e.key === "ArrowUp" ? -1 : 1)); } },
      onPointerDown: e => { const li = e.currentTarget.closest(".lc-name"), y0 = e.clientY, h = li.getBoundingClientRect().height + 8, btn = e.currentTarget; let to = i;
        btn.setPointerCapture(e.pointerId); li.classList.add("lifting");
        const mv = ev => { const dy = ev.clientY - y0; li.style.transform = "translateY(" + dy + "px)"; to = Math.max(0, Math.min(players.length - 1, i + Math.round(dy / h))); };
        const up = () => { li.style.transform = ""; li.classList.remove("lifting"); btn.removeEventListener("pointermove", mv); btn.removeEventListener("pointerup", up); btn.removeEventListener("pointercancel", up); moveTo(i, to); };
        btn.addEventListener("pointermove", mv); btn.addEventListener("pointerup", up); btn.addEventListener("pointercancel", up); } },
    ce("svg", { viewBox: "0 0 18 18", "aria-hidden": true }, ce("g", { fill: "currentColor" }, [[6, 4], [12, 4], [6, 9], [12, 9], [6, 14], [12, 14]].map(([x, y], k) => ce("circle", { key: k, cx: x, cy: y, r: 1.6 })))));
  const label = two ? "Deal the first hand" : ready.length === 1 ? "Add one more name" : "Add two names to start";
  const start = () => { try { sessionStorage.removeItem(FIRST_KEY); } catch (e) {} onDeal(dealTableName(taken), ready.map(({ keep, ...p }) => ({ ...p, name: p.name.trim() })), Math.max(0, ready.indexOf(dealer)), rules); };
  return ce("div", { className: "kit kscreen kfirst" + (sub ? " ksub" : "") },
    sub ? ce("div", { className: "ph-nav" }, ce("button", { className: "ib", onClick: () => go({ at: "home" }), "aria-label": "Back to home" }, kIcon("chevl")), ce("span", { className: "lbl" }, "Home"))
      : null,
    ce("main", { className: "ph-body lc-pad lc-first" + (players.length ? " started" : "") },
      !sub && ce(HomeHero),
      ce(sub ? "h1" : "h2", { className: "lc-firsth" }, sub ? "A new table" : "Pull up a chair."),
      ce("p", { className: "lc-lede", "aria-hidden": players.length ? true : undefined }, sub ? "Everyone who plays here. The table gets its name after the first game." : "Seven rounds, each with its own goal. Lowest score wins."),
      ce("div", { className: "lc-who" },
        ce("div", { className: "lc-whoh" }, ce("h3", null, "Who's playing?"),
          two && ce("button", { type: "button", className: "qp" + (rolling ? " rolling" : ""), onClick: roll, disabled: rolling }, ce(KDie, { n: dface }), rolling ? "Rolling…" : "Roll for dealer")),
        players.map((p, i) => { const nm = p.name.trim() || "this player", isD = two && dealer && dealer.id === p.id, nx = isD && ready[(ready.indexOf(dealer) + 1) % ready.length];
          return ce("div", { key: p.id, className: "lc-name" + (isD ? " deals" : "") + (players.length > 1 ? " grips" : "") },
            players.length > 1 && grip(i, nm),
            ce("button", { type: "button", className: "lc-face", onClick: () => setEditing(p.id), "aria-label": "Change " + nm + "'s face: card, photo or colour" },
              ce(Tok, { p, cls: "lc-face-in" }), ce("span", { className: "pe-badge", "aria-hidden": true }, kIcon("hanger"))),
            ce("input", { className: "nm", value: p.name, maxLength: 20, "aria-label": (p.name.trim() || "Player") + "'s name", onChange: e => rename(p.id, e.target.value),
              onBlur: () => !p.name.trim() && setPlayers(players.filter(q => q.id !== p.id)) }),
            isD && ce("button", { key: "d" + p.id, type: "button", className: "lc-dtag", onClick: pass, disabled: rolling, "aria-label": nm + " deals first. Pass the deal to " + nx.name.trim() },
              ce("span", { className: "dl", "aria-hidden": true }, "D"), "Deals first")); }),
        players.length < MAX_PLAYERS && ce("form", { className: "lc-name lc-empty", onSubmit: e => { e.preventDefault(); addName(draft); } },
          ce("button", { type: "button", className: "lc-plus", "aria-label": draft.trim() ? "Add " + draft.trim() : "Add a player", onMouseDown: e => e.preventDefault(), onClick: () => draft.trim() ? addName(draft) : ref.current && ref.current.focus() }, kIcon("plus")),
          ce("input", { ref, className: "nm", value: draft, maxLength: 20, placeholder: players.length ? "Add a name" : "Who's first? Then the rest", "aria-label": "Add a player's name", enterKeyHint: "next",
            onChange: e => setDraft(e.target.value), onBlur: () => draft.trim() && addName(draft) })),
        sameName(players, draft) && ce("p", { className: "dupe", role: "status" }, "There's already a " + draft.trim() + ". Add an initial, like " + draft.trim() + " B."),
        players.length > 0 && ce("p", { className: "lc-facehint" }, two ? "Drag the dots to match the seats. Tap a face to change it, or the D to pass the deal." : "Tap a face to change it.")),
      // The table's rules, agreed before the first deal as they would be at the table. The usual ones are already set.
      ce("button", { type: "button", className: "lc-hrow lc-rulesrow", onClick: () => setHouse(true) }, ce("img", { src: "art/icons/dealerschoice.webp", alt: "" }),
        ce("span", null, ce("b", null, "House rules"), ce("small", null, rulesShort(rules))), kIcon("chev")),),
    ce("div", { className: "ph-dock lc-dock-home" }, ce("button", { className: "kb", disabled: !two || rolling, onClick: start }, label),
      ce(KTabs, { at: "home", go, sub })),
    house && ce(HouseSheet, { onClose: () => setHouse(false), rules, setRules, note: "These are this table's rules. They can still change during a game, from its menu." }),
    ed && ce(AvatarSheet, { player: ed, taken: players.filter(q => q.id !== ed.id).map(q => q.color), onClose: () => setEditing(null),
      onSave: (color, avatar) => { setPlayers(players.map(p => p.id === ed.id ? { ...p, color, avatar, keep: true } : p)); setEditing(null); } }));
}
// House rules in a line, the way the table would say them.
const rulesShort = r => ["Aces " + acePoints(r), r.jokersWild ? "Jokers wild" : "No jokers", r.twosWild ? "2s wild" : null, r.buyLimit === "unlimited" ? "No buy limit" : buyLimitOf(r) + (buyLimitOf(r) === 1 ? " buy" : " buys") + " a round"].filter(Boolean).join(" · ");
// New game, in one sheet: the table's faces dealt in, the dealer's D, house rules folded into a row.
// The first deal moves left from game to game, like passing the deck: the player after last game's first dealer, among those playing.
function nextDealer(group, sel, last) {
  if (!last || !last.players || !last.players.length) return null;
  const was = last.players[(last.dealer || 0) % last.players.length], ids = group.players.map(p => p.id), i = ids.indexOf(was);
  if (i < 0) return null;
  for (let k = 1; k <= ids.length; k++) { const id = ids[(i + k) % ids.length]; if (sel.includes(id)) return id; }
  return null;
}
function NewGameSheet({ s, groupId, rules: r0, onClose, onStart, onResume, onNewTable, onAddPlayer, onFace }) {
  const tables = s.groupOrder.map(id => s.groups[id]).filter(Boolean);
  const recent = () => { const gs = Object.values(s.games).filter(g => s.groups[g.groupId]).sort((a, b) => (b.updatedAt || b.endedAt || 0) - (a.updatedAt || a.endedAt || 0)); return gs[0] ? gs[0].groupId : tables[tables.length - 1].id; };
  const [gid, setGid] = useState(() => groupId && s.groups[groupId] ? groupId : recent());
  const group = s.groups[gid] || tables[0], st = groupStats(s, group.id);
  const [sel, setSel] = useState(() => group.players.slice(0, MAX_PLAYERS).map(p => p.id)), [dealer, setDealer] = useState(null);
  const [rules, setRules] = useState(() => ({ ...DEFAULT_RULES, ...(group.rules || r0 || (st.games[0] && st.games[0].rules) || {}) }));
  const [pick, setPick] = useState(false), [showRules, setShowRules] = useState(false), [adding, setAdding] = useState(false), [draft, setDraft] = useState(""), [rolling, setRolling] = useState(false), [dface, setDface] = useState(3);
  const hold = useRef(0), held = useRef(false);
  const auto = nextDealer(group, sel, st.games[0]);
  const chosen = group.players.filter(p => sel.includes(p.id)), dId = chosen.some(p => p.id === dealer) ? dealer : auto || (chosen[0] && chosen[0].id), dp = chosen.find(p => p.id === dId);
  const switchTo = t => { const ts = groupStats(s, t.id); setGid(t.id); setSel(t.players.slice(0, MAX_PLAYERS).map(p => p.id)); setDealer(null); setRules({ ...DEFAULT_RULES, ...(t.rules || (ts.games[0] && ts.games[0].rules) || {}) }); setPick(false); haptic(8); };
  const toggle = id => { if (held.current) { held.current = false; return; } haptic(6); setSel(x => x.includes(id) ? x.filter(i => i !== id) : x.length >= MAX_PLAYERS ? x : [...x, id]); };
  // Press and hold a face to make them the dealer.
  const press = id => { held.current = false; clearTimeout(hold.current); hold.current = setTimeout(() => { held.current = true; setSel(x => x.includes(id) || x.length >= MAX_PLAYERS ? x : [...x, id]); setDealer(id); haptic(14); sound("chip"); }, 450); };
  const release = () => clearTimeout(hold.current);
  useEffect(() => () => clearTimeout(hold.current), []);
  const roll = () => { if (rolling || chosen.length < 2) return; setRolling(true); const ids = chosen.map(p => p.id), end = Math.floor(Math.random() * ids.length), hops = reducedMotion() ? 0 : ids.length * 2 + end; let n = 0;
    const step = () => { setDealer(ids[n % ids.length]); setDface(dieNext); sound("tap"); if (n++ < hops) setTimeout(step, 60 + n * 12); else { setDealer(ids[end]); setRolling(false); sound("chip"); haptic(12); } }; step(); };
  const [fresh, setFresh] = useState(null), [facing, setFacing] = useState(false);
  const add = e => { e.preventDefault(); const n = draft.trim(); if (!n) return; const id = onAddPlayer(group.id, n); setSel(x => x.length >= MAX_PLAYERS ? x : [...x, id]); setDraft(""); setAdding(false); setFresh(id); };
  const passDeal = () => { if (rolling || chosen.length < 2) return; haptic(6); sound("tap"); setDealer(chosen[(chosen.findIndex(p => p.id === dId) + 1) % chosen.length].id); };
  const newP = fresh && group.players.find(p => p.id === fresh);
  const live = st.live;
  const foot = live ? ce("button", { className: "kb", onClick: () => onResume(live) }, "Resume round " + (live.round + 1))
    : ce("button", { className: "kb", disabled: chosen.length < 2, onClick: () => onStart(group.id, chosen.map(p => p.id), Math.max(0, chosen.findIndex(p => p.id === dId)), rules) },
        chosen.length >= 2 ? "Deal round 1" : chosen.length ? "Pick one more player" : "Pick two players");
  if (facing && newP) return ce(AvatarSheet, { player: newP, taken: group.players.filter(q => q.id !== newP.id).map(q => q.color), onClose: () => setFacing(false),
    onSave: (color, avatar) => { onFace(group.id, newP.id, color, avatar); setFacing(false); } });
  return ce(KSheet, { title: "New game", onClose, cls: "ng-sheet", foot },
    ce("p", { className: "lr-dealrow" }, ce("span", null, "At ", ce("b", null, group.name)),
      ce("button", { className: "link ink", onClick: () => setPick(!pick), "aria-expanded": pick }, pick ? "Keep " + group.name : "Change table")),
    pick ? ce("div", { className: "gm-list ng-tables" },
        tables.map(t => { const ts = groupStats(s, t.id);
          return ce("button", { key: t.id, className: "gm-row" + (t.id === group.id ? " on" : ""), onClick: () => switchTo(t) },
            ce("span", { className: "ts-faces", "aria-hidden": true }, t.players.slice(0, 3).map(p => ce(Tok, { key: p.id, p }))),
            ce("span", { className: "gm-t" }, ce("b", null, t.name), ce("small", null, ts.live ? "Playing now · round " + (ts.live.round + 1) : stPlural(t.players.length, "player") + (ts.games.length ? " · " + stPlural(ts.games.length, "game") : ""))),
            kIcon("chevl", "gm-chev")); }),
        ce("button", { className: "gm-row", onClick: onNewTable }, ce("span", { className: "ng-plus sm", "aria-hidden": true }, kIcon("plus")),
          ce("span", { className: "gm-t" }, ce("b", null, "A new table"), ce("small", null, "New players and a fresh leaderboard")), kIcon("chevl", "gm-chev")))
    : live ? ce("p", { className: "fine ng-live" }, "A game is already going at " + group.name + ": round " + (live.round + 1) + " of 7, " + ROUNDS[live.round].name + ". Pick it back up, or change table.")
    : ce(Fragment, null,
      ce("div", { className: "ng-h" }, ce("h3", { className: "sub" }, "Who's playing"),
        ce("button", { className: "qp" + (rolling ? " rolling" : ""), onClick: roll, disabled: rolling || chosen.length < 2 }, ce(KDie, { n: dface }), rolling ? "Rolling…" : "Roll for dealer")),
      ce("div", { className: "ng-faces" + (rolling ? " rolling" : "") },
        group.players.map(p => { const on = sel.includes(p.id), dl = on && p.id === dId;
          return ce("button", { key: p.id, className: "ng-f" + (dl ? " dealer" : ""), "aria-pressed": on, "aria-label": p.name + (dl ? ", deals first" : "") + (on ? ", playing" : ", not playing"),
            onClick: () => toggle(p.id), onPointerDown: () => press(p.id), onPointerUp: release, onPointerLeave: release, onPointerCancel: release, onContextMenu: e => e.preventDefault() },
            ce("span", { className: "ng-t" }, ce(Tok, { p }), dl && ce("span", { className: "dl", "aria-hidden": true }, "D"), ce("span", { className: "ng-ok", "aria-hidden": true }, kIcon("tick"))),
            ce("b", null, p.name)); }),
        !adding && ce("button", { className: "ng-f ng-add", onClick: () => setAdding(true) }, ce("span", { className: "ng-t" }, ce("span", { className: "ng-plus" }, kIcon("plus"))), ce("b", null, "Add"))),
      adding && ce("form", { className: "prow pe-add ng-new", onSubmit: add }, ce(KAddPlus),
        ce("input", { className: "pe-in", value: draft, autoFocus: true, maxLength: 20, placeholder: "Their name", "aria-label": "New player's name", enterKeyHint: "done", onChange: e => setDraft(e.target.value) }),
        ce("button", { className: "qp", type: "submit", disabled: !draft.trim() }, "Add")),
      newP && onFace && ce("p", { className: "ng-fresh", role: "status" }, ce(Tok, { p: newP }), ce("span", null, ce("b", null, newP.name), " is in."),
        ce("button", { type: "button", className: "link ink", onClick: () => setFacing(true) }, "Change " + newP.name + "'s face")),
      dp && chosen.length >= 2 && ce("button", { type: "button", className: "lc-dtag ng-dtag", onClick: passDeal, disabled: rolling,
          "aria-label": dp.name + " deals first. Pass the deal to " + chosen[(chosen.findIndex(p => p.id === dId) + 1) % chosen.length].name },
        ce("span", { className: "dl", "aria-hidden": true }, "D"), ce("span", null, ce("b", null, dp.name), " deals first"), ce("small", null, "Pass the deal")),
      ce("p", { className: "fine" }, dp ? "Tap a face to deal them in or out." : "Tap a face to deal them in.",
        sel.length >= MAX_PLAYERS ? " Up to " + MAX_PLAYERS + " can play." : ""),
      ce("button", { className: "prow ng-rules", "aria-expanded": showRules, onClick: () => setShowRules(!showRules) }, ce("img", { src: "art/icons/rules.webp", alt: "" }),
        ce("span", { className: "grow" }, ce("b", null, "House rules"), ce("small", null, rulesShort(rules))), kIcon("chev", "chev" + (showRules ? " open" : ""))),
      showRules && ce(KHouseRules, { rules, up: (k, v) => setRules(x => ({ ...x, [k]: v })) })));
}
function KSw({ on, onChange, label }) {
  return ce("button", { type: "button", className: "ksw", role: "switch", "aria-checked": !!on, "aria-label": label, onClick: () => { haptic(6); onChange(!on); } }, ce("span", { "aria-hidden": true }, on ? "ON" : "OFF"), ce("i"));
}
// Each rule says what it means right now, with the story behind it one tap away.
function KHouseRules({ rules, up }) {
  const [why, setWhy] = useState(null);
  const hint = k => ce("small", null, ruleHint(k, rules), " ",
    ce("button", { type: "button", className: "link ink hr-why", "aria-expanded": why === k, onClick: () => setWhy(why === k ? null : k) }, why === k ? "Hide" : "Why?"),
    why === k && ce("span", { className: "hr-whytext" }, RULE_WHY[k]));
  const seg = (k, title, val, opts, num) => ce("div", { className: "prow hr-row" }, ce("b", null, title), ce(KSeg, { label: title, value: val, onChange: v => up(k, num ? +v : v), options: opts }), hint(k));
  const sw = (k, title) => ce("div", { className: "prow hr-row hr-sw" }, ce("span", { className: "grow" }, ce("b", null, title), hint(k)), ce(KSw, { on: !!rules[k], onChange: v => up(k, v), label: title }));
  // Buys and points are steppers that are always there, so nothing appears or jumps; past 10 buys is No limit (owner, 24 Nov).
  const lim = buyLimitOf(rules), BUYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, Infinity];
  const setBuys = v => v === Infinity ? up("buyLimit", "unlimited") : v === 3 ? up("buyLimit", "3") : (up("customBuyLimit", v), up("buyLimit", "custom"));
  const ACES = [1, 5, 10, 15, 20, 25, 30, 40, 50], JOKERS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const step = (k, title, list, val, setV, say) => { const i = list.indexOf(val), at = i < 0 ? list.findIndex(x => x > val) : i;
    const go = d => { const j = i < 0 ? (d < 0 ? Math.max(0, at - 1) : Math.max(0, at)) : i + d; if (list[j] != null) { haptic(6); setV(list[j]); } };
    return ce("div", { className: "prow hr-row hr-step" }, ce("span", { className: "grow" }, ce("b", null, title), hint(k)),
      ce("div", { className: "kstep", role: "group", "aria-label": title },
        ce("button", { type: "button", className: "ib cream", disabled: at <= 0 && i <= 0, onClick: () => go(-1), "aria-label": "Less" }, kIcon("minus")),
        ce("b", { "aria-live": "polite" }, ce("span", { key: String(val), className: "kstep-n" }, say(val))),
        ce("button", { type: "button", className: "ib cream", disabled: i === list.length - 1 || (i < 0 && at < 0), onClick: () => go(1), "aria-label": "More" }, kIcon("plus")))); };
  return ce("div", { className: "hr-list" },
    step("buyLimit", "“May I?” buys a round", BUYS, lim, setBuys, v => v === Infinity ? "No limit" : v),
    sw("jokersWild", "Jokers wild"), sw("twosWild", "2s wild too"),
    seg("acesPosition", "Aces in runs", rules.acesPosition, [["low", "A-2-3-4"], ["high", "J-Q-K-A"], ["both", "Either"]]),
    step("aceValue", "Ace points", ACES, acePoints(rules), v => up("aceValue", v), v => v),
    step("jokerValue", "Joker points", JOKERS, wildPoints(rules), v => up("jokerValue", v), v => v));
}
// Each round deals the mini card in a new suit.
const ROUND_SUITS = ["heart", "spade", "diamond", "club"];
// Home's hand: three sevens and the Joker. A tap spreads it, the way you'd fan a hand to check it.
const HERO_HAND = [["7", "heart"], ["7", "spade"], ["7", "club"], null];

// ── Table (group) page ────────────────────────────────────────────
function GroupPage({ s, group, open, go }) {
  const liveG = Object.values(s.games).find(x => x.groupId === group.id && x.status === "live");
  const st = groupStats(s, group.id), games = st.games;
  const per = group.players.map(p => { const played = games.filter(g => g.players.includes(p.id)), tot = played.map(g => totalsOf(g).find(x => x.id === p.id).total);
    return { id: p.id, p, wins: st.wins[p.id] || 0, played: played.length, avg: tot.length ? Math.round(tot.reduce((a, b) => a + b, 0) / tot.length) : null, low: tot.length ? Math.min(...tot) : null,
      buys: played.reduce((a, g) => a + ROUNDS.reduce((b, _, i) => b + ((g.buys[i] || {})[p.id] || 0), 0), 0),
      outs: played.reduce((a, g) => a + ROUNDS.filter((_, i) => roundDone(g, i) && g.scores[i][p.id] === 0).length, 0) }; })
    .sort((a, b) => b.wins - a.wins || (a.avg ?? 1e9) - (b.avg ?? 1e9));
  const topWins = per[0] ? per[0].wins : 0, tops = per.filter(x => x.wins === topWins && topWins > 0), champ = tops.length === 1 ? tops[0] : null;
  // One line each, from what the table has seen.
  const last4 = games.slice(0, 4), lowHolder = per.filter(x => x.low != null).sort((a, b) => a.low - b.low)[0], buyHolder = per.filter(x => x.buys > 0).sort((a, b) => b.buys - a.buys)[0];
  const winnersOf = g => { const r = rankOf(g); return r.filter(x => x.total === r[0].total).map(x => x.id); };
  const hlOf = x => { const w4 = last4.filter(g => winnersOf(g).includes(x.id)).length, wonLast = games[0] && winnersOf(games[0]).includes(x.id), wonTwo = wonLast && games[1] && winnersOf(games[1]).includes(x.id);
    if (!x.played) return ["regular", "Yet to play here"];
    if (wonTwo) return ["backtoback", "Won the last two"];
    if (champ && champ.id === x.id && w4 >= 2) return ["crown", "Won " + w4 + " of the last " + last4.length];
    if (wonLast) return ["comeback", "Won the last game"];
    if (lowHolder && lowHolder.id === x.id && games.length > 1) return ["steady", "Lowest night · " + x.low];
    if (buyHolder && buyHolder.id === x.id && x.buys > 2) return ["mayi", "Most buys · " + x.buys];
    if (!x.wins) return ["goodsport", "First win to come"];
    return ["steady", "Averages " + x.avg]; };
  const rows = per.filter(x => x.played).map(x => { const [ic, hl] = hlOf(x); return { id: x.id, p: x.p, total: x.wins, ic, hl }; });
  const since = games.length ? new Date(games[games.length - 1].endedAt).toLocaleDateString(undefined, { month: "long" }) : null;
  const av = champ && avOf(champ.p.avatar, champ.p.name), card = av && av.type === "card" && cardOfAv(av.card);
  // Records, as paper tiles: the three the table would brag about.
  const rec = groupRecords(s, group.id), nm = id => plOf(group, null)(id).name, tiles = [];
  const outsTop = per.filter(x => x.outs > 0).sort((a, b) => b.outs - a.outs)[0];
  if (outsTop && games.length > 1) tiles.push(["out", outsTop.outs, outsTop.p.name + " went out most"]);
  const margins = games.map(g => { const t = rankOf(g).map(x => x.total); return t.length > 1 ? t[1] - t[0] : null; }).filter(v => v != null);
  if (margins.length > 1) tiles.push(["nailbiter", Math.min(...margins), "Closest night, in points"]);
  if (rec.longestStreak && rec.longestStreak.v > 1) tiles.push(["wiretowire", rec.longestStreak.v, nm(rec.longestStreak.id) + "'s longest run of wins"]);
  if (tiles.length < 3 && rec.lowestWin && games.length > 1) tiles.push(["trophy", rec.lowestWin.v, "Lowest winning score, " + rec.lowestWin.ids.map(nm).join(" & ")]);
  const short = group.players.length < 2;
  return ce("div", { className: "kit kscreen ktable" },
    ce("div", { className: "ph-nav" },
      ce("button", { className: "ib", onClick: () => go({ at: "home" }), "aria-label": "Back to home" }, kIcon("chevl")),
      ce("span", { className: "lbl" }, group.name), ce("span", { className: "sp" }),
      ce("button", { className: "ib", onClick: () => open("table", { groupId: group.id }), "aria-label": "Table settings" }, kIcon("gear"))),
    ce("main", { className: "ph-body lc-pad lt-body" },
      ce("section", { className: "lc-champ" + (champ ? "" : " none") },
        champ && ce("span", { className: "crown2", "aria-hidden": true }),
        champ ? (card ? ce("div", { className: "lc-hc" }, ce(DeckCard, faceProps(av.card))) : ce(Tok, { p: champ.p, cls: "lc-htok" }))
          : ce("img", { className: "lt-crown", src: "art/crown.webp", alt: "" }),
        ce("h1", null, champ ? champ.p.name + " holds the table" : tops.length > 1 ? tops.map(x => x.p.name).join(" and ") + " share the top" : liveG ? "First game under way" : "No champion yet"),
        ce("p", null, games.length ? ce(Fragment, null, ce("b", null, stPlural(topWins, "win")), (tops.length > 1 ? " each" : "") + " from " + stPlural(games.length, "game") + " since " + since + ".")
          : liveG ? "Round " + (liveG.round + 1) + " of 7. The winner becomes the table's first champion." : short ? "Seat two players to deal the first game." : "Deal the first game and the table crowns its first champion.")),
      rows.length ? ce(Leaderboard, { rows, hi: true, unit: n => n === 1 ? "win" : "wins", label: "Most wins at " + group.name, onPick: id => open("profile", { groupId: group.id, playerId: id }) })
        : ce("div", { className: "lt-seated" }, group.players.map(p => ce("span", { key: p.id, className: "lt-seat" }, ce(Tok, { p }), ce("b", null, p.name)))),
      per.some(x => !x.played) && rows.length > 0 && ce("p", { className: "lt-new" }, "Yet to play: " + per.filter(x => !x.played).map(x => x.p.name).join(", ") + "."),
      games.length > 0 && ce(LastGame, { s, game: games[0], go }),
      tiles.length > 0 && ce(Fragment, null, ce("h2", { className: "lc-sec" }, "Records"),
        ce("div", { className: "lc-tiles" }, tiles.slice(0, 3).map(([ic, v, t]) => ce("div", { key: t, className: "lc-tile" }, ce("img", { src: "art/icons/" + ic + ".webp", alt: "" }), ce("b", null, v), ce("small", null, t))))),
      games.length > 0 && ce(Fragment, null, ce("h2", { className: "lc-sec" }, "Past games"),
        ce("div", { className: "lc-past" }, games.slice(0, 25).map(g => { const r = rankOf(g), best = r[0].total, top = r.filter(x => x.total === best).map(x => plOf(group, g)(x.id)), next = r.find(x => x.total > best);
          return ce("button", { key: g.id, onClick: () => go({ at: "recap", gameId: g.id }) }, ce(Tok, { p: top[0] }),
            ce("b", null, new Date(g.endedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })),
            ce("small", null, top.length > 1 ? top.map(p => p.name).join(" & ") + " tied" : top[0].name + (next ? " won by " + (next.total - best) : " won")), kIcon("chevl", "lt-chev")); })))),
    ce("div", { className: "ph-dock lc-dock-home" }, st.live
      ? ce("button", { className: "kb", onClick: () => go({ at: "game", gameId: st.live.id }) }, "Resume round " + (st.live.round + 1) + " · " + ROUNDS[st.live.round].name)
      : short ? ce("button", { className: "kb", onClick: () => open("players", { groupId: group.id }) }, "Seat two players")
      : ce("button", { className: "kb", onClick: () => open("newgame", { groupId: group.id, rules: games[0] && games[0].rules }) }, "New game at this table"),
      ce(KTabs, { at: "home", go, sub: true })));
}
// Table records: the bragging rights.
function Records({ s, group }) {
  const r = groupRecords(s, group.id), name = id => plOf(group, null)(id).name, rows = [];
  if (r.lowestWin) rows.push(["trophy", "Lowest winning score", r.lowestWin.v, r.lowestWin.ids.map(name).join(" & ")]);
  if (r.mostOuts) rows.push(["out", "Most outs in one game", r.mostOuts.v, name(r.mostOuts.id)]);
  if (r.longestStreak && r.longestStreak.v > 1) rows.push(["bolt", "Longest win streak", r.longestStreak.v, name(r.longestStreak.id)]);
  const playedBy = id => Object.values(s.games).filter(g => g.groupId === group.id && g.status === "done" && g.players.includes(id)).length;
  if (r.mostGames && group.players.filter(p => playedBy(p.id) === r.mostGames.v).length === 1) rows.push(["users", "Most games played", r.mostGames.v, name(r.mostGames.id)]);
  return rows.length ? ce(List, { header: "Records" }, rows.map(([ic, t, v, who]) => ce(Row, { key: t, lead: ce("span", { className: "row-ic soft" }, ce(Icon, { n: ic, size: 19 })), title: t, sub: who, trail: ce("span", { className: "num-trail" }, ce("b", null, v)) }))) : null;
}
function ProfileSheet({ onClose, s, group, playerId, onDress }) {
  const p = plOf(group, null)(playerId), pr = playerProfile(s, group.id, playerId), name = id => plOf(group, null)(id).name;
  const [cab, setCab] = useState(false), [allH, setAllH] = useState(false), av = avOf(p.avatar, p.name);
  // Every award this player has won at this table, newest first, with the night it came from.
  const hist = Object.values(s.games).filter(g => g.groupId === group.id && g.status === "done" && g.players.includes(playerId)).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
    .flatMap(g => gameAwards(g).filter(a => a.id === playerId && AWARDS[a.key]).sort((x, y) => AWARDS[y.key].r - AWARDS[x.key].r)
      .map(a => ({ t: AWARDS[a.key].t, art: AWARDS[a.key].art, d: (a.d || AWARDS[a.key].how || "").replace(/\.$/, ""), at: g.endedAt })));
  const life = lifeAchievements(s, group.id, playerId);
  const awards = AWARD_ORDER.map(k => ({ key: k, art: AWARDS[k].art, t: AWARDS[k].t, how: AWARDS[k].how, n: pr.badges[k] || 0, at: pr.badgeLast[k] }));
  const nLife = life.filter(x => x.at != null).length, nAw = awards.filter(x => x.n).length;
  // The preview shelf: the four most recently earned, achievements and awards together.
  const recent = [...life.filter(x => x.at != null), ...awards.filter(x => x.n)].sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 4);
  const nx = life.filter(x => x.near).sort((a, b) => b.near.n / b.near.of - a.near.n / a.near.of)[0];
  const ledger = [["Games", pr.games], ["Wins", pr.wins], ["Win rate", Math.round(pr.winRate * 100) + "%"], ["Average", pr.games ? Math.round(pr.avg) : "–"],
    ["Best game", pr.bestGame ? pr.bestGame.total : "–"], ["Times out", pr.outs], ["Buys", pr.buys], ["Best streak", pr.streak.best]];
  const line = pr.streak.current > 1 ? "On a " + pr.streak.current + "-game winning streak" : pr.wins ? stPlural(pr.wins, "win") + " at " + group.name : "Still chasing a first win at " + group.name;
  return ce(KSheet, { title: p.name + "'s profile", onClose, cls: "profile", bare: true },
    ce("div", { className: "pf-stage", style: { "--peg": peg(p.color).c } },
      av.type === "card" ? ce("span", { className: "pf-card" }, ce(DeckCard, faceProps(av.card))) : ce(Tok, { p, cls: "pf-tok" })),
    ce("div", { className: "pf-who" }, ce("h3", null, p.name),
      onDress && ce("button", { className: "pf-dress", onClick: onDress }, kIcon("hanger"), "Dress up"),
      ce("p", null, (pr.streak.current > 1 || pr.wins > 0) && ce("img", { src: "art/crown.webp", alt: "" }), line)),
    ce("div", null, ce("h3", { className: "sub" }, "At " + group.name),
      ce("dl", { className: "ledger" }, ledger.map(([k, v]) => ce("div", { key: k }, ce("dt", null, k), ce("dd", null, v))))),
    ce("button", { className: "pf-cab", onClick: () => { haptic(6); setCab(true); }, "aria-label": "Cabinet: " + stPlural(nLife, "achievement") + " and " + stPlural(nAw, "game award") },
      ce("span", { className: "pf-cab-h" }, ce("span", { className: "grow" }, ce("b", null, "Cabinet"),
        ce("small", null, nLife || nAw ? stPlural(nLife, "achievement") + " · " + stPlural(nAw, "game award") : "Nothing on the shelf yet. Every game is a chance.")), kIcon("chev", "chev")),
      ce("span", { className: "cab", "aria-hidden": true }, ce("span", { className: "cab-grid" }, (recent.length ? recent : life.slice(0, 4)).map(x =>
        ce("span", { key: x.key, className: "cab-cell" + (recent.length ? "" : " no") }, ce("span", { className: "med" }, ce("img", { src: "art/icons/" + x.art + ".webp", alt: "" }), x.n > 1 && ce("i", { className: "n" }, "×" + x.n)), ce("span", { className: "nm" }, x.t))))),
      nx && ce("span", { className: "pf-next" }, ce("img", { src: "art/icons/" + nx.art + ".webp", alt: "" }),
        ce("span", { className: "grow" }, ce("b", null, "Next: " + nx.t), ce("small", null, nx.near.n + " of " + nx.near.of + " " + nx.near.what),
          ce("span", { className: "pf-bar", "aria-hidden": true }, ce("i", { style: { width: Math.round(100 * nx.near.n / nx.near.of) + "%" } }))))),
    hist.length > 0 && ce("div", null, ce("h3", { className: "sub" }, "Award history"),
      ce("ul", { className: "pf-hist" }, (allH ? hist : hist.slice(0, 6)).map((h, i) => ce("li", { key: i },
        ce("span", { className: "med" }, ce("img", { src: "art/icons/" + h.art + ".webp", alt: "" })),
        ce("span", { className: "grow" }, ce("b", null, h.t), ce("small", null, h.d)), ce("time", null, dayMonth(h.at))))),
      hist.length > 6 && !allH && ce("button", { className: "link ink pf-histall", onClick: () => setAllH(true) }, "All " + hist.length + " awards")),
    pr.h2h.length > 0 && ce("div", null, ce("h3", { className: "sub" }, "Head to head"),
      ce("div", { className: "pf-h2h" }, pr.h2h.map(h => { const o = plOf(group, null)(h.id);
        return ce("div", { key: h.id, className: "prow h2h" }, ce(Tok, { p: o }), ce("span", { className: "grow" }, ce("b", null, "vs " + name(h.id)), ce("small", null, stPlural(h.played, "game"))),
          ce("b", { className: "wl" + (h.wins > h.losses ? " up" : h.wins < h.losses ? " down" : "") }, h.wins + "–" + h.losses)); })),
      ce("p", { className: "fine" }, "Head to head counts the games both played and who finished lower.")),
    cab && ce(CabinetSheet, { p, life, awards, group, onClose: () => setCab(false) }));
}
function CabinetSheet({ p, life, awards, group, onClose }) {
  const sets = [
    { key: "life", label: "Achievements", items: life.map(x => ({ ...x, lit: x.at != null, st: x.at != null ? "Earned " + dayMonth(x.at) : x.near ? x.near.n + " of " + x.near.of + " " + x.near.what : "Not yet", said: x.t + ", " + (x.at != null ? "earned" : "not earned yet") })) },
    { key: "game", label: "Game awards", items: awards.map(x => ({ ...x, lit: x.n > 0, st: !x.n ? "Not won yet" : x.n === 1 ? "Won once · " + dayMonth(x.at) : "Won " + timesWord(x.n) + " · last on " + dayMonth(x.at),
      said: x.t + ", " + (x.n ? "won " + timesWord(x.n) : "not won yet"), badge: x.n > 1 ? ce("i", { className: "n" }, "×" + x.n) : null })) }];
  return ce(KPage, { title: p.name + "'s cabinet", onClose, backLabel: "Back to " + p.name + "'s profile", cls: "kcab" },
    ce(Shelf, { sets, label: "Cabinet shelves", lockable: true }),
    ce("p", { className: "st-note" }, "Achievements count every table " + p.name + " plays at. Game awards are from " + group.name + "."));
}

// ── Game: the table ───────────────────────────────────────────────
// One illustrated icon per award, for the race at the table and the finale.
const AWARD_ART = { clean: "out", bargain: "mayi", comeback: "comeback", steady: "steady", heavy: "heavy", joker: "joker" };
const guideSeen = new Set();
// The guide lives in the same corner of every game screen: the Learn book, one tap, and Back returns to exactly where the table was.
const kGuideBtn = onClick => ce("button", { className: "ib ib-guide", onClick, "aria-label": "Round guide: rules and tips" }, ce("img", { src: "art/icons/rules.webp", alt: "" }));
const navBack = e => e.currentTarget.classList.toggle("sc", e.currentTarget.scrollTop > 6);
function GameScreen({ s, api, game, open, go, wide, setToast, level, fixAsk }) {
  const group = s.groups[game.groupId];
  useEffect(() => { if (!awakeOn || !navigator.wakeLock) return; let lock = null, gone = false;
    const get = () => document.visibilityState === "visible" && navigator.wakeLock.request("screen").then(l => { if (gone) l.release(); else lock = l; }).catch(() => {});
    get(); document.addEventListener("visibilitychange", get);
    return () => { gone = true; document.removeEventListener("visibilitychange", get); lock && lock.release().catch(() => {}); }; }, []);
  const [board, setBoard] = useState(false);
  const [pad, setPad] = useState(null), [fix, setFix] = useState(null), [buyToast, setBuyToast] = useState(null);
  // A buy's Undo belongs to its round: it must not follow the table into the next one, where it would take back a buy nobody made.
  useEffect(() => { setBuyToast(null); }, [game.round]);
  useEffect(() => { if (!buyToast) return; const t = setTimeout(() => setBuyToast(null), 5000); return () => clearTimeout(t); }, [buyToast]);
  useEffect(() => { if (fixAsk) setFix(+fixAsk.split(":")[0]); }, [fixAsk]);
  // After Save the next round opens at once (23 Nov). A banner tells what happened, with Undo, until the next tap on the round.
  const [news, setNews] = useState(null), [standings, setStandings] = useState(false), roundEl = useRef(null);
  // A brand-new game opens straight on the round screen. The guide opens by itself only at tables that asked for it, once a game.
  useEffect(() => { if (game.round === 0 && !Object.keys(game.scores).length && level === "new" && !guideSeen.has(game.id)) { guideSeen.add(game.id); open("rules", { gameId: game.id }); } }, []);
  const r = ROUNDS[game.round], rs = game.scores[game.round] || {};
  const pl = plOf(group, game);
  const totals = totalsOf(game), ranked = [...totals].sort((a, b) => a.total - b.total);
  const hasAny = totals.some(t => t.total > 0), lead = ranked[0] ? ranked[0].total : 0;
  const limit = buyLimitOf(game.rules), dealer = game.players[dealerIdx(game, game.round)];
  const scored = game.players.filter(id => typeof rs[id] === "number").length, complete = scored === game.players.length;
  const allDone = ROUNDS.every((_, i) => roundDone(game, i));
  const upd = fn => api.game(game.id, fn);
  const sureOf = (rd, pid, v) => upd(g => ({ ...g, sure: { ...(g.sure || {}), [rd]: { ...((g.sure || {})[rd] || {}), [pid]: v } } }));
  function setScore(pid, val, cards, rd) {
    upd(g => {
      const R = rd == null ? g.round : rd;
      const sc = { ...g.scores, [R]: { ...(g.scores[R] || {}) } }, hd = { ...g.hands, [R]: { ...(g.hands[R] || {}) } };
      if (val === "" || val == null || isNaN(val)) delete sc[R][pid]; else sc[R][pid] = Math.max(0, Math.min(999, Math.round(+val)));
      if (cards && cards.length && val) hd[R][pid] = cards; else delete hd[R][pid];
      return { ...g, scores: sc, hands: hd };
    });
  }
  function changeBuy(pid, delta) {
    const c = (game.buys[game.round] && game.buys[game.round][pid]) || 0;
    if (c + delta < 0 || c + delta > limit) return; haptic(6); if (delta > 0) sound("chip");
    upd(g => { const b = (g.buys[g.round] && g.buys[g.round][pid]) || 0, n = Math.max(0, Math.min(limit, b + delta));
      return { ...g, buys: { ...g.buys, [g.round]: { ...(g.buys[g.round] || {}), [pid]: n } } }; });
  }
  function finish() { haptic([18, 70, 18, 70, 40]); upd(g => { const { reopened, ...y } = g; return { ...y, status: "done", endedAt: reopened ? reopened.endedAt : now() }; }); go({ at: "recap", gameId: game.id }); }
  function nextRound() {
    if (!complete || !outOk) return;
    if (ROUNDS.every((_, i) => i === game.round ? complete : roundDone(game, i))) return finish();
    const gap = ROUNDS.findIndex((_, i) => i !== game.round && !roundDone(game, i));
    if (game.round >= 6 && gap >= 0) { upd(g => ({ ...g, round: gap })); setToast({ text: "Round " + (gap + 1) + " still needs scores" }); return; }
    const from = game.round;
    haptic(14); sound("deal"); upd(g => ({ ...g, round: from + 1 }));
    setNews({ from }); setStandings(false);
    if (level === "new") open("rules", { gameId: game.id });
  }
  const firstOpen = Math.max(0, game.players.findIndex(id => typeof rs[id] !== "number"));
  const outs = game.players.filter(id => rs[id] === 0).length, outOk = outs === 1 || (outs === 0 && !!(game.noOut && game.noOut[game.round]));
  const chase = scored ? [] : chaseNotes(game, id => pl(id).name), moves = rankMoves(game);
  // Awards are a surprise at the end; mid-game they show as a race so everyone has something to chase.
  const doneN = ROUNDS.filter((_, i) => roundDone(game, i)).length, race = !scored && doneN >= 2 ? gameAwards(game).filter(a => AWARD_ART[a.key]) : [];
  // A new leader shows on the Between rounds leaderboard ("Takes the lead"), so the round screen stays quiet.
  const nextGap = ROUNDS.findIndex((_, i) => i !== game.round && !roundDone(game, i));
  const action = complete && !outOk ? ce("button", { className: "kb", onClick: () => { haptic(8); setPad(Math.max(0, game.players.findIndex(id => rs[id] === 0 || outs === 0))); } }, outs ? "Only one player can go out" : "Mark who went out")
    : allDone ? ce("button", { className: "kb", onClick: finish }, "Finish game · see who won")
    : complete ? ce("button", { className: "kb", onClick: nextRound }, nextGap >= 0 && game.round >= 6 ? "Go to round " + (nextGap + 1) : "Start round " + (game.round + 2))
    : ce("button", { className: "kb", onClick: () => { haptic(8); setPad(firstOpen); } }, scored ? "Keep scoring · " + scored + " of " + game.players.length : "Score round " + (game.round + 1));
  const overlays = ce(Fragment, null,
    pad != null && ce(ScorePad, { game, pl, start: pad, round: game.round, rs, setScore, onSure: (pid, v) => sureOf(game.round, pid, v), onRules: () => open("rules", { gameId: game.id }), onClose: () => setPad(null), onDone: () => { setPad(null); nextRound(); },
      noOut: !!(game.noOut && game.noOut[game.round]), setNoOut: on => upd(g => ({ ...g, noOut: { ...(g.noOut || {}), [g.round]: on } })) }),
    fix != null && ce(ScorePad, { game, pl, start: 0, round: fix, fixing: true, rs: game.scores[fix] || {}, setScore: (pid, v, cards) => setScore(pid, v, cards, fix), onSure: (pid, v) => sureOf(fix, pid, v), onRules: () => open("rules", { gameId: game.id }), onClose: () => setFix(null),
      noOut: !!(game.noOut && game.noOut[fix]), setNoOut: on => upd(g => ({ ...g, noOut: { ...(g.noOut || {}), [fix]: on } })),
      onDone: () => { setFix(null); setToast({ text: "Round " + (fix + 1) + " updated" }); } }),
    news && standings && ce(BetweenScreen, { game, pl, from: news.from, onMenu: () => open("game", { gameId: game.id }), onRules: () => open("rules", { gameId: game.id }),
      onPlay: () => { setStandings(false); setNews(null); },
      onUndo: () => { upd(g => ({ ...g, round: news.from })); setStandings(false); setNews(null); } }));
  if (board) return ce("div", { className: "scoreboard" },
    ce("div", { className: "sb-head" }, ce("span", null, "Round " + r.n + " of 7"), ce("h1", null, r.name), ce(Melds, { ex: r.ex }), ce("span", { className: "grow" }),
      ce("button", { className: "btn on-band", onClick: () => setBoard(false) }, "Done")), ce(RaceTrack, { game, pl, big: true }),
      chase.length > 0 && ce("p", { className: "sb-chase" }, pl(chase[chase.length - 1].id).name + ": " + chase[chase.length - 1].text), overlays);
  const deals = dealerName(pl(dealer).name, r.cards);
  const firstId = game.players[(dealerIdx(game, game.round) + 1) % Math.max(game.players.length, 1)];
  const many = game.players.length > 6;
  const left = [ce("div", { key: "h", className: "lr-head" },
      ce("span", { className: "lr-rn" }, "Round " + r.n + " of 7", game.round === 6 && ce("span", { className: "lr-last" }, "Last round")),
      ce("h1", { key: r.n }, r.name)),
    ce("button", { key: "g", className: "lr-goal", onClick: () => open("rules", { gameId: game.id }), "aria-label": r.name + ": " + GOAL_LINE[game.round] + " Open the round guide" },
      ce(GoalMelds, { r }),
      ce("span", { className: "lr-rule" }, GOAL_LINE[game.round]),
      ce("span", { className: "lr-more" }, "Round guide", kIcon("chevl")))];
  const newsUndo = () => { haptic(8); upd(g => ({ ...g, round: news.from })); setNews(null); };
  // Any tap on the round itself (not the banner, not a sheet over it) puts the banner away.
  const onRoundTap = e => { if (news && !standings && roundEl.current && roundEl.current.contains(e.target) && !e.target.closest(".lr-news")) setNews(null); };
  return ce("div", { ref: roundEl, className: "kit kscreen kround" + (news ? " has-news" : ""), onPointerDownCapture: onRoundTap },
    ce("div", { className: "ph-nav" },
      ce("button", { className: "ib", onClick: () => go({ at: "group", groupId: group.id }), "aria-label": "Back to " + group.name }, kIcon("chevl")),
      ce("span", { className: "lbl" }, group.name), ce("span", { className: "sp" }),
      kGuideBtn(() => open("rules", { gameId: game.id })),
      ce("button", { className: "ib", onClick: () => open("game", { gameId: game.id }), "aria-label": "Game menu: players, look, rules and settings" }, kIcon("more"))),
    ce("main", { className: "ph-body lr-body" },
      news && ce(RoundNews, { key: news.from, game, pl, from: news.from, onStandings: () => setStandings(true), onUndo: newsUndo }), left,
      // On a tablet the faces carry each running total, so the whole table can read the standings (CSS shows them from 700px wide).
      ce(BuyTable, { game, pl, rs, limit, dealer, firstId, many, cards: r.cards, changeBuy, hold: false, onScore: k => { haptic(6); setPad(k); }, setBuyToast, toast: buyToast,
        totals: doneN > 0 ? Object.fromEntries(totals.map(t => [t.id, t.total])) : null })),
    ce("div", { className: "ph-dock" }, action), overlays);
}
// The May I? table: one face per player round an oval, jewels for buys. A tap records a buy; once scores are in, a tap opens that player's score.
// As a round opens, its faces tell what the last round did: totals count up, "+N" floats off them, and whoever went out hops in a burst of sparks. Once per round.
const ROUND_FX = new Set();
function LrTot({ total, gain, fx }) {
  const shown = useCount(total, fx && gain > 0 ? total - gain : total, 450);
  return ce("span", { className: "lr-tot", "aria-hidden": true }, shown, fx && gain > 0 && ce("span", { className: "lr-plus" }, "+" + gain));
}
function BuyTable({ game, pl, rs, limit, dealer, firstId, many, cards, changeBuy, onScore, setBuyToast, toast, totals, cls, hold }) {
  const [pop, setPop] = useState(null), [lit, setLit] = useState(null), [fly, setFly] = useState(null), [bump, setBump] = useState(0), stock = useRef(null), slot = useRef(null), faces = useRef({});
  const fxKey = game.id + ":" + game.round, last = game.round > 0 ? game.scores[game.round - 1] : null;
  // Held while Between rounds covers the round, so it plays when the table can see it.
  const fx = useMemo(() => !hold && !!(totals && last) && !reducedMotion() && !ROUND_FX.has(fxKey), [fxKey, hold]);
  useEffect(() => { if (fx) ROUND_FX.add(fxKey); }, [fx, fxKey]);
  // May I?: the stock bumps and a card flies from it to the face that bought; the face pops as it lands.
  function buy(id) {
    const f = faces.current[id], from = stock.current && stock.current.offsetParent ? stock.current : slot.current;
    if (reducedMotion() || !f || !from) { setPop(id); setLit(id); return; }
    const S = from.getBoundingClientRect(), F = f.getBoundingClientRect(), sx = S.left + S.width / 2, sy = S.top + S.height / 2;
    setBump(b => b + 1); setFly({ k: Date.now(), id, x: sx, y: sy, dx: F.left + F.width / 2 - sx, dy: F.top + F.height / 2 - sy });
  }
  const low = totals ? Math.min(...game.players.map(id => totals[id])) : null, leadId = totals && game.players.filter(id => totals[id] === low).length === 1 ? game.players.find(id => totals[id] === low) : null;
  const scoring = game.players.some(id => typeof rs[id] === "number");
  const each = limit === Infinity ? "" : limit === 1 ? " One each." : " " + ["", "One", "Two", "Three", "Four", "Five", "Six"][limit] + " each.";
  return ce("div", { className: "lr-may" + (cls ? " " + cls : "") },
    ce("div", { className: "lr-mayh" }, ce("img", { ref: stock, key: "b" + bump, className: bump ? "bump" : "", src: "art/icons/mayi.webp", alt: "" }), ce("h2", null, scoring ? "This round" : "May I?")),
    ce("div", { ref: slot, className: "lr-mayslot" }, toast && !scoring
      ? ce("button", { key: toast.k, type: "button", className: "lr-toast in", "aria-live": "polite", onClick: () => { changeBuy(toast.id, -1); setBuyToast(null); } },
          ce("img", { src: "art/icons/mayi.webp", alt: "" }),
          ce("span", null, ce("b", null, pl(toast.id).name), (limit !== Infinity && toast.n >= limit ? "'s last buy · " : " bought a card · ") + (["", "1st", "2nd", "3rd"][toast.n] || toast.n + "th") + (limit === Infinity ? "" : " of " + limit)),
          ce("em", null, kIcon("again", "lr-undo"), "Undo"))
      : ce("p", { className: "lr-mayp" }, scoring ? "Tap a player to change their score." : "In turn order. Tap a player when they win a buy." + each)),
    // Players in the order they play: whoever goes first is 1, the dealer plays last. Up to four sit in one column; five to eight in two, read down.
    ce("ol", { className: "lr-buys lr-order" + (many ? " dense" : "") + (game.players.length > 4 ? " two" : ""), "data-n": game.players.length, "aria-label": "Players in turn order",
        style: { "--rows": Math.ceil(game.players.length / (game.players.length > 4 ? 2 : 1)), "--rows2": Math.ceil(game.players.length / 2) } }, (() => {
      const fi = Math.max(0, game.players.indexOf(firstId)); return [...game.players.slice(fi), ...game.players.slice(0, fi)]; })().map((id, o) => {
      const k = game.players.indexOf(id);
      const p = pl(id), n = (game.buys[game.round] && game.buys[game.round][id]) || 0, left = limit === Infinity ? Infinity : limit - n;
      const deal = id === dealer, first = id === firstId && !deal, v = rs[id], has = typeof v === "number";
      const spent = !scoring && left <= 0, role = deal ? ", deals, plays last" : first ? ", plays first" : ", plays " + (o + 1) + ordOf(o + 1);
      const label = scoring ? (has ? p.name + (v === 0 ? " went out" : " scored " + v) + ". Change the score" : "Score " + p.name)
        : spent ? p.name + role + " has no buys left" : p.name + role + ". Record a May I? buy. " + n + (limit === Infinity ? " so far" : " of " + limit + " used") + (totals ? ". On " + totals[id] + (id === leadId ? ", in the lead" : "") : "");
      const gain = last && typeof last[id] === "number" ? last[id] : null, wentOut = fx && gain === 0;
      return ce("li", { key: id }, ce("button", { className: "lr-b" + (spent ? " spent" : "") + (pop === id ? " pop" : "") + (deal ? " deal" : "") + (wentOut ? " hop" : ""), disabled: spent, "aria-label": label,
          onAnimationEnd: e => { if (e.animationName === "k-lmpop") setPop(null); },
          onClick: () => {
            if (scoring) return onScore(k);
            changeBuy(id, 1); buy(id); setBuyToast({ id, n: n + 1, k: Date.now() });
          } },
        ce("span", { className: "lr-no", "aria-hidden": true }, deal ? "D" : o + 1),
        ce("span", { className: "lr-t", ref: el => { faces.current[id] = el; } }, ce(Tok, { p }), id === leadId && ce("img", { key: fx ? "cfx" : "c", className: "lr-crown", src: "art/crown.webp", alt: "" }),
          wentOut && ce("span", { className: "sparks lr-sparks", "aria-hidden": true }, [0, 1, 2, 3, 4, 5, 6, 7].map(j => ce("i", { key: j, style: { "--k": j } })))),
        ce("span", { className: "lr-mid" },
          ce("b", null, p.name),
          ce("span", { className: "lr-sub" },
            scoring ? ce("span", { className: "lr-sc" + (v === 0 ? " out" : "") }, has ? (v === 0 ? "Out" : "+" + v) : "To score")
              : spent ? ce("span", { className: "lr-none" }, "No buys left")
              : limit === Infinity || limit > 6 ? ce("span", { className: "lr-none" }, n ? n + (n === 1 ? " buy" : " buys") : "No buys yet")
              : ce("span", { className: "jp", "aria-hidden": true }, Array.from({ length: limit }, (_, j) => ce("i", { key: j + (lit === id && j === n - 1 ? "l" : ""), className: (j < n ? "on" : "") + (lit === id && j === n - 1 ? " lit" : "") }))),
            !scoring && deal && ce("span", { className: "lr-role" }, "Deals " + cards))),
        totals && ce(LrTot, { key: fx ? "fx" : "t", total: totals[id], gain, fx })));
    })),
    fly && ce("span", { key: fly.k, className: "lr-fly", "aria-hidden": true, style: { left: fly.x, top: fly.y, "--dx": fly.dx + "px", "--dy": fly.dy + "px" },
      onAnimationEnd: () => { setPop(fly.id); setLit(fly.id); setFly(null); } }));
}
const dealerName = (n, c) => n + " deals " + c;
// Kit parts shared by the rebuilt screens (docs/ui-kit.html).
const kIcon = (id, cls) => ce("svg", { className: cls, "aria-hidden": true }, ce("use", { href: "#" + id }));
// A face: the player's photo, card portrait or initials inside their colour ring.
function Tok({ p, cls, style }) {
  const av = avOf(p.avatar, p.name), st = { "--c": peg(p.color).c, ...style }, ini = (p.name || "?").trim().charAt(0).toUpperCase();
  if (av.type === "photo") return ce("span", { className: "tok" + (cls ? " " + cls : ""), style: st, "data-i": ini }, ce("img", { src: av.src, alt: "" }));
  if (av.type === "card") return ce("span", { className: "tok" + (cls ? " " + cls : ""), style: st, "data-i": ini }, ce("img", { src: cardAvSrc(cardOfAv(av.card)), alt: "", decoding: "async", draggable: false }));
  return ce("span", { className: "tok" + (cls ? " " + cls : ""), style: st }, ce("b", { className: "tok-in", style: { background: peg(p.color).c } }, (p.name || "?").trim()[0].toUpperCase()));
}
// The round's goal in plain words, as the table would say it.
const GOAL_LINE = [
  "Two sets of three of a kind. Suits don't matter.",
  "One set of three, and a run of four in one suit.",
  "Two runs of four, each in one suit.",
  "Three of a kind, three times. A joker can fill any set.",
  "Two sets of three, and a run of four in one suit.",
  "One set of three, and two runs of four.",
  "Three runs of four. No discard at the end: going down is going out."];
// A card code like "10H" or "JKR" as the illustrated deck card.
const SUIT_KEY = { S: "spade", H: "heart", D: "diamond", C: "club" };
const codeCard = (code, key) => code === "JKR" || code === "JOKER" ? ce(DeckCard, { key, joker: true }) : ce(DeckCard, { key, rank: code.slice(0, -1), suit: SUIT_KEY[code.slice(-1)] });
function GoalMelds({ r }) {
  return ce("span", { className: "lr-melds" + (r.ex.length > 2 ? " three" : ""), "aria-hidden": true }, r.ex.map((m, i) => ce("span", { key: i, className: "lr-meld" + (m.length > 3 ? " run" : "") }, m.map((c, j) => ce("span", { key: j }, codeCard(c))))));
}
function ScorePad({ game, pl, start, round, rs, setScore, onClose, onDone, fixing, noOut, setNoOut, onSure, onRules }) {
  const R = round == null ? game.round : round, rules = game.rules;
  // The most a hand can hold: the cards dealt, two more for every buy recorded, each worth the dearest card. Anything over is asked about once, never blocked.
  const topCard = Math.max(10, acePoints(rules), wildPoints(rules)), cardsOf = id => ROUNDS[R].cards + 2 * (((game.buys[R] || {})[id]) || 0), sure = (game.sure && game.sure[R]) || {};
  const [ids] = useState(() => { const sc = Object.keys(game.scores[R] || {}); return fixing && sc.length ? [...game.players.filter(x => sc.includes(x)), ...sc.filter(x => !game.players.includes(x))] : game.players; });
  const [hint, setHint] = useState(null);
  // Every row writes through as it changes, so closing never loses a score. Save moves the game on.
  const outId = ids.find(x => rs[x] === 0), picked = !!outId || !!noOut;
  const [drafts, setDrafts] = useState(() => Object.fromEntries(ids.map(x => [x, typeof rs[x] === "number" ? String(rs[x]) : ""])));
  const [hand, setHand] = useState(null), wide = useMedia("(min-width: 900px)");
  const refs = useRef({}), me = useRef(null);
  useEffect(() => { lockPage(true); return () => lockPage(false); }, []);
  useDialogFocus(me);
  useEffect(() => { const k = e => { if (e.key !== "Escape" || hand) return; const all = document.querySelectorAll(".kscreen, .kport"); if (all[all.length - 1] === me.current) { e.preventDefault(); onClose(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  useEffect(() => { setDrafts(d => Object.fromEntries(ids.map(x => [x, typeof rs[x] === "number" ? String(rs[x]) : d[x] && rs[x] == null && d[x] !== "0" ? d[x] : ""]))); }, [JSON.stringify(rs)]);
  const before = id => ROUNDS.reduce((s, _, i) => s + (i < R && typeof (game.scores[i] || {})[id] === "number" ? game.scores[i][id] : 0), 0);
  const hands = game.hands[R] || {};
  function type(id, raw) {
    const v = raw.replace(/\D/g, "").slice(0, 3); setDrafts(d => ({ ...d, [id]: v })); setHint(v !== "" && +v === 0 ? id : null);
    if (v === "") setScore(id, null); else if (+v === 0) setScore(id, null); else setScore(id, +v, null);
  }
  function toggleOut(id) {
    haptic(12);
    if (rs[id] === 0) { setScore(id, null); setDrafts(d => ({ ...d, [id]: "" })); return; }
    sound("out"); if (outId) { setScore(outId, null); setDrafts(d => ({ ...d, [outId]: "" })); }
    if (noOut) setNoOut(false);
    setScore(id, 0, null); setDrafts(d => ({ ...d, [id]: "0" }));
    // The first empty hand gets the keyboard.
    setTimeout(() => { const next = ids.find(x => x !== id && typeof rs[x] !== "number"); const el = next && refs.current[next]; if (el) el.focus({ preventScroll: true }); }, 60);
  }
  useEffect(() => { if (!matchMedia("(pointer: fine)").matches) return; const t = setTimeout(() => { const first = ids.find(x => typeof rs[x] !== "number"); const el = first && refs.current[first]; if (el && !(document.activeElement && document.activeElement.tagName === "INPUT")) el.focus({ preventScroll: true }); }, 80); return () => clearTimeout(t); }, []);
  const missing = ids.filter(x => x !== outId && typeof rs[x] !== "number");
  const over = onSure ? ids.filter(x => typeof rs[x] === "number" && rs[x] > cardsOf(x) * topCard && sure[x] !== rs[x]) : [];
  const ok = !missing.length && (!!outId || !!noOut) && !over.length;
  const status = over.length ? "Check " + pl(over[0]).name + "'s score" : hint ? (outId && outId !== hint ? "Only one player goes out each round. " + pl(outId).name + " is out." : "0 means " + pl(hint).name + " went out. Tap Out for " + pl(hint).name + ".") : !picked ? "" : missing.length ? (missing.length === 1 ? pl(missing[0]).name + "'s hand to go" : missing.length + " hands to go") : "Ready to save";
  const title = fixing ? "Fix round " + (R + 1) : "Score round " + (R + 1);
  const rows = ids.flatMap((id, k) => {
    const p = pl(id), out = rs[id] === 0, v = drafts[id], t = before(id), h = hands[id], big = over.includes(id), fresh = R === 0 && t === 0;
    const counted = h && h.length && !out ? h.length + (h.length === 1 ? " card" : " cards") : "";
    return [ce("div", { key: id, className: "ls-row" + (out ? " out" : "") + (h && h.length ? " carded" : "") + (big ? " over" : "") },
      ce(Tok, { p }),
      ce("span", { className: "ls-nm", onClick: () => { if (!out) { haptic(6); setHand(id); } }, title: !out ? "Tap to count " + p.name + "'s cards" : undefined }, ce("b", null, p.name),
        // Round 1 has no running total to show, so the line stays quiet until there is something to say.
        fresh ? (counted ? ce("small", { className: "ls-tot" }, ce("span", null, counted)) : null)
          : ce("small", { className: "ls-tot" }, !picked ? t + " points" : t + " → " + (out ? t : v === "" ? "…" : t + +v), counted ? ce("span", null, " · " + counted) : null)),
      ce("button", { className: "ls-out", "aria-pressed": out, onClick: () => toggleOut(id), "aria-label": p.name + " went out" + (out ? ". Tap to undo" : "") }, out ? "Out!" : "Out"),
      ce("input", { ref: el => { refs.current[id] = el; }, className: "ls-in", inputMode: "numeric", pattern: "[0-9]*", maxLength: 3, value: out ? "0" : v, placeholder: "–", disabled: out,
        "aria-label": p.name + "'s points this round", "aria-invalid": big || undefined, enterKeyHint: "next", onChange: e => type(id, e.target.value),
        onKeyDown: e => { if (e.key === "Enter") { e.preventDefault(); const nx = ids.slice(k + 1).concat(ids.slice(0, k)).find(x => x !== outId && !drafts[x]); if (nx && refs.current[nx]) refs.current[nx].focus(); else e.target.blur(); } } }),
      ce("button", { className: "ls-cards" + (h && h.length ? " on" : ""), onClick: () => { haptic(6); setHand(id); }, "aria-label": "Tap cards to count " + p.name + "'s hand" },
        ce("img", { src: "art/icons/count.webp", alt: "" }),
        ce("span", { "aria-hidden": true }, "Tap cards"))),
      big && ce("p", { key: id + "w", className: "ls-warn", role: "alert" }, ce("span", null, rs[id] + " is more than a " + cardsOf(id) + "-card hand can hold."),
        ce("button", { type: "button", className: "link", onClick: () => { haptic(8); onSure(id, rs[id]); } }, "Keep " + rs[id]))];
  });
  const oi = outId ? ids.indexOf(outId) : -1, order = oi < 0 ? missing : ids.slice(oi + 1).concat(ids.slice(0, oi)).filter(x => missing.includes(x));
  const side = wide && picked ? hand || order[0] || null : null;
  const useHand = id => (v, cards) => { setScore(id, v, cards); setDrafts(d => ({ ...d, [id]: String(v) })); setHand(null);
    // The next empty hand takes over, so counting a hand never leaves you hunting for where you were.
    if (!wide) setTimeout(() => { const k = ids.indexOf(id), nx = ids.slice(k + 1).concat(ids.slice(0, k)).find(x => x !== outId && x !== id && typeof rs[x] !== "number"); const el = nx && refs.current[nx]; if (el) el.focus({ preventScroll: false }); }, 260); };
  const aceV = rules.aceValue == null && rules.acesPosition === "both" ? "1 or 15" : String(acePoints(rules));
  const vals = [[rules.twosWild ? "3 to 9" : "2 to 9", "face value"], ["10, J, Q, K", "10 each"], ["Ace", aceV], [rules.twosWild ? "Joker or 2" : "Joker", String(wildPoints(rules))]];
  const left = [ce("div", { key: "s", className: "lb-step" }, ce("h1", null, title), ce("p", { className: "ls-lead" }, picked ? (wide ? "Count each hand on the right, or type what's left." : "Type what's left in each hand, or tap the cards to count it.") : "Who went out first?"),
        picked && ce("p", { className: "ls-vals", "aria-label": "What each card is worth: " + vals.map(([k, v]) => k + ", " + v).join("; ") }, vals.map(([k, v]) => ce("span", { key: k, "aria-hidden": true }, k, ce("b", null, v))))),
      ce("div", { key: "r", className: "ls-rows" + (picked ? " picked" : "") }, rows),
      ce("p", { key: "t", className: "ls-status" + (ok ? " ok" : ""), role: "status" }, status),
      !outId && ce("button", { key: "n", className: "link lb-center ls-none", "aria-pressed": !!noOut, onClick: () => { haptic(6); setNoOut(!noOut); } }, noOut ? "Nobody went out ✓" : "Nobody went out")];
  return onTop(ce("div", { ref: me, className: "kit kscreen kscore" + (wide ? " wide" : ""), role: "dialog", "aria-modal": true, "aria-label": title, onScroll: navBack },
    ce("div", { className: "ph-nav" },
      ce("button", { className: "ib", onClick: onClose, "aria-label": "Back to the round" }, kIcon("chevl")),
      ce("span", { className: "lbl" }, "Round " + (R + 1)), ce("span", { className: "sp" }),
      onRules ? kGuideBtn(onRules) : ce("button", { className: "ib", onClick: onClose, "aria-label": "Close the score pad" }, kIcon("xmark"))),
    ce("main", { className: "ph-body ls-body" + (wide ? " ls-grid" : "") },
      wide ? ce("div", { className: "ls-left" }, left) : left,
      wide && ce("div", { className: "ls-side" }, side
        ? ce(HandSheet, { key: side, inline: true, p: pl(side), rules, start: (hands[side] || []).slice(), before: before(side), onClose: () => setHand(null), onUse: useHand(side) })
        : ce("div", { className: "ls-sidehint" }, ce("img", { src: "art/icons/count.webp", alt: "" }),
            ce("p", null, picked ? "Every hand is in. Tap a name's cards to count it again." : "Tap Out next to whoever went out first, or Nobody went out. Then each hand is counted here.")))),
    ce("div", { className: "ph-dock" }, ce("button", { className: "kb ls-save" + (ok ? " ready" : ""), disabled: !ok, onClick: () => { haptic([14, 60, 14]); sound("save"); onDone(); } }, fixing ? "Save round " + (R + 1) : "Save round " + (R + 1))),
    hand && !wide && ce(HandSheet, { p: pl(hand), rules, start: (hands[hand] || []).slice(), before: before(hand), onClose: () => setHand(null), onUse: useHand(hand) })));
}
// One hand, counted: Tap cards or Photo share one hand, one plaque and one teal button, so switching never loses the count.
function HandSheet({ p, rules, start, before, onClose, onUse, inline }) {
  const [mode, setMode] = useState("cards"), [hand, setHand] = useState(start), [doubt, setDoubt] = useState(() => start.map(() => false)), [grew, setGrew] = useState(false);
  const [scanning, setScanning] = useState(false), [scanMsg, setScanMsg] = useState(null), [shot, setShot] = useState(null), [hasKey, setHasKey] = useState(() => !!getAiKey());
  const fileRef = useRef(null), libRef = useRef(null);
  async function onPhoto(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setScanning(true); setScanMsg(null); setShot(null);
    try { const data = await resizeImage(f); setShot(data); const r = await scanHand(data);
      setHand(r.cards.map(c => c.token)); setDoubt(r.cards.map(c => !c.sure)); setGrew(false); haptic(12);
      const guessed = r.cards.filter(c => !c.sure).length;
      if (!r.cards.length) setScanMsg({ err: true, t: "No cards found. Try again with the cards spread out in good light." });
      else setScanMsg({ t: "Found " + r.cards.length + (r.cards.length === 1 ? " card" : " cards"), s: guessed ? "Check the " + guessed + " outlined." : r.unclear ? r.unclear + " couldn't be read, so add them with Tap cards." : "" });
    } catch (err) { setScanMsg({ err: true, t: err.message }); }
    setScanning(false);
  }
  const total = hand.reduce((s, c) => s + cardValue(c, rules), 0);
  const keys = (rules.aceValue == null && rules.acesPosition === "both" ? ["A1", "A15"] : ["A"]).concat(RANKS.slice(1)).concat(rules.jokersWild ? ["JOKER"] : []);
  useEffect(() => {
    if (mode !== "cards") return;
    const onKey = e => {
      if (e.target && e.target.matches && e.target.matches("input, textarea")) return;
      if (e.key === "Backspace") { e.preventDefault(); setGrew(false); setHand(h => h.slice(0, -1)); setDoubt(d => d.slice(0, -1)); return; }
      const k = e.key.toUpperCase();
      const map = { "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "0": "10", "T": "10", "J": "J", "Q": "Q", "K": "K", "A": keys[0], "*": "JOKER", "W": "JOKER" };
      const tok = map[k];
      if (tok && keys.includes(tok)) { e.preventDefault(); haptic(5); sound("tap"); setGrew(true); setHand(h => [...h, tok]); setDoubt(d => [...d, false]); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [mode, keys.join()]);
  const rk = c => { const k = rankPart(c); return k === "JOKER" ? "★" : k[0] === "A" ? "A" : k; };
  const suitOf = c => rankPart(c) !== c ? c.slice(-1) : null;
  const tint = c => { const s = suitOf(c); return s === "H" || s === "D" || rankPart(c) === "JOKER" ? " h" : s === "C" ? " c" : ""; };
  const say = c => { const k = rankPart(c), s = suitOf(c), n = k === "JOKER" ? "Joker" : k[0] === "A" ? "Ace" : { J: "Jack", Q: "Queen", K: "King" }[k] || k;
    return s ? n + " of " + { S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[s] : n; };
  const pts = c => c === "A1" ? 1 : c === "A15" ? 15 : cardValue(c, rules);
  const take = i => { haptic(5); setGrew(false); setHand(h => h.filter((_, j) => j !== i)); setDoubt(d => d.filter((_, j) => j !== i)); };
  const tapped = ce("div", { className: "tapped" + (scanning ? " busy" : "") }, hand.length ? hand.map((c, i) => ce("button", { key: i + c,
      className: "hc" + tint(c) + (doubt[i] ? " doubt" : "") + (grew && i === hand.length - 1 ? " fresh" : ""), style: { "--r": "0deg" }, onClick: () => take(i), "aria-label": "Remove " + say(c) + (doubt[i] ? ", unsure" : "") },
      ce("b", null, rk(c)), ce("small", null, cardValue(c, rules))))
    : ce("span", { className: "none" }, mode === "cards" ? "Tap each card left in " + p.name + "'s hand." : ""));
  const plaque = ce("div", { className: "plaque", "aria-live": "polite" }, ce("b", { key: total, className: "nudge" }, total), ce("small", null, "points left · " + before + " → " + (before + total)));
  // A photo's cards, drawn from the deck when the read has a suit.
  const deckOf = c => { const k = rankPart(c), s = suitOf(c); if (k === "JOKER") return ce(DeckCard, { joker: true }); if (!s) return null; return ce(DeckCard, { rank: k[0] === "A" ? "A" : k, suit: SUIT_KEY[s] }); };
  return ce(KSheet, { title: p.name + "'s hand", onClose, inline, cls: "lb-pad" + (mode === "photo" ? " pp-pad" : ""), lead: ce(Tok, { p }), footCls: "lb-padfoot",
      foot: ce(Fragment, null,
        mode === "photo" && shot ? ce("button", { className: "link ink", onClick: () => fileRef.current && fileRef.current.click() }, "Retake")
          : mode === "photo" && !hasKey ? null : ce("button", { className: "link ink", disabled: !hand.length, onClick: () => { setHand([]); setDoubt([]); } }, "Clear"),
        mode === "photo" && !hasKey ? ce("button", { className: "kb", type: "submit", form: "ppKey" }, "Turn on the scanner")
          : ce("button", { className: "kb", disabled: !hand.length, onClick: () => { haptic(10); onUse(total, hand); } }, hand.length ? "Use " + total + " for " + p.name : "Count " + p.name + "'s cards")) },
    ce(KSeg, { label: "How to count", value: mode, onChange: setMode, options: [["cards", "Tap cards"], ["photo", "Photo"]] }),
    ce("input", { ref: fileRef, type: "file", accept: "image/*", capture: "environment", hidden: true, onChange: onPhoto }),
    ce("input", { ref: libRef, type: "file", accept: "image/*", hidden: true, onChange: onPhoto }),
    mode === "cards" ? ce(Fragment, null, plaque, tapped,
        ce("div", { className: "ckeys" }, keys.map(c => ce("button", { key: c, className: "ck" + (c === "JOKER" ? " jk" : ""),
            onClick: () => { haptic(5); sound("tap"); setGrew(true); setHand(h => [...h, c]); setDoubt(d => [...d, false]); }, "aria-label": "Add " + say(c) + ", " + pts(c) + " points" },
          ce("b", null, rk(c)), ce("small", null, pts(c))))))
    : !hasKey ? ce("div", { className: "pp-off" },
        ce("img", { src: "art/icons/camera.webp", alt: "" }),
        ce("b", null, "Count a hand from a photo"),
        ce("p", null, "Lay the cards face up and take one photo. The scanner adds them up in seconds."),
        ce("div", { className: "pp-key" }, ce(AiKeyCard, { open: true, brief: true, formId: "ppKey", onSaved: () => setHasKey(true) })),
        ce("button", { className: "link ink", onClick: () => setMode("cards") }, "Use Tap cards instead"))
    : ce(Fragment, null,
        ce("div", { className: "pp-view" + (scanning ? " busy" : ""), role: "img", "aria-label": shot ? "Photo of " + p.name + "'s hand" : "No photo yet" },
          ce("i", { className: "pp-c tl" }), ce("i", { className: "pp-c tr" }), ce("i", { className: "pp-c bl" }), ce("i", { className: "pp-c br" }),
          shot && !hand.some(suitOf) && ce("img", { className: "pp-shot", src: shot, alt: "" }),
          hand.some(c => suitOf(c) || rankPart(c) === "JOKER") ? ce("div", { className: "pp-fan" }, hand.slice(0, 7).map((c, i, a) => ce("span", { key: i, className: "pp-card", style: { "--r": ((i - (a.length - 1) / 2) * 12) + "deg", "--x": ((i - (a.length - 1) / 2) * Math.min(62, 180 / Math.max(1, a.length - 1))) + "px" } },
              ce("span", null, deckOf(c)), !doubt[i] && ce("b", { className: "pp-ok" }, kIcon("tick")))))
            : !shot && ce("button", { className: "pp-take", onClick: () => fileRef.current && fileRef.current.click(), disabled: scanning }, ce("img", { src: "art/icons/camera.webp", alt: "" }), ce("b", null, "Take a photo"), ce("small", null, "Spread the cards face up in good light")),
          (scanning || scanMsg) && ce("span", { className: "pp-found" + (scanMsg && scanMsg.err ? " bad" : "") }, scanning ? "Reading " + p.name + "'s cards…" : scanMsg.t)),
        hand.length > 0 && plaque,
        hand.length > 0 && ce("p", { className: "pp-fix" }, scanMsg && scanMsg.s ? scanMsg.s + " " : "", "A card wrong? Tap it to take it out, then add it with Tap cards."),
        hand.length > 0 && tapped,
        !shot && ce("button", { className: "link ink pp-lib", onClick: () => libRef.current && libRef.current.click(), disabled: scanning }, "Choose a photo instead")));
}
// Between rounds: the next contract is dealt face down, turns over, and a gold line runs down before play starts by itself.
// ── Kit: the Leaderboard. Position, face, name, the highlight, points. Lowest leads; ties share a place. ──
const ordOf = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };
function Leaderboard({ rows, from, deal, big, dealIn, label, unit, hi, onPick }) {
  const sorted = [...rows].sort((a, b) => hi ? b.total - a.total : a.total - b.total), from1 = from || 1;
  const [dealt, setDealt] = useState(false);
  useEffect(() => { if (dealIn && !reducedMotion()) { const t = requestAnimationFrame(() => setDealt(true)); return () => cancelAnimationFrame(t); } }, []);
  return ce("ol", { className: "ldr" + (sorted.length > 6 && !big ? " dense" : "") + (big ? " big" : "") + (dealt ? " deal" : ""), style: { "--n": sorted.length }, "aria-label": label },
    sorted.map((o, i) => {
      const first = sorted.findIndex(x => x.total === o.total) + 1, same = sorted.filter(x => x.total === o.total).length, pos = from1 + first - 1, lead = pos === 1;
      const hl = o.hl || "", cut = hl.indexOf(" · ");
      const tap = onPick ? { role: "button", tabIndex: 0, onClick: () => onPick(o.id), onKeyDown: e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(o.id)) } : null;
      return ce("li", { key: o.id, className: (lead ? "lead" : "") + (onPick ? " tap" : ""), style: { "--i": i }, ...tap },
        ce("span", { className: "ldr-pos" }, same > 1 && ce("span", { className: "vh" }, "Joint "), pos, ce("small", null, ordOf(pos)),
          o.mv ? ce("i", { className: "ldr-mv " + (o.mv > 0 ? "up" : "dn") }, ce("span", { "aria-hidden": true }, o.mv > 0 ? "▲" : "▼"), ce("span", { className: "vh" }, (o.mv > 0 ? "up " : "down ") + Math.abs(o.mv))) : null),
        ce("span", { className: "ldr-face" }, ce(Tok, { p: o.p }), lead && ce("img", { className: "ldr-crown", src: "art/crown.webp", alt: "" })),
        ce("span", { className: "ldr-who" },
          ce("span", { className: "ldr-nm" }, ce("b", null, o.p.name), deal === o.id && ce(Fragment, null, ce("span", { className: "dl", "aria-hidden": true }, "D"), ce("span", { className: "vh" }, ", deals next"))),
          o.ic && ce("span", { className: "ldr-hl" }, ce("img", { src: "art/icons/" + o.ic + ".webp", alt: "" }), ce("span", null, cut > 0 ? ce(Fragment, null, ce("b", null, hl.slice(0, cut)), hl.slice(cut)) : hl))),
        ce("span", { className: "ldr-pts" }, o.total, unit ? ce("small", null, typeof unit === "function" ? unit(o.total) : unit) : ce("span", { className: "vh" }, " points")));
    }));
}
// One highlight per player for a finished round, from what the app knows: scores, who went out, buys, places before and after.
const NUM_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
function roundHighlights(game, R) {
  const ids = game.players, rs = game.scores[R] || {}, buys = game.buys[R] || {};
  const upTo = (id, rounds) => rounds.reduce((s, i) => s + (typeof (game.scores[i] || {})[id] === "number" ? game.scores[i][id] : 0), 0);
  const doneBefore = ROUNDS.map((_, i) => i).filter(i => i !== R && i < R && roundDone(game, i)), doneAfter = doneBefore.concat([R]);
  const place = rounds => { const t = Object.fromEntries(ids.map(id => [id, upTo(id, rounds)])); return Object.fromEntries(ids.map(id => [id, 1 + ids.filter(o => t[o] < t[id]).length])); };
  const before = place(doneBefore), after = place(doneAfter), fresh = !doneBefore.length, n = ids.length;
  const pts = ids.filter(id => rs[id] > 0).map(id => rs[id]), big = Math.max(0, ...pts), small = pts.length ? Math.min(...pts) : 0;
  const bigOne = pts.filter(v => v === big).length === 1, smallOne = pts.filter(v => v === small).length === 1 && small !== big;
  const out = {};
  ids.forEach(id => {
    const v = rs[id], b = buys[id] || 0, mv = fresh ? 0 : before[id] - after[id], wasLast = !fresh && before[id] === Math.max(...ids.map(o => before[o])), isLast = after[id] === Math.max(...ids.map(o => after[o]));
    let h;
    // The total sits beside every line, so a line never repeats it. After round 1 the total is the round's score, so round 1 speaks in words.
    // The leader's face already wears the crown, so their line carries other art.
    const lead = v === 0 ? "out" : "steady";
    if (after[id] === 1 && (fresh || before[id] !== 1)) h = [lead, fresh ? "In the lead" : "Takes the lead"];
    else if (after[id] === 1) h = [lead, v > 0 ? "Still leading, " + v + " in hand" : "Still leading"];
    else if (v > 0 && v === big && bigOne && n > 2) h = ["heavy", fresh ? "Biggest hand" : "Biggest hand, " + v];
    else if (wasLast && !isLast) h = ["upfrombottom", "Off the bottom"];
    else if (b > 0 && mv > 0) h = ["mayi", (NUM_WORD[b] || b) + (b === 1 ? " buy" : " buys") + ", up to " + after[id] + ordOf(after[id])];
    else if (mv > 0) h = ["comeback", "Up to " + after[id] + ordOf(after[id])];
    else if (v === 0) h = ["out", "Went out"];
    else if (v > 0 && v === small && smallOne) h = ["steady", fresh ? "Lightest hand" : "Only " + v + " in hand"];
    else if (b > 1) h = ["mayi", (NUM_WORD[b] || b) + " buys this round"];
    else if (v >= 25) h = ["rollercoaster", fresh ? "Got caught" : "Caught with " + v];
    else h = ["steady", fresh ? "Close behind" : v + " in hand"];
    out[id] = { ic: h[0], hl: h[1], mv };
  });
  // A line says something once: read down the standings, and a row whose line was already said stays quiet.
  const said = new Set();
  [...ids].sort((a, b) => after[a] - after[b]).forEach(id => { const o = out[id]; if (said.has(o.hl)) { o.ic = null; o.hl = ""; } else said.add(o.hl); });
  return out;
}
// The kit's round guide card (docs/ui-kit.html .gcard), from the app's own seven rounds.
const GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" };
function GuideCard({ r }) {
  const isSet = m => m[0].slice(0, -1) === m[1].slice(0, -1), lay = r.ex.reduce((s, m) => s + (isSet(m) ? 3 : 4), 0);
  const sets = r.ex.filter(isSet).length, runs = r.ex.length - sets;
  const line = [sets && sets + (sets > 1 ? " sets" : " set"), runs && runs + (runs > 1 ? " runs" : " run")].filter(Boolean).join(" + ").replace(/^(\d) sets$/, "$1 sets of 3").replace(/^(\d) runs$/, "$1 runs of 4");
  const pc = (c, k) => { if (c === "JKR") return ce("span", { key: k, className: "pc h" }, ce("b", null, "J"), ce("i", null, "★")); const s = c.slice(-1);
    return ce("span", { key: k, className: "pc" + (s === "H" || s === "D" ? " h" : s === "C" ? " c" : "") }, ce("b", null, c.slice(0, -1)), ce("i", null, GLYPH[s])); };
  return ce("article", { className: "gcard", "aria-label": "Round " + r.n + " of 7, " + r.name },
    ce("span", { className: "num" }, r.n), ce("h3", null, r.name), ce("span", { className: "line" }, line),
    ce("div", { className: "melds" + (r.ex.length > 2 ? " m3" : "") }, r.ex.map((m, i) => ce("span", { key: i, className: "meld" }, m.map(pc)))),
    ce("div", { className: "facts" }, ce("span", null, ce("b", null, r.cards), "cards dealt"), ce("span", null, ce("b", null, lay), "to lay down"), ce("span", null, ce("b", null, r.cards - lay), "left over")),
    ce("p", { className: "watch" }, ce("span", { className: "tipm", "aria-hidden": true }, kIcon("bulb")), ce("span", null, ce("b", null, "Tip"), r.goOut ? "Go out in one turn. No final discard." : r.watch)));
}
// The round that just closed, in one line: who went out and who leads, with Standings and Undo. Read aloud if asked.
function RoundNews({ game, pl, from, onStandings, onUndo }) {
  const rs = game.scores[from] || {}, outId = game.players.find(id => rs[id] === 0), t = totalsOf(game);
  const now = [...t].sort((a, b) => a.total - b.total), was = t.map(x => ({ id: x.id, total: x.total - (typeof rs[x.id] === "number" ? rs[x.id] : 0) })).sort((a, b) => a.total - b.total);
  const tie = now[1] && now[1].total === now[0].total, wasSole = from > 0 && !(was[1] && was[1].total === was[0].total);
  const head = outId ? pl(outId).name + " went out" : "Nobody went out";
  const line = tie ? "All square at the top" : pl(now[0].id).name + (wasSole && was[0].id !== now[0].id ? " takes the lead by " : " leads by ") + (now[1] ? now[1].total - now[0].total : 0);
  useEffect(() => { if (!speakOn || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance("After round " + (from + 1) + ". " + head + ". " + now.map((x, i) => pl(x.id).name + ", " + x.total + (i === 0 && !tie ? ", leading" : "")).join(". ") + ".");
    u.rate = .95; speechSynthesis.cancel(); speechSynthesis.speak(u); return () => speechSynthesis.cancel(); }, []);
  return ce("section", { className: "lr-news", role: "status", "aria-label": "Round " + (from + 1) + " saved" },
    ce("b", null, head), undoOn ? ce("button", { className: "link", onClick: onUndo }, "Undo round " + (from + 1)) : ce("span"),
    ce("span", null, line), ce("button", { className: "link", onClick: onStandings }, "Standings", kIcon("chev")));
}
// Standings after a round, opened from the banner: the Leaderboard with each player's highlight and the chase.
function BetweenScreen({ game, pl, from, onPlay, onUndo, onMenu, onRules }) {
  const rs = game.scores[from] || {}, outId = game.players.find(id => rs[id] === 0), hls = roundHighlights(game, from);
  const totals = totalsOf(game), next = from + 1, nd = game.players[dealerIdx(game, next)], ns = game.players[(dealerIdx(game, next) + 1) % game.players.length];
  useEffect(() => { const k = e => { if ((e.key === "Enter" && !e.target.closest("button, input")) || e.key === "Escape") onPlay(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const rows = totals.map(t => ({ id: t.id, p: pl(t.id), total: t.total, ...hls[t.id] }));
  // From round 2 on, the closest chaser's path to the lead, and up to three awards someone holds for now.
  const live = from >= 1 && next < 7, notes = live ? chaseNotes({ ...game, status: "live" }, id => pl(id).name) : [], chase = notes[0] || null;
  const race = live ? gameAwards(game).filter(a => a.id && AWARDS[a.key]).slice(0, 3) : [];
  if (outId && hls[outId] && hls[outId].ic === "out") hls[outId].hl = "Went out";
  return onTop(ce("div", { className: "kit kscreen kbetween", role: "dialog", "aria-modal": true, "aria-label": "After round " + (from + 1), onScroll: navBack },
    ce("div", { className: "lb-glow", "aria-hidden": true }),
    ce("div", { className: "ph-nav" },
      ce("button", { className: "ib", onClick: onPlay, "aria-label": "Back to the round" }, kIcon("chevl")),
      ce("span", { className: "lbl" }, "After round " + (from + 1)), ce("span", { className: "sp" }),
      onRules && kGuideBtn(onRules),
      ce("button", { className: "ib", onClick: onMenu, "aria-label": "Game menu" }, kIcon("more"))),
    ce("main", { className: "ph-body lb-between" },
      ce("h1", { className: "won lb-won" }, ce("img", { src: "art/icons/" + (outId ? "out" : "steady") + ".webp", alt: "" }), outId ? pl(outId).name + " went out" : "Nobody went out"),
      ce(Leaderboard, { rows, deal: nd, dealIn: true, label: "Standings after round " + (from + 1) }),
      race.length > 0 && ce("section", { className: "lb-race" }, ce("h2", null, "The chase"),
        chase && ce("p", { className: "lb-chase" }, ce("b", null, pl(chase.id).name), " is " + chase.text.replace(/^Only /, "only ")),
        ce("ul", null, [...new Set(race.map(a => a.id))].map(id => { const mine = race.filter(a => a.id === id), ts = mine.map(a => AWARDS[a.key].t);
          return ce("li", { key: id }, ce("span", { className: "lb-raceart" }, mine.map(a => ce("img", { key: a.key, src: "art/icons/" + (AWARDS[a.key].art || a.key) + ".webp", alt: "" }))),
            ce("span", null, ce("b", null, pl(id).name), ce("small", null, (ts.length > 1 ? ts.slice(0, -1).join(", ") + " and " + ts[ts.length - 1] : ts[0]) + ", for now"))); })))),
    ce("div", { className: "ph-dock lb-dock" },
      onUndo && undoOn && ce("button", { className: "link", onClick: onUndo }, "Undo round " + (from + 1)),
      ce("button", { className: "kb", onClick: onPlay }, "Back to round " + (from + 2)))));
}

// Racing pegs: each player's peg sits on a lane; the lowest total is closest to the finish.
function RaceTrack({ game, pl, big }) {
  const t = totalsOf(game), lo = Math.min(...t.map(x => x.total)), hi = Math.max(...t.map(x => x.total)), span = Math.max(1, hi - lo);
  const moves = rankMoves(game), ranked = [...t].sort((a, b) => a.total - b.total);
  return ce("div", { className: "race" + (big ? " big" : ""), role: "list", "aria-label": "Standings as a race" }, ranked.map((x, i) => {
    const p = pl(x.id), k = hi === lo ? 1 : 1 - (x.total - lo) / span, mv = moves[x.id] || 0;
    return ce("div", { key: x.id, className: "lane", role: "listitem", "aria-label": p.name + ", " + x.total + " points" },
      ce("span", { className: "lane-name" }, p.name, mv !== 0 && ce("i", { className: "mv " + (mv > 0 ? "up" : "down"), "aria-label": mv > 0 ? "up " + mv : "down " + -mv }, mv > 0 ? "▲" : "▼")),
      ce("span", { className: "lane-track" }, ce("span", { className: "lane-fill", style: { width: "calc(" + (k * 100) + "% - " + (k * 34) + "px + 17px)", "--peg": peg(p.color).c } }),
        ce("span", { className: "lane-peg", style: { left: "calc(" + (k * 100) + "% - " + (k * 34) + "px)" } }, ce(Peg, { color: p.color, name: p.name, av: p.avatar, size: big ? 44 : 34, ring: i === 0 && x.total === lo && t.some(y => y.total > 0) }))),
      ce("b", { className: "lane-total" }, x.total));
  }));
}

// ── Recap ─────────────────────────────────────────────────────────
function Recap({ s, game, go, setToast, rematch, onDelete, onReopen, onTable, settings, setSettings }) {
  const group = s.groups[game.groupId], pl = plOf(group, game);
  const ranked = rankOf(game), best = ranked[0].total, top = ranked.filter(t => t.total === best);
  const fresh = game.endedAt && now() - game.endedAt < 8000, roundsN = ROUNDS.filter((_, i) => roundDone(game, i)).length;
  const place = t => 1 + ranked.filter(q => q.total < t.total).length;
  const shareRows = () => ranked.map(t => ({ ...pl(t.id), total: t.total, place: place(t) }));
  const shareText = () => "May I? · " + group.name + "\n" + ranked.map(t => place(t) + ". " + pl(t.id).name + " · " + t.total).join("\n");
  // The picture is drawn when Results opens, so Share can show it first and still hand it to the share sheet straight after a tap.
  const pic = useRef(null), [picUrl, setPicUrl] = useState(null), [sharing, setSharing] = useState(false);
  useEffect(() => { let on = true, url = null; pic.current = null; setPicUrl(null);
    resultsImage(group.name, shareRows(), game.endedAt, tableLook(group)).then(b => { if (on && b) { pic.current = new File([b], "may-i-results.png", { type: "image/png" }); url = URL.createObjectURL(b); setPicUrl(url); } });
    return () => { on = false; if (url) URL.revokeObjectURL(url); }; }, [game.id, game.updatedAt, group.look]);
  const savePic = () => { const f = pic.current; if (!f) return; const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = "may-i-results.png"; document.body.appendChild(a); a.click(); a.remove(); setToast({ text: "Results picture saved" }); };
  // Nothing is awaited before navigator.share: Safari only opens the share sheet straight after the tap.
  async function share() {
    const text = shareText(), file = pic.current;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "May I? results", text }); setSharing(false); return; }
      if (navigator.share) { await navigator.share({ title: "May I? results", text }); setSharing(false); return; }
      throw new Error("no share");
    } catch (e) {
      if (e && e.name === "AbortError") return; // the player closed the share sheet
      // No share sheet (most desktops): copy the text and save the picture.
      const copied = await copyText(text);
      const blob = file || await resultsImage(group.name, shareRows(), game.endedAt, tableLook(group)).catch(() => null);
      if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "may-i-results.png"; document.body.appendChild(a); a.click(); a.remove(); }
      setToast({ text: copied && blob ? "Results copied and picture saved" : copied ? "Results copied" : blob ? "Results picture saved" : "Couldn't share. Try again." });
    }
  }
  const sameTable = game.players.filter(id => group.players.some(p => p.id === id)).length >= 2;
  const [take, setTake] = useState(fresh ? 1 : 0), [more, setMore] = useState(false), [allAw, setAllAw] = useState(false), [cheer, setCheer] = useState(0);
  // The finale is a moment, not the page: the winner's card fills the screen for a beat, then settles into the header so Rematch and Share are in reach. A tap skips it.
  const [settled, setSettled] = useState(!fresh || reducedMotion());
  useEffect(() => { if (!take || reducedMotion()) return; setSettled(false); const t = setTimeout(() => setSettled(true), 1700); return () => clearTimeout(t); }, [take]);
  const canRematch = game.status === "done" && sameTable;
  // Someone who played the table's game before this one but sat this one out gets a one-tap way back into the rematch.
  const sat = useMemo(() => { if (!canRematch) return [];
    const prev = Object.values(s.games).filter(x => x.groupId === game.groupId && x.status === "done" && x.id !== game.id && (x.endedAt || 0) < (game.endedAt || 0)).sort((a, b) => b.endedAt - a.endedAt)[0];
    return prev ? prev.players.filter(id => !game.players.includes(id) && group.players.some(p => p.id === id)).slice(0, 2) : []; }, [canRematch, game.id, s.games, group.players]);
  const [back, setBack] = useState([]);
  const hl = nightHighlights(game, pl, true), winners = top.map(t => pl(t.id));
  const names = winners.map(p => p.name), title = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] + " win!" : names[0] + " wins!";
  const winCard = p => { const av = avOf(p.avatar, p.name), c = av.type === "card" && cardOfAv(av.card);
    return c ? (c.key === "joker" ? ce(DeckCard, { joker: true }) : ce(DeckCard, { rank: c.rank.toUpperCase(), suit: c.suit }))
      : ce(DeckCard, { mono: (p.name || "?").trim().charAt(0).toUpperCase(), photo: av.type === "photo" ? av.src : null, color: peg(p.color).c }); };
  // Every award the game handed out, rarest first, each with who took it. They get their own section, so the rows above say something else.
  const aws = gameAwards(game).filter(a => a.id && AWARDS[a.key]).sort((x, y) => AWARDS[y.key].r - AWARDS[x.key].r).map(a => ({ a, A: AWARDS[a.key], p: pl(a.id) }));
  const wh = !aws.length && hl[top[0].id];
  const [ask, setAsk] = useState(() => {
    if (!fresh || game.status !== "done" || !settings) return null;
    if (group.auto && onTable) return "name";
    const day = 864e5, t = now(), doneN = Object.values(s.games).filter(x => x.status === "done").length, quiet = k => settings[k] && t - settings[k] < (k === "tipSnooze" ? 30 : 14) * day;
    if (doneN >= 5 && !(settings.backupAt && t - settings.backupAt < 30 * day) && !quiet("bkSnooze")) return "bk";
    if (SUPPORT_URL && doneN >= 3 && doneN % 4 === 3 && !settings.tipped && !quiet("tipSnooze")) return "tip";
    return null; });
  const mark = (k, v) => { setSettings(x => ({ ...x, [k]: v === undefined ? now() : v })); setAsk(null); };
  const [tn, setTn] = useState("");
  const nameIt = e => { e.preventDefault(); const n = tn.trim().slice(0, 30); if (!n) return; onTable({ name: n, auto: false }); setAsk(null); haptic(10); setToast({ text: "Table named " + n }); };
  const kept = ask === "bk" ? tally(Object.values(s.games).filter(x => x.groupId === group.id)) : null;
  const leftRows = sittingOut(game).concat(Object.keys(game.gone || {}).filter(id => !game.players.includes(id) && Object.values(game.scores).some(r => r && typeof r[id] === "number")))
    .filter((id, i, a) => a.indexOf(id) === i).map(id => ({ id, p: pl(id), total: Object.values(game.scores).reduce((s, r) => s + (r && typeof r[id] === "number" ? r[id] : 0), 0), from: (game.left || {})[id] }));
  const rest = ranked.filter(t => t.total !== best).map(t => ({ id: t.id, p: pl(t.id), total: t.total, ...hl[t.id] }));
  return ce("div", { className: "kit kscreen kresults" },
    ce("section", { key: "fin" + take, className: "finale lb-fin" + (settled ? " settled" : ""), onClick: settled ? undefined : () => setSettled(true) },
      ce("svg", { className: "rays", viewBox: "-100 -100 200 200", "aria-hidden": true }, ce("path", { d: FIN_RAYS, fill: "#FFE9A6", opacity: .22 })),
      ce("div", { className: "ph-nav lb-finnav" },
        ce("button", { className: "ib", onClick: () => go({ at: "group", groupId: group.id }), "aria-label": "Back to " + group.name }, kIcon("chevl")), ce("span", { className: "sp" }),
        ce("button", { className: "ib", onClick: () => { haptic(6); setSharing(true); }, "aria-label": "Share results" }, kIcon("share")),
        ce("button", { className: "ib", onClick: () => setMore(true), "aria-label": "More: reopen or delete this game" }, kIcon("more"))),
      ce("div", { className: "lb-wins" + (winners.length > 1 ? " two" : "") }, winners.slice(0, 2).map(p => ce("div", { key: p.id + ":" + cheer, className: "lb-wincard" + (cheer ? " cheer" : ""),
          // A tap on the winner's card is a little cheer: it jumps, the crown bounces and the sparks fly again.
          onClick: e => { if (!settled) return; e.stopPropagation(); haptic(8); sound("chip"); setCheer(c => c + 1); } }, winCard(p),
        ce("img", { className: "lb-wcrown", src: "art/crown.webp", alt: "" }),
        !reducedMotion() && ce("span", { className: "sparks lb-wsp", "aria-hidden": true }, [0, 1, 2, 3, 4, 5, 6, 7].map(k => ce("i", { key: k, style: { "--k": k } })))))),
      ce("h1", { className: "ribbon" }, ce("span", { className: "tail l", "aria-hidden": true }), title, ce("span", { className: "tail r", "aria-hidden": true })),
      ce("p", { className: "lede" }, group.name + " · " + best + " points over " + (game.early ? roundsN + " of 7 rounds" : "seven rounds")),
      wh && ce("p", { className: "lb-whl" }, ce("img", { src: "art/icons/" + wh.ic + ".webp", alt: "" }), ce("span", null, ...(wh.hl.indexOf(" · ") > 0 ? [ce("b", { key: "b" }, wh.hl.split(" · ")[0]), " · " + wh.hl.split(" · ").slice(1).join(" · ")] : [wh.hl]))),
      take > 0 && ce(FinaleFX)),
    fresh && ce(PlayOnce, { fn: () => sound("win") }),
    rest.length > 0 && ce(Leaderboard, { rows: rest, from: 1 + top.length, dealIn: fresh, label: "The rest of the table" }),
    ce("section", { className: "lb-sheet", "aria-label": "Scores by round" }, ce("h2", null, "Scores by round"), ce(ScoreSheet, { game, pl })),
    aws.length > 0 && ce("section", { className: "lb-aws" + (fresh && !reducedMotion() ? " in" : ""), "aria-labelledby": "lbAwsH" },
      ce("h2", { id: "lbAwsH" }, "Awards", ce("small", null, stPlural(aws.length, "award") + " handed out")),
      // The four rarest are big, with how they were won; any more sit in a smaller row underneath so a big night stays one screen of medals.
      ce("ul", null, aws.slice(0, 4).map(({ a, A, p }, i) => ce("li", { key: a.key + ":" + a.id, style: { "--i": i } },
        ce("span", { className: "lb-medal", "aria-hidden": true }, ce("img", { src: "art/icons/" + A.art + ".webp", alt: "" })),
        ce("b", { className: "lb-awt" }, A.t),
        ce("span", { className: "lb-awwho" }, ce(Tok, { p }), p.name),
        ce("small", null, (a.d || A.how || "").replace(/\.$/, ""))))),
      aws.length > 4 && !allAw && ce("button", { className: "link lb-awall", onClick: () => setAllAw(true) }, "All " + aws.length + " awards"),
      aws.length > 4 && allAw && ce("ul", { className: "lb-awsm" }, aws.slice(4).map(({ a, A, p }, i) => ce("li", { key: a.key + ":" + a.id, style: { "--i": i + 4 } },
        ce("span", { className: "lb-medal", "aria-hidden": true }, ce("img", { src: "art/icons/" + A.art + ".webp", alt: "" })),
        ce("b", { className: "lb-awt" }, A.t),
        ce("span", { className: "lb-awwho" }, ce(Tok, { p }), p.name),
        ce("span", { className: "vh" }, ". " + (a.d || A.how || "")))))),
    leftRows.length > 0 && ce("section", { className: "lb-left", "aria-label": "Left early" }, ce("h2", null, "Left early"),
      ce("ul", null, leftRows.map(r => ce("li", { key: r.id }, ce(Tok, { p: r.p }), ce("span", null, ce("b", null, r.p.name), ce("small", null, r.from != null ? "Sat out from round " + (r.from + 1) : "Left the game")), ce("em", null, r.total))))),
    ce("div", { className: "lb-sect lb-endsect" + (canRematch ? " docked" : "") + (sat.length ? " sat" + sat.length : "") },
      ask === "name" && ce("form", { className: "lb-nudge lb-name", "aria-label": "Name this table", onSubmit: nameIt },
        ce("img", { src: "art/icons/furniture.webp", alt: "" }),
        ce("p", null, ce("b", null, "Same table next time?"), "It was dealt the name " + group.name + ". Keep it, roll another, or type the table's own."),
        ce(KNameField, { id: "rcTable", label: "Table name", value: tn, onChange: setTn, taken: Object.values(s.groups).map(g => g.name), placeholder: "Type one, or roll the die" }),
        ce("div", { className: "lb-nbtns" }, ce("button", { type: "button", className: "link", onClick: () => { onTable({ auto: false }); setAsk(null); } }, "Keep " + group.name),
          ce("button", { className: "kb sm cream", type: "submit", disabled: !tn.trim() }, "Save name"))),
      ask === "bk" && ce("section", { className: "lb-nudge", "aria-label": "Back up this table" },
        ce("img", { src: "art/icons/fullcabinet.webp", alt: "" }),
        ce("p", null, ce("b", null, "Keep " + group.name + " safe"), stPlural(kept.games, "game") + " and " + stPlural(kept.awards, "award") + " live only on this phone. One file keeps them."),
        ce("div", { className: "lb-nbtns" }, ce("button", { className: "link", onClick: () => mark("bkSnooze") }, "Not now"),
          ce("button", { className: "kb sm cream", onClick: () => { downloadBackup(); mark("backupAt"); setToast({ text: "Backup saved", sub: "Keep the file somewhere safe" }); } }, "Save a backup"))),
      ask === "tip" && ce("section", { className: "lb-nudge", "aria-label": "Support May I?" },
        ce("img", { src: "art/icons/goodsport.webp", alt: "" }),
        ce("p", null, ce("b", null, "A good night?"), "May I? is free, with no ads. A tip from the table keeps it that way."),
        ce("div", { className: "lb-nbtns" }, ce("button", { className: "link", onClick: () => mark("tipSnooze") }, "Not now"),
          ce("a", { className: "kb sm cream", href: SUPPORT_URL, target: "_blank", rel: "noopener", onClick: () => { haptic(10); mark("tipped"); } }, "Leave a tip")))),
    canRematch && ce("div", { className: "ph-dock lb-rdock" + (sat.length ? " has-sat" : "") },
      sat.map(id => { const p = group.players.find(q => q.id === id), on = back.includes(id);
        return ce("p", { key: id, className: "lb-sat" + (on ? " on" : "") }, ce(Tok, { p }),
          ce("span", null, on ? p.name + " is in the rematch" : p.name + " sat out"),
          ce("button", { className: "link", "aria-pressed": on, onClick: () => { haptic(8); setBack(b => on ? b.filter(x => x !== id) : [...b, id]); } }, on ? "Undo" : "Add back")); }),
      ce("button", { className: "kb", onClick: () => { haptic(10); rematch(game, back); } }, kIcon("again"), back.length ? "Rematch with " + (game.players.length + back.length) : "Rematch")),
    sharing && ce(KSheet, { title: "Share results", heading: "Share the night", onClose: () => setSharing(false), cls: "sh-sheet",
        foot: ce("button", { className: "kb wide", onClick: share, disabled: !picUrl }, picUrl ? "Share" : "Drawing the picture…") },
      picUrl ? ce("img", { className: "sh-pic", src: picUrl, alt: "The results picture: " + ranked.map(t => place(t) + ". " + pl(t.id).name + " " + t.total).join(", ") })
        : ce("div", { className: "sh-pic sh-wait", "aria-hidden": true }),
      ce("button", { className: "link sh-save", onClick: savePic, disabled: !picUrl }, "Save the picture instead")),
    more && ce(KSheet, { title: "This game", onClose: () => setMore(false), cls: "gm-sheet" },
      ce("div", { className: "gm-list" },
        onReopen && ce("button", { className: "gm-row", onClick: () => { setMore(false); onReopen(); } }, ce("img", { src: "art/icons/scores.webp", alt: "" }),
          ce("span", { className: "gm-t" }, ce("b", null, "Reopen to fix scores"), ce("small", null, "It moves back to Playing now")), kIcon("chevl", "gm-chev")),
        ce("button", { className: "gm-row", onClick: () => { haptic(6); setTake(t => t + 1); sound("win"); setMore(false); } }, ce("img", { src: "art/icons/trophy.webp", alt: "" }),
          ce("span", { className: "gm-t" }, ce("b", null, "Replay the finale"), ce("small", null, "Fireworks, crown and all")), kIcon("chevl", "gm-chev"))),
      ce("button", { className: "link gm-danger", onClick: () => { setMore(false); onDelete(); } }, "Delete this game")));
}
// The night's score sheet, ruled the way it would be on paper: players across, rounds down, totals at the foot.
// Whoever went out wears a gold 0. Mid-game, a round's number opens that round to fix a score.
function ScoreSheet({ game, pl, onRound, fixable, plain }) {
  const num = (i, id) => { const v = (game.scores[i] || {})[id]; return typeof v === "number" ? v : null; };
  const rounds = ROUNDS.map((_, i) => i).filter(i => Object.values(game.scores[i] || {}).some(v => typeof v === "number"));
  const ids = [...new Set([...game.players, ...rounds.flatMap(i => Object.keys(game.scores[i] || {}))])].filter(id => game.players.includes(id) || rounds.some(i => num(i, id) != null));
  const tot = id => rounds.reduce((t, i) => t + (num(i, id) || 0), 0), best = Math.min(...game.players.map(tot));
  const late = ids.filter(id => game.joined && game.joined[id] > 0 && rounds.some(i => i < game.joined[id] && num(i, id) != null));
  if (!rounds.length) return null;
  // Players go down the side with their faces and full names; the seven rounds go across. The sheet grows downwards with the table, never sideways.
  return ce("div", { className: plain ? "ss-plain" : "sgrid-wrap ss-wrap" },
    ce("table", { className: "ss ss-t", "data-r": rounds.length },
      ce("caption", { className: "vh" }, "Scores by round"),
      ce("thead", null, ce("tr", null, ce("th", { className: "ss-ph", scope: "col" }, ce("span", { className: "vh" }, "Player")),
        rounds.map(i => ce("th", { key: i, scope: "col" }, onRound && fixable && fixable.includes(i)
          ? ce("button", { type: "button", className: "ss-rn", onClick: () => onRound(i), "aria-label": "Fix round " + (i + 1) + ", " + ROUNDS[i].name }, i + 1)
          : ce("span", { className: "ss-rn" }, ce("span", { className: "vh" }, "Round "), i + 1))),
        ce("th", { className: "ss-tot", scope: "col" }, "Total"))),
      ce("tbody", null, ids.map(id => { const p = pl(id), w = game.players.includes(id) && tot(id) === best;
        return ce("tr", { key: id }, ce("th", { scope: "row", className: "ss-ph" }, ce("span", { className: "ss-who" }, ce(Tok, { p }), ce("span", { className: "ss-nm" }, p.name))),
          rounds.map(i => { const pre = game.joined && game.joined[id] > i, v = pre ? null : num(i, id);
            return ce("td", { key: i, className: v === 0 ? "out" : v == null ? "none" : "" }, v == null ? ce("span", { "aria-label": pre ? "Not at the table yet" : "Did not play" }, "–") : v === 0 ? ce("b", null, "0", ce("span", { className: "vh" }, ", went out")) : v); }),
          ce("td", { className: "ss-tot" + (w ? " win" : "") }, ce("b", null, tot(id)), w && ce("span", { className: "vh" }, ", lowest"))); }))),
    late.map(id => ce("p", { key: id, className: "ss-note" }, pl(id).name + " joined in round " + (game.joined[id] + 1) + ", starting on " + rounds.filter(i => i < game.joined[id]).reduce((t, i) => t + (num(i, id) || 0), 0) + ".")));
}
// Every player's highlight of the night, from the game's awards; nobody gets a blank row, and last place gets a kind one.
// With facts set, it skips the awards (Results shows those in their own section) and gives every player a plain fact from the scores.
function nightHighlights(game, pl, facts) {
  const out = {}, aw = facts ? [] : [...gameAwards(game)].sort((x, y) => AWARDS[y.key].r - AWARDS[x.key].r);
  aw.forEach(a => { if (a.id && !out[a.id] && AWARDS[a.key]) out[a.id] = { ic: AWARDS[a.key].art || a.key, hl: AWARDS[a.key].t + " · " + (a.d || AWARDS[a.key].how || "").replace(/^./, c => c.toLowerCase()) }; });
  game.players.forEach(id => {
    if (out[id]) return;
    const sc = ROUNDS.map((_, i) => (game.scores[i] || {})[id]).filter(v => typeof v === "number"), outs = sc.filter(v => v === 0).length, low = Math.min(...sc.filter(v => v > 0).concat([999]));
    const buys = ROUNDS.reduce((s, _, i) => s + ((game.buys[i] || {})[id] || 0), 0);
    out[id] = outs > 1 ? { ic: "out", hl: "Went out " + outs + " times" } : outs === 1 ? { ic: "out", hl: "Went out in round " + (sc.indexOf(0) + 1) }
      : buys > 2 ? { ic: "mayi", hl: buys + " buys tonight" } : low < 999 ? { ic: "steady", hl: "Best round: " + (low <= 25 ? "only " : "") + low + " in hand" } : { ic: "goodsport", hl: "Played every round" };
  });
  return out;
}
// The results picture, drawn like the Results screen: the table's enamel with light rays and the suit pattern, a gilt
// frame, the wordmark, the winner's own card under the crown, the ribbon, and the places on a cream score card.
// Recap draws it as soon as it opens, so a tap on Share can open the share sheet straight away (Safari refuses it after a delay).
function resultsImage(name, rows, endedAt, look) {
  const load = src => new Promise(r => { if (!src) return r(null); const im = new Image(); if (/^https:/.test(src)) im.crossOrigin = "anonymous"; im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
  const fonts = document.fonts ? Promise.all(["900 80px Fraunces", "700 40px Fraunces", "700 40px 'Barlow Semi Condensed'", "800 40px 'Barlow Semi Condensed'", "700 30px 'Barlow Condensed'"].map(f => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  const win = rows.filter(r => r.place === 1), hero = win[0] || rows[0], hav = avOf(hero.avatar, hero.name), hc = hav.type === "card" ? cardOfAv(hav.card) : null;
  const heroArt = hc ? (hc.key === "joker" ? "art/courts/joker.webp" : hc.rank === "a" ? suitArt(hc.suit) : "art/courts/" + hc.key + ".webp") : hav.type === "photo" ? hav.src : null;
  return Promise.all([fonts, load("art/logo-wordmark-v2.webp"), load("art/crown.webp"), load("art/suit-tile.webp"), load(heroArt), hc && hc.key !== "joker" ? load(suitArt(hc.suit)) : null,
    ...rows.map(r => load(avatarSrc(avOf(r.avatar, r.name))))]).then(([, mark, crown, tile, art, pip, ...imgs]) => new Promise(res => { try {
    const T = LOOK_TILE[look] || LOOK_TILE.midnight, [hi, mid, deep] = T.c;
    const gold = "#E2BE6E", goldHi = "#F6DE9C", goldLo = "#A87A2A", cream = "#FFF6E0", cream2 = "rgba(255,246,224,.78)", ink = "#2B2014", ink2 = "#6B5536";
    const serif = '"Fraunces", Georgia, serif', label = '"Barlow Condensed", "Arial Narrow", sans-serif', num = '"Barlow Semi Condensed", "Barlow Condensed", sans-serif';
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    const gilt = (y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, goldHi); g.addColorStop(.5, gold); g.addColorStop(1, goldLo); return g; };
    // Ground: enamel, rays from behind the card, the suit pattern.
    const cx = W / 2, cy = 500, g = x.createRadialGradient(cx, cy, 30, cx, cy + 120, H * .9); g.addColorStop(0, hi); g.addColorStop(.38, mid); g.addColorStop(1, deep);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save(); x.globalAlpha = .09; x.fillStyle = cream; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 1200, a, a + Math.PI / 30); x.closePath(); x.fill(); } x.restore();
    if (tile) { x.save(); x.globalAlpha = .07; const p = x.createPattern(tile, "repeat"); x.fillStyle = p; x.fillRect(0, 0, W, H); x.restore(); }
    const v = x.createRadialGradient(cx, H * .5, H * .35, cx, H * .5, H * .8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
    // Gilt frame with corner studs.
    x.lineWidth = 6; x.strokeStyle = gilt(0, H); rr(34, 34, W - 68, H - 68, 26); x.stroke();
    x.lineWidth = 2; x.globalAlpha = .6; rr(52, 52, W - 104, H - 104, 16); x.stroke(); x.globalAlpha = 1;
    [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(([X, Y]) => { x.fillStyle = gilt(Y - 12, Y + 12); x.beginPath(); x.arc(X, Y, 12, 0, 7); x.fill(); });
    // Wordmark.
    if (mark) { const w = 250, h = mark.height * w / mark.width; x.drawImage(mark, cx - w / 2, 58, w, h); }
    // The winner's card, tilted, with the crown on it.
    const CW = 318, CH = CW * 88 / 63, red = hc && (hc.suit === "heart" || hc.suit === "diamond");
    x.save(); x.translate(cx, 292 + CH / 2); x.rotate(-.06);
    x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 40; x.shadowOffsetY = 18; x.fillStyle = "#FFFDF6"; rr(-CW / 2, -CH / 2, CW, CH, 22); x.fill(); x.shadowColor = "transparent";
    x.lineWidth = 5; x.strokeStyle = gilt(-CH / 2, CH / 2); rr(-CW / 2, -CH / 2, CW, CH, 22); x.stroke();
    x.lineWidth = 1.5; x.strokeStyle = "rgba(168,122,42,.55)"; rr(-CW / 2 + 16, -CH / 2 + 16, CW - 32, CH - 32, 10); x.stroke();
    const fx = -CW / 2 + 40, fy = -CH / 2 + 40, fw = CW - 80, fh = CH - 80;
    if (hc && hc.key !== "joker" && hc.rank !== "a" && art) {
      [0, 1].forEach(half => { x.save(); if (half) x.rotate(Math.PI); x.beginPath(); x.rect(fx, fy, fw, fh / 2); x.clip();
        const w = fw, h = art.height * w / art.width; x.drawImage(art, fx, fy, w, h); x.restore(); });
      x.strokeStyle = "rgba(168,122,42,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(fx, 0); x.lineTo(fx + fw, 0); x.stroke();
    } else if (art) { const k = Math.min(fw / art.width, fh / art.height) * (hc && hc.rank === "a" ? .7 : 1), w = art.width * k, h = art.height * k;
      if (hav.type === "photo") { x.save(); rr(fx, fy, fw, fh, 8); x.clip(); const k2 = Math.max(fw / art.width, fh / art.height); x.drawImage(art, -art.width * k2 / 2, -art.height * k2 / 2, art.width * k2, art.height * k2); x.restore(); }
      else x.drawImage(art, -w / 2, -h / 2, w, h);
    } else { x.fillStyle = peg(hero.color).c; rr(fx, fy, fw, fh, 10); x.fill(); x.fillStyle = cream; x.font = "900 200px " + serif; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText((hero.name || "?").trim().charAt(0).toUpperCase(), 0, 8); }
    if (hc) { const ix = hc.key === "joker" ? "★" : hc.rank.toUpperCase(); x.fillStyle = red ? "#B3263A" : "#1D2230"; x.textAlign = "center"; x.textBaseline = "alphabetic";
      [[1, -CW / 2 + 30, -CH / 2 + 50], [-1, CW / 2 - 30, CH / 2 - 50]].forEach(([d, X, Y]) => { x.save(); x.translate(X, Y); if (d < 0) x.rotate(Math.PI); x.font = "900 40px " + serif; x.fillText(ix, 0, 0); if (pip) x.drawImage(pip, -13, 8, 26, 24); x.restore(); }); }
    if (crown) { const w = 190, h = crown.height * w / crown.width; x.drawImage(crown, -w / 2, -CH / 2 - h * .62, w, h); }
    x.restore();
    // Ribbon.
    const title = win.length > 1 ? win.map(r => r.name).join(" & ") + " share it!" : hero.name + " wins!";
    x.font = "900 78px " + serif; const tw = Math.min(x.measureText(title).width, 700), RW = tw + 120, RH = 112, RX = cx - RW / 2, RY = 726;
    x.fillStyle = deep; [[RX - 50, RX + 10, RX - 26], [RX + RW + 50, RX + RW - 10, RX + RW + 26]].forEach(([o, inn, notch]) => { x.beginPath(); x.moveTo(inn, RY + 22); x.lineTo(o, RY + 22); x.lineTo(notch, RY + 22 + RH / 2); x.lineTo(o, RY + 22 + RH); x.lineTo(inn, RY + 22 + RH); x.closePath(); x.fill(); });
    const rg = x.createLinearGradient(0, RY, 0, RY + RH); rg.addColorStop(0, hi); rg.addColorStop(.6, mid); rg.addColorStop(1, deep);
    x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = rg; rr(RX, RY, RW, RH, 12); x.fill(); x.shadowColor = "transparent";
    x.lineWidth = 6; x.strokeStyle = gilt(RY, RY + RH); rr(RX, RY, RW, RH, 12); x.stroke();
    x.fillStyle = cream; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(title, cx, RY + RH / 2 + 4, 700);
    x.font = "700 30px " + label; x.fillStyle = cream2; x.textBaseline = "alphabetic";
    const margin = rows.length > 1 ? rows.filter(r => r.place > 1).map(r => r.total).sort((a, b) => a - b)[0] - hero.total : 0;
    x.fillText((name + (margin > 0 ? "  ·  won by " + margin : "") + "  ·  seven rounds").toUpperCase(), cx, RY + RH + 56, W - 200);
    // The places on a cream score card.
    const PX = 120, PW = W - 240, PY = 926, PH = 314;
    x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = cream; rr(PX, PY, PW, PH, 28); x.fill(); x.shadowColor = "transparent";
    x.lineWidth = 4; x.strokeStyle = gilt(PY, PY + PH); rr(PX, PY, PW, PH, 28); x.stroke();
    const list = rows.slice(0, 8), rowH = Math.min(84, (PH - 36) / list.length), top = PY + (PH - rowH * list.length) / 2, sz = Math.min(1, rowH / 76);
    list.forEach((r, i) => { const y = top + i * rowH + rowH / 2, first = r.place === 1, p = peg(r.color), R = 27 * sz;
      if (i) { x.strokeStyle = "rgba(107,85,54,.18)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(PX + 34, y - rowH / 2); x.lineTo(PX + PW - 34, y - rowH / 2); x.stroke(); }
      x.textBaseline = "middle"; x.textAlign = "left"; x.fillStyle = first ? goldLo : ink2; x.font = "700 " + Math.round(36 * sz) + "px " + serif; x.fillText(r.place + ordOf(r.place), PX + 40, y);
      const ax = PX + 170; x.beginPath(); x.arc(ax, y, R, 0, 7); x.fillStyle = p.c; x.fill();
      if (imgs[i]) { x.save(); x.beginPath(); x.arc(ax, y, R, 0, 7); x.clip(); x.drawImage(imgs[i], ax - R, y - R, R * 2, R * 2); x.restore(); }
      else { x.fillStyle = cream; x.textAlign = "center"; x.font = "800 " + Math.round(28 * sz) + "px " + num; x.fillText((r.name || "?").trim().charAt(0).toUpperCase(), ax, y + 1); }
      x.lineWidth = first ? 4 : 2; x.strokeStyle = first ? gilt(y - R, y + R) : "rgba(107,85,54,.35)"; x.beginPath(); x.arc(ax, y, R + (first ? 3 : 1), 0, 7); x.stroke();
      x.textAlign = "left"; x.fillStyle = ink; x.font = "700 " + Math.round(40 * sz) + "px " + num; x.fillText(r.name, ax + R + 22, y, 380);
      x.textAlign = "right"; x.font = "800 " + Math.round(46 * sz) + "px " + num; x.fillStyle = first ? goldLo : ink; x.fillText(r.total, PX + PW - 40, y); });
    // Footer.
    x.textBaseline = "alphabetic"; x.textAlign = "center"; x.fillStyle = cream2; x.font = "700 28px " + label;
    x.fillText(((endedAt ? new Date(endedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) + "  ·  " : "") + "Scored on May I?").toUpperCase(), cx, H - 74);
    c.toBlob(b => res(b), "image/png");
  } catch (e) { console.error(e); res(null); } }));
}
function PlayOnce({ fn }) { useEffect(() => { fn(); }, []); return null; }
// ── Finale effects ────────────────────────────────────────────────
// Fireworks rise and burst into a ring or a card suit (diamond, heart, spade, club), each in its own colours.
// Confetti falls once, then a lighter drift loops. Both sleep while the stage is off screen or the app is hidden,
// and neither runs with reduced motion.
const FIN_RAYS = "M0 0L99.7 -7.3L99.7 7.3ZM0 0L94.9 31.4L89.3 44.9ZM0 0L75.7 65.3L65.3 75.7ZM0 0L44.9 89.3L31.4 94.9ZM0 0L7.3 99.7L-7.3 99.7ZM0 0L-31.4 94.9L-44.9 89.3ZM0 0L-65.3 75.7L-75.7 65.3ZM0 0L-89.3 44.9L-94.9 31.4ZM0 0L-99.7 7.3L-99.7 -7.3ZM0 0L-94.9 -31.4L-89.3 -44.9ZM0 0L-75.7 -65.3L-65.3 -75.7ZM0 0L-44.9 -89.3L-31.4 -94.9ZM0 0L-7.3 -99.7L7.3 -99.7ZM0 0L31.4 -94.9L44.9 -89.3ZM0 0L65.3 -75.7L75.7 -65.3ZM0 0L89.3 -44.9L94.9 -31.4Z";
function finFireworks(cv) {
  const ctx = cv && cv.getContext && cv.getContext("2d"); if (!ctx) return () => {};
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0, parts = [], rockets = [], next = 0, last = 0, raf = 0, seen = true, dead = false;
  // Colour pairs (main, accent): gold, ruby, sapphire, violet, mint, amber. Saturated, because overlapping trails add up toward white.
  const PAL = [["#FFC53D", "#FFF1C2"], ["#FF4D6D", "#FF9EB5"], ["#4F8FFF", "#BFDAFF"], ["#A274FF", "#FF9EDB"], ["#2FD9A6", "#FFE07A"], ["#FF8A3D", "#FFD36B"]];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // Spread n sparks at equal steps along a drawn path so nothing bunches at the curves.
  const even = (path, n) => { const L = [0], o = []; let j = 0;
    for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    for (let k = 0; k < n; k++) { const d = k / n * L[L.length - 1]; while (L[j + 1] < d) j++; const f = (d - L[j]) / (L[j + 1] - L[j] || 1);
      o.push([path[j][0] + (path[j + 1][0] - path[j][0]) * f, path[j][1] + (path[j + 1][1] - path[j][1]) * f]); }
    return o; };
  const heartPath = [];
  for (let t = 0; t <= 240; t++) { const q = t / 240 * 6.283; heartPath.push([Math.pow(Math.sin(q), 3), -(13 * Math.cos(q) - 5 * Math.cos(2 * q) - 2 * Math.cos(3 * q) - Math.cos(4 * q)) / 16]); }
  const stem = top => even([[0, top], [.3, .98], [-.3, .98], [0, top]], 14);
  const SHAPES = {
    diamond: () => even([[0, -1.12], [.8, 0], [0, 1.12], [-.8, 0], [0, -1.12]], 64),
    heart: () => even(heartPath, 66).map(p => [p[0], p[1] - .15]),
    spade: () => even(heartPath, 58).map(p => [p[0] * .9, -p[1] * .9 - .16]).concat(stem(.12)),
    club: () => { const C = [[0, -.5], [-.46, .08], [.46, .08]], o = [];
      C.forEach((c, ci) => { for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, x = c[0] + Math.cos(a) * .4, y = c[1] + Math.sin(a) * .4;
        if (C.every((d, di) => di === ci || Math.hypot(x - d[0], y - d[1]) > .39)) o.push([x, y]); } });
      return o.concat(stem(.3)); },
  };
  const KINDS = ["ring", "ring", "diamond", "heart", "spade", "club"];
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const launch = () => rockets.push({ x: W * (.16 + Math.random() * .68), y: H, vy: -(H * .022 + Math.random() * H * .006), top: H * (.14 + Math.random() * .24), pal: pick(PAL) });
  const burst = (x, y, pal) => {
    const kind = pick(KINDS), sp = 2.9 + Math.random() * 1.1, tilt = (Math.random() - .5) * .5;
    const col = i => i % 7 === 0 ? "#FFFFFF" : i % 3 === 0 ? pal[1] : pal[0];
    if (!SHAPES[kind]) {   // the classic: a loose ring of sparks
      for (let i = 0; i < 52; i++) { const a = i / 52 * 6.283, v = sp * (.72 + Math.random() * .38);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: .011 + Math.random() * .008, c: col(i) }); }
      return;
    }
    // A suit: every spark shares the same drag and gravity, so the outline grows and drifts as one shape.
    const cs = Math.cos(tilt), sn = Math.sin(tilt), decay = .010 + Math.random() * .004;
    SHAPES[kind]().forEach((p, i) => parts.push({ x, y, vx: (p[0] * cs - p[1] * sn) * sp, vy: (p[0] * sn + p[1] * cs) * sp, life: 1, decay: decay + Math.random() * .002, c: col(i) }));
  };
  const frame = t => {
    if (dead || !cv.isConnected) return;
    if (!seen || document.hidden) { raf = 0; return; }
    const dt = Math.min(3, last ? (t - last) / 16.7 : 1); last = t;
    if (!next) next = t + 1500;   // let the podium and crown land first
    if (t > next && rockets.length + (parts.length ? 1 : 0) < 4) { launch(); next = t + 1000 + Math.random() * 1300; }
    ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0," + Math.min(1, .2 * dt) + ")"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    rockets = rockets.filter(r => {
      r.y += r.vy * dt; r.vy *= Math.pow(.985, dt);
      ctx.globalAlpha = .9; ctx.fillStyle = r.pal[1]; ctx.beginPath(); ctx.arc(r.x, r.y, 1.8, 0, 6.283); ctx.fill();
      if (r.y <= r.top || r.vy > -1.2) { burst(r.x, r.y, r.pal); return false; }
      return true;
    });
    parts = parts.filter(p => {
      p.vx *= Math.pow(.982, dt); p.vy = p.vy * Math.pow(.982, dt) + .032 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life < .3 ? p.life * (.5 + Math.random() * .5) : p.life; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.1 + p.life * 1.8, 0, 6.283); ctx.fill();
      return true;
    });
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!dead && !raf && seen && !document.hidden && cv.isConnected) { last = 0; raf = requestAnimationFrame(frame); } };
  size();
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(cv);
  const io = window.IntersectionObserver ? new IntersectionObserver(e => { seen = e[0].isIntersecting; wake(); }) : null; if (io) io.observe(cv);
  document.addEventListener("visibilitychange", wake);
  wake();
  return () => { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); document.removeEventListener("visibilitychange", wake); };
}
// Paper slips in gold, cream and the look's own colours, with the four jewel suits mixed in.
// A burst of 70 falls once; then 26 drifting pieces loop, joining as the burst clears, each starting again from a new spot.
function finConfetti(box) {
  if (!box) return () => {};
  const css = getComputedStyle(document.documentElement), v = (n, d) => css.getPropertyValue(n).trim() || d;
  const cols = ["#E9B44C", "#FFE39A", v("--teal-hi", "#24979C"), v("--gem-2", "#6CE9BF")], suits = ["spade", "heart", "diamond", "club"];
  box.style.setProperty("--fy", (box.clientHeight + 40) + "px");
  const piece = (jewel, drift, k) => {
    const el = jewel ? new Image() : document.createElement("i");
    if (jewel) { el.src = "art/jewel-" + suits[k % 4] + ".webp"; el.alt = ""; } else if (k % 3 === 0) el.className = "paper";
    if (drift) el.classList.add("drift");
    const w = jewel ? (drift ? 16 : 18) + Math.random() * (drift ? 8 : 10) : (drift ? 6 : 7) + Math.random() * (drift ? 5 : 6);
    el.style.cssText = "--x:" + Math.random() * 100 + "%;--w:" + w + "px;--c:" + cols[k % 4] + ";--dx:" + (Math.random() - .5) * (drift ? 90 : 160) + "px;--r:" +
      (Math.random() - .5) * (drift ? 720 : 900) + "deg;--t:" + (drift ? 6 + Math.random() * 3.5 : 2.2 + Math.random() * 1.6) + "s;--delay:" + (drift ? 2.4 + Math.random() * 6 : Math.random() * .9) + "s";
    if (drift) el.addEventListener("animationiteration", () => el.style.setProperty("--x", Math.random() * 100 + "%"));
    box.appendChild(el);
  };
  for (let i = 0; i < 70; i++) piece(i % 5 === 0, false, i);
  for (let i = 0; i < 26; i++) piece(i % 6 === 0, true, i);
  const io = window.IntersectionObserver ? new IntersectionObserver(e => box.classList.toggle("asleep", !e[0].isIntersecting)) : null; if (io) io.observe(box);
  return () => { if (io) io.disconnect(); box.textContent = ""; };
}
function FinaleFX() {
  const cv = useRef(null), box = useRef(null);
  useEffect(() => { if (reducedMotion()) return; const a = finFireworks(cv.current), b = finConfetti(box.current); return () => { a(); b(); }; }, []);
  return ce(Fragment, null, ce("canvas", { ref: cv, className: "fin-fw", "aria-hidden": true }), ce("div", { ref: box, className: "fin-confetti", "aria-hidden": true }));
}

// ── Sheets ────────────────────────────────────────────────────────
// ── Avatar maker ──────────────────────────────────────────────────
// A player is one of the deck's own faces, a photo or their initials. Cards deals the picked face onto a stage
// in the player's colour that never scrolls away; the peek shows the medallion the table will see.
function AvatarSheet({ player, taken, onClose, onSave, dress }) {
  const a0 = avOf(player.avatar, player.name);
  const [color, setColor] = useState(player.color), [mode, setMode] = useState(["card", "photo", "initials"].includes(a0.type) ? a0.type : "card"), [cat, setCat] = useState("cards");
  const [card, setCard] = useState(a0.type === "card" ? a0.card : avSeed(player.name).card), [dealt, setDealt] = useState(0);
  const [photo, setPhoto] = useState(a0 && a0.type === "photo" ? a0.src : null), [raw, setRaw] = useState(null), [pasteMsg, setPasteMsg] = useState(null);
  const [zoom, setZoom] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 }), drag = useRef(null), camRef = useRef(null), libRef = useRef(null);
  const VIEW = 200;
  const load = blob => { const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => { const k = VIEW / Math.min(img.width, img.height); setRaw({ img, url, w: img.width * k, h: img.height * k }); setZoom(1); setPos({ x: 0, y: 0 }); setMode("photo"); haptic(8); };
    img.src = url; };
  const onFile = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) load(f); };
  // A Memoji sticker (or any image) copied elsewhere can be pasted in as the photo.
  const paste = async () => { setPasteMsg(null);
    try { const items = await navigator.clipboard.read();
      for (const it of items) { const type = it.types.find(t => t.startsWith("image/")); if (type) { load(await it.getType(type)); return; } }
      setPasteMsg("There's no picture on the clipboard. Copy a Memoji sticker first, then tap Paste."); }
    catch (_) { setPasteMsg("Pasting isn't allowed here. Save the sticker to Photos and use Choose photo instead."); } };
  useEffect(() => { const h = e => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => x.type.startsWith("image/")); if (f) { e.preventDefault(); load(f); } };
    addEventListener("paste", h); return () => removeEventListener("paste", h); }, []);
  const clamp = (p, z) => { if (!raw) return p; const mx = Math.max(0, (raw.w * z - VIEW) / 2), my = Math.max(0, (raw.h * z - VIEW) / 2); return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }; };
  const down = e => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { if (drag.current) setPos(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }, zoom)); };
  const up = () => { drag.current = null; };
  // Pictures sit on the player's colour, so a sticker's transparent background shows their colour.
  const cropped = () => { const c = document.createElement("canvas"), OUT = 192; c.width = c.height = OUT; const x = c.getContext("2d"), k = OUT / VIEW;
    x.fillStyle = peg(color).c; x.fillRect(0, 0, OUT, OUT);
    const w = raw.w * zoom * k, h = raw.h * zoom * k; x.drawImage(raw.img, (OUT - w) / 2 + pos.x * k, (OUT - h) / 2 + pos.y * k, w, h); return c.toDataURL("image/jpeg", .85); };
  const result = () => mode === "photo" ? (raw ? { type: "photo", src: cropped() } : photo ? { type: "photo", src: photo } : null) : mode === "card" ? { type: "card", card } : { type: "initials" };
  const preview = mode === "photo" ? (photo && !raw ? { type: "photo", src: photo } : null) : mode === "card" ? { type: "card", card } : { type: "initials" };
  const pick = (f, c) => { haptic(6); sound("tap"); if (f === "color") setColor(c); else { setCard(f); setDealt(d => d + 1); } };
  const [dface, setDface] = useState(3);
  const shuffle = () => { const rest = AV_CARDS.filter(x => x.key !== card); haptic(10); sound("deal"); setCard(rest[Math.floor(Math.random() * rest.length)].key); setDealt(d => d + 1); setDface(dieNext); };
  const ini = (player.name || "?").trim().charAt(0).toUpperCase(), P = peg(color);
  const ok = ce("span", { className: "ok", "aria-hidden": true }, kIcon("tick"));
  const colours = ce("div", { className: "dr-grid", role: "radiogroup", "aria-label": "Colour" }, PEGS.map(c => { const on = color === c.k, gone = taken.includes(c.k) && !on;
    return ce("button", { key: c.k, role: "radio", "aria-checked": on, "aria-label": c.k + (gone ? ", taken" : ""), disabled: gone, className: "dr-tile dr-sw", style: { "--c": c.c }, onClick: () => pick("color", c.k) },
      ce("span", { className: "tph" }, mode === "card" ? ce("img", { src: cardAvSrc(cardOfAv(card)), alt: "", draggable: false }) : ce("b", { style: { color: c.ink } }, ini)), on && ok,
      ce("span", { className: "nm" }, c.k.charAt(0).toUpperCase() + c.k.slice(1))); }));
  const dm = mode === "card" ? "deck" : mode;
  return ce(KSheet, { title: "Dress up " + player.name, onClose, cls: "dress-sheet",
      foot: ce("button", { className: "kb", disabled: mode === "photo" && !raw && !photo, onClick: () => onSave(color, result()) }, "Save") },
    ce("div", { className: "dress dr-wrap", "data-mode": dm, style: { "--peg": P.c, "--peg-ink": P.ink } },
      ce(KSeg, { label: "Picture", value: mode, onChange: m => setMode(m), options: [["card", "Cards"], ["photo", "Photo"], ["initials", "Initials"]] }),
      ce("div", { className: "dr-stage" },
        mode === "card" && ce(Fragment, null,
          ce("span", { className: "dr-peek" }, ce(Tok, { p: { name: player.name, color, avatar: preview } }), ce("small", null, "At the table")),
          ce("span", { key: card + dealt, className: "dr-card", "aria-hidden": true }, ce(DeckCard, faceProps(card))),
          ce("div", { className: "dr-rail" }, ce("button", { className: "dr-act", onClick: shuffle, "aria-label": "Deal a different card" }, ce(KDie, { n: dface }), ce("span", null, "Shuffle")))),
        mode === "photo" && (raw
          ? ce("div", { className: "av-crop dr-crop", style: { width: 168, height: 168 }, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, "aria-label": "Drag to position the photo" },
              ce("img", { src: raw.url, alt: "", draggable: false, style: { width: raw.w * zoom * .84, height: raw.h * zoom * .84, transform: "translate(calc(-50% + " + pos.x * .84 + "px), calc(-50% + " + pos.y * .84 + "px))" } }))
          : photo ? ce("span", { className: "dr-frame dr-has" }, ce("img", { src: photo, alt: "" }))
          : ce("span", { className: "dr-frame", "aria-hidden": true }, ce("img", { src: "art/icons/camera.webp", alt: "" }))),
        mode === "initials" && ce("span", { key: color, className: "dr-init", "aria-hidden": true }, ini)),
      ce("p", { className: "dr-note", role: "status" }, mode === "photo" ? pasteMsg || (raw ? "Drag to frame it, then save." : "") : ""),
      mode === "card" && ce("div", { className: "dr-cats", role: "tablist", "aria-label": "Picture and colour" },
        [["cards", "Cards"], ["color", "Colour"]].map(([k, label]) => ce("button", { key: k, role: "tab", "aria-selected": cat === k, onClick: () => { setCat(k); haptic(4); } }, label)),
        ce("i", { className: "ul", "aria-hidden": true, style: { "--uw": "50%", "--ux": cat === "color" ? "100%" : "0%" } })),
      mode === "card" && cat === "cards" && ce("div", { className: "dr-grid", role: "radiogroup", "aria-label": "Cards" }, AV_CARDS.map(x => { const on = x.key === card;
        return ce("button", { key: x.key, role: "radio", "aria-checked": on, "aria-label": x.label, className: "dr-tile cardpic" + (x.rank === "a" ? " ace" : ""), onClick: () => { if (!on) pick(x.key); } },
          ce("span", { className: "tph" }, ce("img", { src: cardAvSrc(x), alt: "", loading: "lazy", decoding: "async", draggable: false })), on && ok,
          ce("span", { className: "nm" }, x.label.replace("The ", ""))); })),
      (mode === "initials" || (mode === "card" && cat === "color")) && colours,
      mode === "photo" && ce("div", { className: "dr-photo" },
        ce("input", { ref: camRef, type: "file", accept: "image/*", capture: "user", hidden: true, onChange: onFile }),
        ce("input", { ref: libRef, type: "file", accept: "image/*", hidden: true, onChange: onFile }),
        raw && ce("label", { className: "dr-zoom" }, ce("span", null, "Zoom"),
          ce("input", { type: "range", "aria-label": "Photo zoom", min: 1, max: 3, step: .01, value: zoom, onChange: e => { const z = +e.target.value; setZoom(z); setPos(p => clamp(p, z)); } })),
        ce("div", { className: "dr-photo-btns" },
          ce("button", { className: "qp", onClick: () => camRef.current.click() }, "Take photo"),
          ce("button", { className: "qp", onClick: () => libRef.current.click() }, "Choose"),
          navigator.clipboard && navigator.clipboard.read && ce("button", { className: "qp", onClick: paste }, "Paste")),
        ce("p", { className: "fine" }, "Use a photo, or copy a Memoji sticker and paste it here."))));
}
function PlayersSheet({ onClose, group, api, s }) {
  const [players, setPlayers] = useState(group.players), [draft, setDraft] = useState(""), [editing, setEditing] = useState(null), ref = useRef(null);
  const st = s ? groupStats(s, group.id) : { games: [], wins: {} }, ed = players.find(p => p.id === editing), used = players.map(p => p.color);
  const hist = id => { const n = st.games.filter(g => g.players.includes(id)).length, w = st.wins[id] || 0; return n ? stPlural(n, "game") + (w ? " · " + stPlural(w, "win") : "") : "New to this table"; };
  const add = e => { e.preventDefault(); const n = draft.trim().slice(0, 20); if (!n || sameName(players, n)) return;
    haptic(8); sound("chip"); setPlayers([...players, { id: uid(), name: n, color: (PEGS.find(p => !used.includes(p.k)) || PEGS[players.length % 8]).k, avatar: avSeed(n, heldFaces(players)) }]); setDraft(""); ref.current && ref.current.focus(); };
  const dupe = players.find(p => sameName(players, p.name, p.id)) || (sameName(players, draft) && { name: draft.trim() });
  const save = () => { if (dupe) return;
    // Save each game's names first, so removed players keep their name in old results.
    api.set(x => { const games = { ...x.games }; Object.values(games).forEach(gm => { if (gm.groupId === group.id) games[gm.id] = { ...gm, names: { ...namesOf(group, gm.players), ...(gm.names || {}) } }; }); return { ...x, games }; });
    api.group(group.id, g => ({ ...g, players: players.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim() })) })); onClose(); };
  return ce(Fragment, null,
    ce(KSheet, { title: "Players at " + group.name, heading: "Players", onClose, cls: "ep-sheet", foot: ce("button", { className: "kb", onClick: save, disabled: !!dupe }, "Save") },
      ce("div", { className: "lr-seats" },
        players.map(p => ce("div", { key: p.id, className: "prow ep-row" },
          ce("button", { className: "ep-av", onClick: () => setEditing(p.id), "aria-label": "Change " + (p.name || "this player") + "'s card, photo or colour" }, ce(Tok, { p }), ce("span", { className: "pe-badge", "aria-hidden": true }, kIcon("hanger"))),
          ce("span", { className: "grow" }, ce("input", { className: "ep-in", value: p.name, maxLength: 20, "aria-label": "Name", onChange: e => setPlayers(players.map(x => x.id === p.id ? { ...x, name: e.target.value } : x)) }), ce("small", null, hist(p.id))),
          ce("button", { className: "qp pe-rm lr-rm", onClick: () => { haptic(8); setPlayers(players.filter(x => x.id !== p.id)); }, "aria-label": "Remove " + (p.name || "this player") }, kIcon("bin")))),
        ce("form", { className: "prow ep-add", onSubmit: add }, ce(KAddPlus),
          ce("input", { ref, className: "ep-in", value: draft, placeholder: "Add a player", maxLength: 20, "aria-label": "New player's name", enterKeyHint: "done", onChange: e => setDraft(e.target.value) }),
          draft.trim() && ce("button", { className: "qp", type: "submit", disabled: sameName(players, draft) }, "Add"))),
      dupe && ce("p", { className: "dupe", role: "status" }, "There's already a " + dupe.name.trim() + " here. Add an initial, like " + dupe.name.trim() + " B."),
      ce("p", { className: "fine" }, "Tap a face to pick their card, add a photo or change their colour. Removing a player keeps their past games. Up to " + MAX_PLAYERS + " play in one game.")),
    ed && ce(AvatarSheet, { player: ed, taken: used.filter(c => c !== ed.color), onClose: () => setEditing(null),
      onSave: (color, avatar) => { setPlayers(players.map(p => p.id === ed.id ? { ...p, color, avatar } : p)); setEditing(null); } }));
}
// A new table is a page: the name on top, then everyone takes a seat round the oval table.
// Add or remove players while a game is going.
function GamePlayersSheet({ onClose, game, group, s, onJoin, onChange }) {
  const [adding, setAdding] = useState(null), [draft, setDraft] = useState(""), [dealing, setDealing] = useState(false);
  const pl = plOf(group, game), inGame = game.players, out = sittingOut(game), next = game.round + 1;
  const bench = group.players.filter(p => !inGame.includes(p.id) && !out.includes(p.id));
  const full = inGame.length >= MAX_PLAYERS, totals = totalsOf(game), dealer = inGame[dealerIdx(game, game.round)];
  const dealsNext = game.round < 6 && inGame[dealerIdx(game, game.round + 1)], firstNext = game.round < 6 && inGame[(dealerIdx(game, game.round + 1) + 1) % inGame.length];
  if (adding) return ce(AddPlayerSheet, { game, group, who: adding, onBack: () => setAdding(null), onClose,
    onAdd: (name, target, look) => { onJoin(adding.id || null, name, target, look); setAdding(null); setDraft(""); } });
  const lastPlayed = id => { const gs = Object.values(s.games || {}).filter(x => x.groupId === group.id && x.id !== game.id && x.players.includes(id) && x.endedAt);
    if (!gs.length) return "Hasn't played here yet"; const days = Math.floor((Date.now() - Math.max(...gs.map(x => x.endedAt))) / 864e5);
    return days < 1 ? "Played today" : days < 2 ? "Played yesterday" : days < 7 ? "Played " + days + " days ago" : days < 14 ? "Played last week" : "Played " + Math.floor(days / 7) + " weeks ago"; };
  const grip = (i, p) => ce("button", { className: "lr-grip", "aria-label": "Move " + p.name + ". Use the arrow keys to change seats",
      onKeyDown: e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); onChange(g => moveSeat(g, i, i + (e.key === "ArrowUp" ? -1 : 1))); } },
      onPointerDown: e => { const li = e.currentTarget.closest(".prow"), list = li.parentElement, y0 = e.clientY, h = li.getBoundingClientRect().height + 10; let to = i;
        e.currentTarget.setPointerCapture(e.pointerId); li.classList.add("lifting");
        const mv = ev => { const dy = ev.clientY - y0; li.style.transform = "translateY(" + dy + "px)"; to = Math.max(0, Math.min(inGame.length - 1, i + Math.round(dy / h))); };
        const up = () => { li.style.transform = ""; li.classList.remove("lifting"); e.target.removeEventListener("pointermove", mv); e.target.removeEventListener("pointerup", up); e.target.removeEventListener("pointercancel", up); if (to !== i) { haptic(8); onChange(g => moveSeat(g, i, to)); } };
        e.target.addEventListener("pointermove", mv); e.target.addEventListener("pointerup", up); e.target.addEventListener("pointercancel", up); } },
    ce("svg", { viewBox: "0 0 18 18", "aria-hidden": true }, ce("g", { fill: "currentColor" }, [[6, 4], [12, 4], [6, 9], [12, 9], [6, 14], [12, 14]].map(([x, y], k) => ce("circle", { key: k, cx: x, cy: y, r: 1.6 })))));
  const note = id => { const t = totals.find(x => x.id === id), bits = [(t ? t.total : 0) + " points"];
    if (id === dealsNext) bits.push("deals round " + (game.round + 2)); else if (id === firstNext) bits.push("starts round " + (game.round + 2)); return bits.join(" · "); };
  return ce(KSheet, { title: "Players in this game", heading: "Players", onClose, foot: ce("button", { className: "kb", onClick: onClose }, "Done") },
    ce("p", { className: "fine" }, game.round < 6 ? "Drag to change seats. Changes start with round " + next + "." : "Drag to change seats."),
    ce("p", { className: "lr-dealrow" }, ce("span", null, dealing ? "Tap who dealt this round" : pl(dealer).name + " dealt this round"),
      ce("button", { className: "link ink", onClick: () => setDealing(x => !x) }, dealing ? "Cancel" : "Change dealer")),
    ce("div", { className: "lr-seats" },
      inGame.map((id, i) => { const p = pl(id);
        return ce("div", { key: id, className: "prow" + (dealing ? " picking" : "") },
          grip(i, p),
          dealing ? ce("button", { className: "lr-pickdeal", onClick: () => { onChange(g => setDealer(g, id)); setDealing(false); haptic(8); }, "aria-label": p.name + " dealt this round" }, ce(Tok, { p }), ce("span", { className: "grow" }, ce("b", null, p.name), ce("small", null, id === dealer ? "Dealing now" : "Tap if they dealt")))
            : ce(Fragment, null, ce(Tok, { p }), ce("span", { className: "grow" }, ce("b", null, p.name), ce("small", null, note(id)))),
          !dealing && ce("button", { className: "qp", disabled: inGame.length <= 2, onClick: () => { haptic(6); onChange(g => dropFromGame(g, id)); }, "aria-label": p.name + " sits out from round " + next }, "Sit out")); }),
      out.map(id => { const p = pl(id);
        return ce("div", { key: id, className: "prow out" }, ce("span", { className: "lr-grip", "aria-hidden": true }), ce(Tok, { p }), ce("span", { className: "grow" }, ce("b", null, p.name), ce("small", null, "Sitting out")),
          ce("button", { className: "qp", disabled: full, onClick: () => { haptic(8); onJoin(id, null, null); }, "aria-label": p.name + " comes back in" }, "Back in"),
          ce("button", { className: "qp pe-rm lr-rm", onClick: () => onChange(g => removeFromGame(g, id)), "aria-label": "Remove " + p.name + " from this game" }, kIcon("bin"))); })),
    full ? ce("p", { className: "fine" }, "This game has the most players a deck can deal for (" + MAX_PLAYERS + ").") : ce(Fragment, null,
      ce("h3", { className: "sub" }, "Add someone"),
      ce("div", { className: "lr-seats" },
        bench.map(p => ce("button", { key: p.id, className: "prow", onClick: () => setAdding({ id: p.id, name: p.name }), "aria-label": "Add " + p.name + " to this game" },
          ce("span", { className: "lr-grip", "aria-hidden": true }), ce(Tok, { p }), ce("span", { className: "grow" }, ce("b", null, p.name), ce("small", null, lastPlayed(p.id))),
          ce("span", { className: "pe-join", "aria-hidden": true }, kIcon("plus")))),
        ce("form", { className: "prow pe-add", onSubmit: e => { e.preventDefault(); const n = draft.trim().slice(0, 20); if (n) setAdding({ id: null, name: n }); } },
          ce(KAddPlus),
          ce("input", { className: "pe-in", value: draft, placeholder: "New player's name", "aria-label": "New player's name", maxLength: 20, onChange: e => setDraft(e.target.value), enterKeyHint: "next" }),
          draft.trim() && ce("button", { className: "qp", type: "submit" }, "Next")))));
}
// Add a player: their face and name, then the score they start on. Highest total is the default; Choose a score is the house-rule override.
function AddPlayerSheet({ game, group, who, onBack, onClose, onAdd }) {
  const known = who.id && group.players.find(p => p.id === who.id);
  const [name, setName] = useState(who.name), [mode, setMode] = useState("high"), [look, setLook] = useState(null), [picking, setPicking] = useState(false);
  const totals = totalsOf(game), top = totals.reduce((a, t) => t.total > a.total ? t : a, { id: null, total: 0 }), pl = plOf(group, game);
  const missed = ROUNDS.some((_, i) => roundDone(game, i)), minScore = ROUNDS.filter((_, i) => roundDone(game, i)).length;
  const [score, setScore] = useState(String(top.total));
  const nm = name.trim() || "New player", lastSeat = pl(game.players[game.players.length - 1]).name;
  const used = group.players.map(q => q.color), face = known || { name: nm, color: look ? look.color : (PEGS.find(c => !used.includes(c.k)) || PEGS[0]).k, avatar: look ? look.avatar : avSeed(nm, heldFaces(group.players)) };
  if (picking && !known) return ce(AvatarSheet, { player: face, taken: used, onClose: () => setPicking(false), onSave: (color, avatar) => { setLook({ color, avatar }); setPicking(false); } });
  const target = !missed ? 0 : mode === "high" ? top.total : Math.max(minScore, Math.min(999, parseInt(score, 10) || 0));
  return ce(KSheet, { title: "Add a player", onClose, cls: "lr-add", closeLabel: "Back to Players",
      foot: ce("button", { className: "kb", disabled: !name.trim() || sameName(group.players.filter(q => !known || q.id !== known.id), name) && !known || (missed && mode === "pick" && (score === "" || +score < minScore)), onClick: () => onAdd(name.trim().slice(0, 20), missed ? target : null, known ? null : { color: face.color, avatar: face.avatar }) }, "Add " + nm) },
    ce("div", { className: "la-who" }, known ? ce(Tok, { p: { ...face, name: nm } })
        : ce("button", { type: "button", className: "ep-av la-face", onClick: () => setPicking(true), "aria-label": "Change " + nm + "'s face: card, photo or colour" }, ce(Tok, { p: { ...face, name: nm } }), ce("span", { className: "pe-badge", "aria-hidden": true }, kIcon("hanger"))),
      ce("div", { className: "kfield" }, ce("label", { htmlFor: "laName" }, "Name"),
        ce("input", { id: "laName", value: name, maxLength: 20, readOnly: !!known, onChange: e => setName(e.target.value), autoComplete: "off" }))),
    missed && ce(Fragment, null,
      ce("h3", { className: "sub" }, "Starts on"),
      ce(KSeg, { label: nm + " starts on", value: mode, onChange: setMode, options: [["high", "Highest total"], ["pick", "Choose a score"]] }),
      mode === "pick" ? ce("div", { className: "kfield la-score" }, ce("label", { htmlFor: "laScore" }, nm + "'s score"),
          ce("input", { id: "laScore", value: score, inputMode: "numeric", maxLength: 4, onChange: e => setScore(e.target.value.replace(/\D/g, "")) }),
          ce("small", null, (top.id ? "Highest total is " + pl(top.id).name + "'s " + top.total + ". " : "") + "Lowest is " + minScore + ", one point for each round missed."))
        : ce("p", { className: "fine" }, nm + " starts on " + top.total + (top.id ? ", level with " + pl(top.id).name + "." : "."))),
    ce("p", { className: "fine" }, nm + " plays from round " + (game.round + 1 + (Object.keys(game.scores[game.round] || {}).length ? 1 : 0)) + " and sits after " + lastSeat + ". Drag in Players to change the seat."),
    ce("button", { className: "link ink la-back", onClick: onBack }, "Back to Players"));
}
// The kit's segmented control (docs/ui-kit.html .kseg).
// One paper pill glides to the choice, as in the kit; the buttons share the width equally.
function KSeg({ label, value, onChange, options }) {
  const i = options.findIndex(o => o[0] === value);
  return ce("div", { className: "kseg glides" + (i < 0 ? " none" : ""), role: "group", "aria-label": label, style: { "--n": options.length, "--i": Math.max(0, i) } },
    ce("span", { className: "glide", "aria-hidden": true }),
    options.map(([v, t]) => ce("button", { key: v, type: "button", "aria-pressed": value === v, onClick: () => { haptic(6); onChange(v); } }, t)));
}
// The table's look: a tap changes it at once, and the page behind the sheet shows it. Used in Table settings and the game menu.
function LookPicker({ group, onLook, id }) {
  const [snap, setSnap] = useState(null);
  return ce("div", { className: "ts-look" }, ce("span", { className: "ts-lbl", id }, "Look"),
    ce("div", { className: "looks st-looks ts-looks", role: "radiogroup", "aria-labelledby": id }, MAPPED_LOOKS.map(k => { const T = LOOK_TILE[k], on = tableLook(group) === k;
      return ce("button", { key: k, type: "button", className: "look" + (snap === k ? " snap" : ""), role: "radio", "aria-checked": on, style: { "--c2": T.c[0], "--c3": T.c[1], "--c5": T.c[2] },
        onAnimationEnd: () => setSnap(null), onClick: () => { if (!on) { haptic(8); setSnap(k); onLook(k); } } }, ce("img", { src: "art/" + T.art + ".webp", alt: "" }), ce("span", { className: "tick", "aria-hidden": true }, kIcon("check")), ce("b", null, LOOKS[k].name)); })));
}
// Tables wear the four enamels in turn.
function TableSheet({ onClose, group, onRename, onLook, onDelete, onPlayers, games }) {
  const [name, setName] = useState(group.name), [asking, setAsking] = useState(false);
  const save = () => { const n = name.trim(); if (n && n !== group.name) onRename(n.slice(0, 30)); onClose(); };
  return ce(KSheet, { title: "Table settings", onClose, cls: "gm-sheet ts-sheet", foot: ce("button", { className: "kb", disabled: !name.trim(), onClick: save }, "Save") },
    ce(KNameField, { id: "tsName", label: "Name", value: name, onChange: setName, onEnter: save }),
    ce(LookPicker, { group, onLook, id: "tsLookL" }),
    ce("div", { className: "gm-list" },
      ce("button", { className: "gm-row", onClick: onPlayers }, ce("span", { className: "ts-faces", "aria-hidden": true }, group.players.slice(0, 3).map(p => ce(Tok, { key: p.id, p }))),
        ce("span", { className: "gm-t" }, ce("b", null, "Players"), ce("small", null, stPlural(group.players.length, "player") + " at this table · names and faces")), kIcon("chevl", "gm-chev")),
      ce(ScannerRow)),
    asking ? ce("div", { className: "ts-ask", role: "group", "aria-label": "Delete " + group.name + "?" },
        ce("p", null, ce("b", null, "Delete " + group.name + "?"), " " + (games ? stPlural(games, "game") + " and every award won here go with it." : "Its players go with it.")),
        ce("div", { className: "lc-bkp" }, ce("button", { className: "kb sm cream", onClick: () => setAsking(false) }, "Keep it"), ce("button", { className: "kb sm ruby", onClick: onDelete }, "Delete")))
      : ce("button", { className: "gm-row ts-del", onClick: () => games ? setAsking(true) : onDelete() }, ce("span", { className: "ts-bin", "aria-hidden": true }, kIcon("bin")),
        ce("span", { className: "gm-t" }, ce("b", null, "Delete table"), ce("small", null, "Removes its players and every game"))));
}
// The card scanner, turned on where it's used: a row in Table settings and the game menu that opens the setup in place (owner, 24 Nov).
function ScannerRow() {
  const [open, setOpen] = useState(false), [on, setOn] = useState(() => !!getAiKey());
  return ce(Fragment, null,
    ce("button", { className: "gm-row", onClick: () => setOpen(x => !x), "aria-expanded": open }, ce("img", { src: "art/icons/camera.webp", alt: "" }),
      ce("span", { className: "gm-t" }, ce("b", null, "Card scanner"), ce("small", null, on ? "On · counts a hand from one photo" : "Off · counts a hand from one photo")), kIcon("chevl", "gm-chev" + (open ? " open" : ""))),
    open && ce("div", { className: "gm-sheetin gm-scan" }, ce(AiKeyCard, { open: true, onSaved: () => setOn(true), onRemoved: () => setOn(false) })));
}
// brief: the score pad's version. Its form has no button of its own; the pad's main button submits it (formId), so there is one button, not two.
function AiKeyCard({ open, onSaved, onRemoved, cta, brief, formId }) {
  const [key, setKey] = useState(getAiKey), [draft, setDraft] = useState(""), [show, setShow] = useState(!!open);
  const save = () => { const k = draft.trim(); if (!k) return; setAiKey(k); setKey(k); setDraft(""); setShow(false); haptic(10); sound("save"); onSaved && onSaved(); };
  if (key) return ce("div", { className: "ak-on" }, ce("img", { src: "art/icons/camera.webp", alt: "" }),
    ce("span", { className: "grow" }, ce("b", null, "The scanner is on"), ce("small", null, "Key ending " + key.slice(-4) + " · saved on this phone only")),
    ce("button", { className: "qp", onClick: () => { setAiKey(""); setKey(""); setShow(!!open); onRemoved && onRemoved(); } }, "Remove"));
  if (show) return ce("form", { id: formId, className: "ak-form", onSubmit: e => { e.preventDefault(); if (!draft.trim()) { const i = document.getElementById("akKey"); i && i.focus(); return; } save(); } },
    ce("div", { className: "kfield" }, ce("label", { htmlFor: "akKey" }, brief ? "Scanner key" : "Anthropic API key"),
      ce("input", { id: "akKey", type: "password", value: draft, placeholder: brief ? "Paste the key" : "sk-ant-…", autoComplete: "off", spellCheck: false, onChange: e => setDraft(e.target.value), autoFocus: !open }),
      ce("small", null, brief ? "Paste the key once. It's saved on this phone only. Settings has the details." : "The scanner reads the cards with Claude, an AI service from Anthropic, so it needs a key from console.anthropic.com. The key stays on this phone and goes only to Anthropic. Each photo costs a few cents on that account.")),
    !formId && ce("button", { className: "kb", type: "submit", disabled: !draft.trim() }, cta || "Turn on the scanner"));
  return ce("p", { className: "lc-own" }, "It needs a one-time setup. ", ce("button", { className: "link", onClick: () => setShow(true) }, "Set up the scanner"));
}
// This game's house rules, to check or change. Changes count from now on.
function HouseSheet({ onClose, rules, setRules, note }) {
  return ce(KSheet, { title: "House rules", onClose, cls: "hr-sheet", foot: ce("button", { className: "kb", onClick: onClose }, "Done") },
    ce(KHouseRules, { rules, up: (k, v) => setRules(x => ({ ...x, [k]: v })) }),
    ce("p", { className: "fine" }, note || "Changes apply to this game from now on, and to this table's next games."));
}
function GameMenu({ onClose, game, group, onFinish, onEnd, onSettings, onPlayers, onHouse, onFix, onLook }) {
  const done = ROUNDS.filter((_, i) => roundDone(game, i)).length, r = ROUNDS[game.round];
  const fixable = ROUNDS.map((_, i) => i).filter(i => i !== game.round && roundDone(game, i));
  const [picking, setPicking] = useState(false), [asking, setAsking] = useState(false);
  const partial = Object.keys(game.scores[game.round] || {}).length > 0 && !roundDone(game, game.round);
  const row = (art, t, sub, onClick, extra) => ce("button", { className: "gm-row", onClick, ...extra }, ce("img", { src: "art/icons/" + art + ".webp", alt: "" }),
    ce("span", { className: "gm-t" }, ce("b", null, t), ce("small", null, sub)), kIcon("chevl", "gm-chev"));
  return ce(KSheet, { title: "This game", heading: group ? group.name : "This game", onClose, cls: "gm-sheet", footCls: "gm-foot",
      foot: ce("button", { className: "link gm-danger", onClick: onEnd }, game.reopened ? "Discard changes" : "End without saving") },
    ce("p", { className: "gm-where" }, "Round " + r.n + " of 7 · " + r.name + " · " + game.players.length + " playing"),
    group && onLook && ce(LookPicker, { group, onLook, id: "gmLookL" }),
    ce("div", { className: "gm-list" },
      row("friends", "Players", "Seats, sitting out, adding someone", onPlayers),
      done > 0 && row("scores", "Scores so far", "Every round on one sheet, and fixing a score", () => setPicking(x => !x), { "aria-expanded": picking }),
      picking && ce("div", { className: "gm-sheetin" }, ce(ScoreSheet, { game, pl: plOf(group, game), onRound: onFix, fixable, plain: true }),
        fixable.length > 0 && ce("p", { className: "fine" }, "Tap a round's number to fix its scores.")),
      row("dealerschoice", "House rules", rulesShort(game.rules), onHouse),
      ce(ScannerRow),
      row("settings", "Settings", "Text size, sounds and seeing", onSettings)),
    ce("div", { className: "gm-list gm-end" },
      !asking ? row("curtaincall", "Finish now and count", !done ? "Score a round first." : "Ends after round " + done + ". Lowest total wins.", () => done && setAsking(true), { disabled: !done })
        : ce("div", { className: "gm-ask", role: "group", "aria-label": "Finish now?" },
            ce("p", null, ce("b", null, "Finish after round " + done + "?"), partial ? " Round " + (game.round + 1) + " isn't finished, so it won't count." : " The lowest total wins."),
            ce("div", { className: "gm-ask-b" }, ce("button", { className: "kb sm cream", onClick: () => setAsking(false) }, "Keep playing"), ce("button", { className: "kb sm", onClick: onFinish }, "Finish now")))));
}
// Look tiles: the house look first, each with its jewel and the water's own colours (top, middle, deep).
const LOOK_TILES = [["midnight", "art/crown.webp", ["#3DBDB1", "#1C8E9D", "#0B5866"]], ["table", "art/jewel-spade.webp", ["#6F96FF", "#3463D8", "#17337E"]],
  ["lime", "art/jewel-club.webp", ["#A8DB62", "#458F25", "#1F5212"]], ["parlour", "art/jewel-heart.webp", ["#F07080", "#C42645", "#680D26"]],
  ["daylight", "art/jewel-diamond.webp", ["#FFFFFF", "#F2F2F2", "#DADADA"]]];
function HandCoach({ round, rules }) {
  const [busy, setBusy] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState(null), ref = useRef(null);
  async function onPhoto(e) { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await adviseHand(await resizeImage(f), round, rules)); haptic(12); } catch (x) { setErr(x.message); }
    setBusy(false); }
  return ce("section", { className: "coach" },
    ce("div", { className: "coach-head" }, ce("span", { className: "row-ic soft" }, ce(Icon, { n: "spark", size: 20 })),
      ce("span", null, ce("b", null, "Hand coach"), ce("small", null, "Photograph a hand, privately, for advice on this round."))),
    ce("input", { ref, type: "file", accept: "image/*", capture: "environment", hidden: true, onChange: onPhoto }),
    ce("button", { className: "btn tonal block", disabled: busy, onClick: () => ref.current && ref.current.click() }, ce(Icon, { n: "camera", size: 18 }), busy ? "Reading the hand…" : res ? "Ask again" : "Photograph the hand"),
    err && ce("p", { className: "scan-msg err", role: "alert" }, err),
    res && ce("dl", { className: "coach-out" }, [["I see", res.cards], ["In hand", res.have], ["Aim for", res.aim], ["Keep", res.keep], ["Discard", res.discard], ["Tip", res.tip]]
      .filter(x => x[1]).map(([k, v]) => ce(Fragment, { key: k }, ce("dt", null, k), ce("dd", null, v)))));
}
// A paper callout with an enamel medallion: the warning one is ruby.
function Call({ ic, t, warn, children }) {
  return ce("div", { className: "call" + (warn ? " warn" : "") }, ce("span", { className: "ci", "aria-hidden": true }, ce(Icon, { n: ic, size: 18 })), ce("div", null, ce("b", null, t), children));
}
function RoundGuide({ round, level, coach, rules, live, playing }) {
  const r = ROUNDS[round], G = GUIDE[round];
  const call = (ic, t, body, warn) => ce("div", { className: "rg-call" + (warn ? " warn" : "") }, ce("span", { className: "rg-m", "aria-hidden": true }, kIcon(ic)), ce("div", null, ce("b", null, t), body));
  return ce(Fragment, null,
    ce("div", { className: "rg-hero" },
      ce("span", { className: "lr-rn" }, "Round " + r.n + (live && round === playing ? " · playing now" : "")),
      ce("h3", null, r.name), ce(GoalMelds, { r }),
      ce("p", { className: "rg-goal" }, G.goal),
      ce("div", { className: "rg-facts" }, ce("span", null, ce("b", null, r.cards), "cards dealt"), ce("span", null, ce("b", null, G.inContract), "to lay down"),
        ce("span", null, ce("b", null, r.cards - G.inContract), r.goOut ? "fit in runs" : "left over"))),
    ce("div", { className: "rg-calls" },
      call("flag", "Watch out", ce("p", null, r.watch), true),
      call("down", "After going down", ce("p", null, G.after)),
      call("bulb", "Tips", ce("ul", null, G.tips.map(t => ce("li", { key: t }, t)))),
      call("bolt", "Pro tips", ce("ul", null, G.pro.map(t => ce("li", { key: t }, t))))),
    coach && ce(HandCoach, { round, rules }));
}
function RulesSheet({ onClose, round, rules, setRules, level, onLevel, initialTab, live, backTo }) {
  const [tab, setTab] = useState(initialTab === "how" ? "how" : "round");
  const back = backTo || (live ? "Back to the round" : null);
  // No title beside the back arrow: the Basics and Rounds switch says where you are (owner, 24 Nov). Screen readers still hear "How to play".
  return ce(KPage, { title: "How to play", onClose, backLabel: back || "Back", foot: back, cls: "kguide", bodyCls: "rg-body" },
    ce(RulesBody, { tab, setTab, round, rules, setRules, level, onLevel, live }));
}
// A full-screen page over everything, for reading: the Round guide and the cabinet. Back closes it.
const TIP_AMOUNTS = ["1", "3", "5"];
// One file with every table, game, award and setting on this phone.
function downloadBackup() {
  const d = { app: "May I?", v: 5, savedAt: now(), store: loadJSON(STORE_KEY, null), settings: loadJSON(SETTINGS_KEY, {}) };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: "application/json" }));
  a.download = "may-i-backup-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); haptic(10);
}
// What a phone would lose: finished games and the awards won in them.
function tally(games) {
  const done = games.filter(x => x.status === "done");
  return { games: done.length, awards: done.reduce((n, g) => n + gameAwards(g).filter(a => a.id && AWARDS[a.key]).length, 0) };
}
const shortDate = t => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
// Settings' short scanner row: whether it's on, and a way to remove the key. It's turned on from a table or the game menu.
function SetScanner() {
  const [key, setKey] = useState(getAiKey);
  return ce("div", { className: "prow" }, ce("span", { className: "grow" }, ce("b", null, key ? "On" : "Off"),
      ce("small", null, key ? "Key ending " + key.slice(-4) + ", saved on this phone only" : "Turn it on from a table's settings, the game's ••• menu, or the Photo tab when counting a hand")),
    key && ce("button", { className: "kb sm cream", onClick: () => { setAiKey(""); setKey(""); } }, "Remove"));
}
// Three faces for the before-and-after examples in Settings.
const EX_FACES = [{ name: "Ana", color: "red" }, { name: "Ben", color: "green" }, { name: "Cy", color: "amber" }];
function SettingsPage({ s, settings, setSettings, onBack, go, open, onRestore, setToast, tab }) {
  const up = (k, v) => setSettings(x => ({ ...x, [k]: v }));
  const sw = (k, t, d, def) => ce("div", { className: "prow" }, ce("span", { className: "grow" }, ce("b", null, t), ce("small", null, d)),
    ce(KSw, { on: settings[k] === undefined ? !!def : !!settings[k], onChange: v => up(k, v), label: t }));
  const [tipOpen, setTipOpen] = useState(false), [tip, setTip] = useState("3"), [other, setOther] = useState(""), [bk, setBk] = useState(null), fileRef = useRef(null);
  const amount = tip === "other" ? (/^\d{1,3}(\.\d{1,2})?$/.test(other.trim()) && +other >= 1 && +other <= 200 ? String(+other) : "") : tip;
  const toast = t => setToast && setToast(t);
  const saveBackup = () => { downloadBackup(); up("backupAt", now()); toast({ text: "Backup saved", sub: "Keep the file somewhere safe" }); };
  const kept = tally(Object.values((s || loadJSON(STORE_KEY, { games: {} })).games || {}));
  const pickBackup = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result), st = d.store || d; if (!st || typeof st.groups !== "object" || typeof st.games !== "object" || !Array.isArray(st.groupOrder)) throw 0;
        setBk({ st, at: d.savedAt, tables: Object.keys(st.groups).length, games: Object.values(st.games).filter(x => x.status === "done").length }); }
      catch (_) { toast({ text: "That file isn't a May I? backup" }); } };
    r.readAsText(f); };
  // As a tab it is a place with the tab bar. Opened from a game's menu it sits over the game, with a way back and no tabs.
  return ce("div", { className: "kit kscreen ksettings" + (tab ? " ktabbed" : "") },
    ce("div", { className: "ph-nav" }, !tab && ce("button", { className: "ib", onClick: onBack, "aria-label": "Back" }, kIcon("chevl")), ce("span", { className: "lbl" }, "Settings")),
    ce("main", { className: "ph-body lc-pad lc-set" },
      ce("h1", { className: "vh" }, "Settings"),
      // The tip, one short row near the top; the card opens in a sheet (owner, 24 Nov).
      SUPPORT_URL && ce("button", { className: "lc-tiprow", onClick: () => { haptic(6); setTipOpen(true); } }, ce("img", { src: "art/icons/goodsport.webp", alt: "" }),
        ce("span", { className: "grow" }, ce("b", null, "Buy the makers a cuppa"), ce("small", null, "May I? is free, with no ads")), kIcon("chev", "chev")),
      ce("h2", { className: "lc-h" }, "Text size"),
      ce("div", { className: "kt lc-prev", style: { "--fs": 1 }, "aria-hidden": true }, ce("img", { src: "art/crown.webp", alt: "" }), ce("div", null, ce("b", null, "Rachel leads by 12"), ce("span", null, "After round 4"))),
      ce(KSeg, { label: "Text size", value: String(settings.text || 1), onChange: v => up("text", +v), options: [["1", "Standard"], ["1.18", "Large"], ["1.36", "Largest"]] }),
      ce("h2", { className: "lc-h" }, "Seeing"),
      sw("contrast", "Sunlight contrast", "Brighter text, a darker table and bolder edges, for playing outside or in a bright room"),
      // A before and after, so the switch is clear before it's tried. The one in use wears the gold ring.
      ce("div", { className: "ex-pair", "aria-hidden": true },
        [false, true].map(on => ce("div", { key: String(on), className: "ex ex-sun" + (on ? " hi" : "") + (!!settings.contrast === on ? " cur" : "") },
          ce("span", { className: "ex-k" }, on ? "On" : "Off"),
          ce("div", { className: "ex-row" }, ce(Tok, { p: EX_FACES[0] }), ce("span", null, ce("b", null, "Ana"), ce("small", null, "15 points"))), ce("span", { className: "ex-btn" }, "Score round 4")))),
      sw("patterns", "Never colour alone", "Adds each player's initial to their face, for anyone who finds the colours hard to tell apart"),
      ce("div", { className: "ex-pair", "aria-hidden": true },
        [false, true].map(on => ce("div", { key: String(on), className: "ex ex-pat" + (!!settings.patterns === on ? " cur" : "") },
          ce("span", { className: "ex-k" }, on ? "On" : "Off"),
          ce("div", { className: "ex-faces" }, EX_FACES.map(p => ce("span", { key: p.name, className: "ex-f" }, ce(Tok, { p }), on && ce("i", null, p.name[0]))))))),
      ce("h2", { className: "lc-h" }, "Hands and sound"),
      ce("div", { className: "lc-opt" }, ce("span", null, ce("b", null, "Main buttons sit under"), ce("small", null, "The thumb that holds the phone")),
        ce(KSeg, { label: "Main buttons sit under", value: settings.hand === "left" ? "left" : "right", onChange: v => up("hand", v), options: [["left", "Left thumb"], ["right", "Right thumb"]] })),
      sw("sound", "Sounds", "Card snaps, chimes and a fanfare for the winner", true),
      sw("speak", "Read scores aloud", "Speaks the totals after each round"),
      ce("h2", { className: "lc-h" }, "During a game"),
      sw("awake", "Keep screen awake", "While a game is open", true),
      sw("calm", "Calm mode", "No sliding, no confetti, no fireworks. Already on if the phone asks for less motion."),
      sw("undo", "Undo last round", "Shows Undo after every saved round", true),
      ce("div", { className: "prow" }, ce("span", { className: "grow" }, ce("b", null, "Guide every round"), ce("small", null, "Opens the round guide as each round starts, for tables still learning")),
        ce(KSw, { on: settings.level === "new", onChange: v => up("level", v ? "new" : "pro"), label: "Guide every round" })),
      ce("h2", { className: "lc-h" }, "Backup"),
      ce("p", { className: "lc-own lc-left" }, kept.games
        ? [ce("b", { key: "n" }, stPlural(kept.games, "game") + " and " + stPlural(kept.awards, "award")), " live only on this phone. A backup file keeps them through a lost or new phone."]
        : "Every table, game and award lives on this phone. Save a copy before changing phones."),
      ce("p", { className: "lc-bkwhen" + (settings.backupAt ? "" : " never") }, settings.backupAt ? "Last saved " + shortDate(settings.backupAt) : "Never saved"),
      bk ? ce("div", { className: "lc-bkask", role: "group", "aria-label": "Load this backup?" },
          ce("p", null, ce("b", null, "Replace everything on this phone?"), " The backup" + (bk.at ? " from " + new Date(bk.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "") + " has " + stPlural(bk.tables, "table") + " and " + stPlural(bk.games, "finished game") + "."),
          ce("div", { className: "lc-bkp" }, ce("button", { className: "kb sm cream", onClick: () => setBk(null) }, "Keep what's here"), ce("button", { className: "kb sm", onClick: () => { onRestore(bk.st); setBk(null); } }, "Load the backup")))
        : ce("div", { className: "lc-bkp" }, ce("button", { className: "kb sm cream", onClick: saveBackup }, "Save a backup"), ce("button", { className: "kb sm cream", onClick: () => fileRef.current && fileRef.current.click() }, "Load a backup")),
      ce("input", { ref: fileRef, type: "file", accept: "application/json,.json", hidden: true, onChange: pickBackup }),
      ce("h2", { className: "lc-h" }, "Card scanner"),
      ce(SetScanner),
      tipOpen && ce(KSheet, { title: "Support May I?", onClose: () => setTipOpen(false), cls: "tip-sheet" }, ce("div", { className: "blk ruby lc-offer lc-tip" },
        ce("div", { className: "lc-cup", "aria-hidden": true },
          // Steam from the kit: soft wisps rising, warped by a slow noise filter. Still under Calm.
          ce("svg", { className: "lc-defs", width: 0, height: 0, "aria-hidden": true, focusable: false },
            ce("filter", { id: "lcWisp", x: "-50%", y: "-20%", width: "200%", height: "140%" },
              ce("feTurbulence", { type: "fractalNoise", baseFrequency: "0.022 0.05", numOctaves: 2, seed: 4 },
                ce("animate", { attributeName: "baseFrequency", dur: "9s", values: "0.022 0.05;0.026 0.035;0.022 0.05", repeatCount: "indefinite" })),
              ce("feDisplacementMap", { in: "SourceGraphic", scale: 18 }), ce("feGaussianBlur", { stdDeviation: 2.2 }))),
          ce("span", { className: "lc-steam" }, [["-16px", "7px", "-9deg", "0s"], ["6px", "-8px", "8deg", "-1.1s"], ["-4px", "10px", "-6deg", "-2.3s"], ["16px", "-6px", "11deg", "-3.2s"], ["-10px", "-9px", "5deg", "-4.4s"]]
            .map(([x, sx, r, d], i) => ce("i", { key: i, style: { "--x": x, "--s": sx, "--r": r, "--d": d } }))),
          ce("img", { src: "art/icons/goodsport.webp", alt: "" }),
          ce("span", { className: "lc-tea" }),
          ce("img", { className: "lc-heart", src: "art/suits/heart.webp", alt: "", style: { "--x": "-86px", "--y": "26px", "--r": "-16deg" } }),
          ce("img", { className: "lc-heart", src: "art/suits/heart.webp", alt: "", style: { "--x": "84px", "--y": "6px", "--r": "14deg" } })),
        ce("span", null, ce("b", null, "Buy the makers a cuppa"), ce("small", null, "May I? is free, with no ads. A tip helps us keep it that way.")),
        ce("div", { className: "lc-chips", role: "radiogroup", "aria-label": "Tip amount" },
          TIP_AMOUNTS.map(t => ce("button", { key: t, className: "qp" + (tip === t ? " on" : ""), role: "radio", "aria-checked": tip === t, onClick: () => { haptic(6); setTip(t); } }, "£" + t)),
          ce("button", { className: "qp" + (tip === "other" ? " on" : ""), role: "radio", "aria-checked": tip === "other", onClick: () => { haptic(6); setTip("other"); } }, "Other")),
        tip === "other" && ce("label", { className: "lc-other" }, ce("span", null, "£"),
          ce("input", { inputMode: "decimal", maxLength: 5, value: other, placeholder: "Any amount", "aria-label": "Tip in pounds", autoFocus: true, onChange: e => setOther(e.target.value) })),
        ce("a", { className: "kb wide lc-tipbtn" + (amount ? "" : " off"), href: SUPPORT_URL, target: "_blank", rel: "noopener", "aria-disabled": !amount || undefined,
          onClick: e => { if (!amount) e.preventDefault(); else { haptic(10); sound("win"); up("tipped", now()); } } }, amount ? "Tip £" + amount : tip === "other" && other.trim() ? "£1 to £200" : "Pick an amount")))));
}
function KPage({ title, onClose, backLabel, cls, bodyCls, children, foot }) {
  const [closing, setClosing] = useState(false), me = useRef(null);
  useEffect(() => { lockPage(true); return () => lockPage(false); }, []);
  const close = () => { if (closing) return; if (reducedMotion()) return onClose(); setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => { const k = e => { if (e.key !== "Escape") return; const all = document.querySelectorAll(".scrim, .kport"); if (all[all.length - 1] === me.current) close(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  useEffect(() => { const b = me.current && me.current.querySelector(".ph-nav .ib"), prev = document.activeElement; b && b.focus({ preventScroll: true });
    return () => setTimeout(() => { if (prev && prev.isConnected && document.activeElement === document.body) prev.focus({ preventScroll: true }); }, 0); }, []);
  return onTop(ce("div", { ref: me, className: "kit kport kpage" + (cls ? " " + cls : "") + (closing ? " out" : ""), role: "dialog", "aria-modal": true, "aria-label": title },
    ce("div", { className: "kpage-in" },
      ce("div", { className: "ph-nav" }, ce("button", { className: "ib", onClick: close, "aria-label": backLabel || "Back" }, kIcon("chevl")), ce("span", { className: "lbl" }, title)),
      ce("div", { className: "ph-body kp-body" + (bodyCls ? " " + bodyCls : "") }, children),
      foot && ce("div", { className: "kp-foot" }, ce("button", { className: "kb", onClick: close }, foot)))));
}
// The whole guide: rounds, basics, Q&A and house rules. Used by the Rules sheet and the Learn tab.
function RulesBody({ tab, setTab, round, rules, setRules, level, onLevel, live }) {
  const [r, setR] = useState(round || 0);
  const wilds = rules.jokersWild && rules.twosWild ? "Jokers and 2s stand in for any card." : rules.jokersWild ? "A joker stands in for any card." : rules.twosWild ? "A 2 stands in for any card." : null;
  const limit = buyLimitOf(rules), limitText = limit === Infinity ? "unlimited buys" : limit + (limit === 1 ? " buy" : " buys");
  const steps = (h, items) => ce("section", { className: "rg-sect" }, ce("h3", { className: "rg-h" }, h),
    ce("ol", { className: "rg-steps" }, items.map((x, i) => ce("li", { key: i, className: "rg-call" }, ce("span", { className: "rg-m n", "aria-hidden": true }, i + 1),
      ce("div", null, ce("b", null, x.t), ce("p", null, x.d.replace("{limit}", limitText)))))));
  return ce(Fragment, null,
    ce("div", { className: "rg-tabs" }, ce(KSeg, { label: "Guide section", value: tab, onChange: setTab, options: [["how", "Basics"], ["round", "Rounds"]] })),
    tab === "round" && ce(Fragment, null,
      ce("div", { className: "rg-pick", role: "tablist", "aria-label": "Round" }, ROUNDS.map((x, i) => ce("button", { key: i, role: "tab", "aria-selected": i === r, "aria-label": "Round " + x.n + ", " + x.name,
        className: live && i < (round || 0) ? "done" : "", onClick: () => { haptic(6); setR(i); } }, x.n))),
      ce(RoundGuide, { key: r, round: r, level, rules, live, playing: round || 0, coach: !!setRules && r === (round || 0) }),
      live && onLevel && ce("div", { className: "prow rg-every" }, ce("span", { className: "grow" }, ce("b", null, "Still learning?"), ce("small", null, "Open this guide as each round starts")),
        ce(KSw, { on: level === "new", onChange: v => onLevel(v ? "new" : "pro"), label: "Open this guide as each round starts" }))),
    tab === "how" && ce(Fragment, null,
      ce(Lesson, { rules }), steps("A turn", TURN_STEPS), steps("How “May I?” works", MAYI_STEPS),
      wilds && ce("section", { className: "rg-sect rg-wild" }, ce("h3", { className: "rg-h" }, "Wild cards"),
        ce("div", { className: "rg-word" }, ce("p", null, wilds + " Wilds can't outnumber the natural cards in a set or run: a set of three can hold one, a run of four can hold two. Left in hand, each costs " + wildPoints(rules) + "."),
          ce(GoalMelds, { r: { ex: [rules.jokersWild ? ["8H", "JOKER", "10H", "JH"] : ["8H", "2S", "10H", "JH"]] } })))),
    null);
}
// ── Lifetime achievements ─────────────────────────────────────────
// Earned once, for good, across every table a player sits at (the same name at another table counts as the same person).
// Each carries the date it was first earned. Back to back, Dynasty, Payback and Record breaker are judged table by table.
const LIFE = [
  ["crowned", "crown", "Crowned", "Won a game"], ["outgate", "out", "Out of the gate", "Went out in a round"], ["beginnersluck", "beginnersluck", "Beginner's luck", "Won their very first game"],
  ["grandtour", "grandtour", "Grand tour", "Went out in all seven rounds"], ["fullcabinet", "fullcabinet", "Full cabinet", "Won every game award at least once"],
  ["backtoback", "backtoback", "Back to back", "Won two games in a row at one table"], ["dynasty", "dynasty", "Dynasty", "Won three games in a row at one table"],
  ["payback", "payback", "Payback", "Won the rematch after losing the game before"], ["recordbreaker", "recordbreaker", "Record breaker", "Lowest winning total ever at their table"],
  ["untouchable", "untouchable", "Untouchable", "Went out in four rounds of one game"], ["nemesis", "nemesis", "Nemesis", "Beat the same person five times"],
  ["socialbutterfly", "socialbutterfly", "Social butterfly", "Played with 10 different people"], ["regular", "regular", "Regular", "Played 25 games"],
  ["furniture", "furniture", "Part of the furniture", "Played 100 games"], ["nightowl", "nightowl", "Night owl", "Finished a game after midnight"],
  ["earlybird", "earlybird", "Early bird", "Started a game before 9 am"], ["saycheese", "camera", "Say cheese", "Scored a hand with the camera"]];
// A photographed hand keeps each card's suit ("7S", "KH"); tapped hands are ranks only.
const SCANNED = /^(10|[2-9AJQK])[SHDC]$/;
function lifeAchievements(state, groupId, playerId) {
  const key = n => (n || "").trim().toLowerCase(), me = key(plOf(state.groups[groupId], null)(playerId).name);
  const all = Object.values(state.games || {}).filter(g => g.status === "done" && state.groups[g.groupId]).sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));
  const idAt = g => g.groupId === groupId ? playerId : ((state.groups[g.groupId].players || []).find(p => key(p.name) === me) || {}).id;
  const at = {}, earn = (k, t) => { if (!(k in at)) at[k] = t; };
  const run = {}, lost = {}, lowWin = {}, outRounds = new Set(), awards = new Set(), people = new Set(), beat = {};
  let n = 0;
  all.forEach(g => {
    const w = stWinners(g), id = idAt(g), t = g.endedAt || 0, gid = g.groupId, mineHere = id && g.players.includes(id);
    if (mineHere) {
      const won = w.ids.includes(id), tot = w.totals; n++;
      if (won) { earn("crowned", t); if (n === 1) earn("beginnersluck", t); if (lost[gid]) earn("payback", t); if (lowWin[gid] != null && w.best < lowWin[gid]) earn("recordbreaker", t); }
      run[gid] = won ? (run[gid] || 0) + 1 : 0; lost[gid] = !won;
      if (run[gid] >= 2) earn("backtoback", t); if (run[gid] >= 3) earn("dynasty", t);
      let outs = 0;
      stDoneRounds(g).forEach(i => { if (g.scores[i][id] === 0) { outs++; outRounds.add(i); } if (((g.hands || {})[i] || {})[id] && g.hands[i][id].some(c => SCANNED.test(c))) earn("saycheese", t); });
      if (outs) earn("outgate", t); if (outs >= 4) earn("untouchable", t); if (outRounds.size >= 7) earn("grandtour", t);
      gameAwards(g).forEach(a => { if (a.id === id) awards.add(a.key); }); if (awards.size >= AWARD_ORDER.length) earn("fullcabinet", t);
      const pl = plOf(state.groups[gid], g);
      g.players.forEach(o => { if (o === id) return; const k = key(pl(o).name); people.add(k); beat[k] = (beat[k] || 0) + (tot[id] < tot[o] ? 1 : 0); if (beat[k] >= 5) earn("nemesis", t); });
      if (people.size >= 10) earn("socialbutterfly", t); if (n >= 25) earn("regular", t); if (n >= 100) earn("furniture", t);
      if (t && new Date(t).getHours() < 5) earn("nightowl", t); if (g.startedAt && new Date(g.startedAt).getHours() >= 5 && new Date(g.startedAt).getHours() < 9) earn("earlybird", t);
    }
    lowWin[gid] = lowWin[gid] == null ? w.best : Math.min(lowWin[gid], w.best);
  });
  const best = Object.entries(beat).sort((a, b) => b[1] - a[1])[0], runNow = Math.max(0, ...Object.values(run));
  const near = { regular: [n, 25, "games played"], furniture: [n, 100, "games played"], socialbutterfly: [people.size, 10, "people played with"],
    grandtour: [outRounds.size, 7, "rounds gone out in"], fullcabinet: [awards.size, AWARD_ORDER.length, "game awards won"],
    nemesis: best ? [best[1], 5, "wins over one player"] : null, backtoback: [runNow, 2, "wins in a row"], dynasty: [runNow, 3, "wins in a row"] };
  return LIFE.map(([k, art, t, how]) => ({ key: k, art, t, how, at: k in at ? at[k] : null,
    near: !(k in at) && near[k] && near[k][0] > 0 ? { n: near[k][0], of: near[k][1], what: near[k][2] } : null }));
}
const dayMonth = t => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

// ── Shelf ─────────────────────────────────────────────────────────
// Medallions on gold rails with a spotlight above; tap one to bring it to the front. Used by the Hall of fame and the cabinet.
// sets: [{ key, label, items: [{ key, art, t, how, lit, st, said, badge }] }]. Unlit medallions wait greyed in dashed slots.
const AWARD_ORDER = ["clean", "bargain", "comeback", "steady", "heavy", "joker", "hattrick", "wiretowire", "photofinish", "heist", "upfrombottom", "selfmade",
  "curtaincall", "quickoff", "dealerschoice", "soclose", "rollercoaster", "friends", "aceupsleeve", "hotheels", "goodsport", "runmaker", "setcollector", "flawless"];
const timesWord = n => n === 1 ? "once" : n === 2 ? "twice" : n + " times";
function Shelf({ sets, label, lockable }) {
  const [cur, setCur] = useState(0), [pick, setPick] = useState({}), [bump, setBump] = useState(0), [all, setAll] = useState(false);
  const set0 = sets[Math.min(cur, sets.length - 1)], hide = lockable && !all && set0.items.some(x => x.lit);
  const set = hide ? { ...set0, items: set0.items.filter(x => x.lit || x.near) } : set0, pk = set.key + (hide ? ":lit" : "");
  const first = Math.max(0, set.items.findIndex(x => x.lit));
  const i = Math.min(pick[pk] != null ? pick[pk] : first, set.items.length - 1), it = set.items[i];
  const choose = k => { haptic(6); setPick(p => ({ ...p, [pk]: k })); setBump(b => b + 1); };
  return ce("div", { className: "cab" },
    (sets.length > 1 || lockable) && ce("div", { className: "cab-top" },
      sets.length > 1 && ce(KSeg, { label, value: set.key, onChange: k => { setCur(sets.findIndex(x => x.key === k)); setBump(b => b + 1); },
        options: sets.map(x => [x.key, ce(Fragment, null, x.label, ce("span", { className: "ct" }, x.items.filter(y => y.lit).length + "/" + x.items.length))]) }),
      lockable && ce("div", { className: "cab-lock" }, ce("span", { "aria-hidden": true }, "Show locked"), ce(KSw, { on: all, onChange: v => { setAll(v); setBump(b => b + 1); }, label: "Show locked" }))),
    ce("div", { className: "cab-spot" + (it.lit ? "" : " no"), "aria-live": "polite" },
      ce("span", { key: "m" + bump, className: "med" + (bump ? " pop" : "") }, ce("img", { src: "art/icons/" + it.art + ".webp", alt: "" })),
      ce("div", { key: "t" + bump, className: bump ? "slide" : "" }, ce("b", null, it.t), ce("p", null, it.how), ce("span", { className: "st" }, it.st),
        !it.lit && it.near && ce("span", { className: "pf-bar", "aria-hidden": true }, ce("i", { style: { width: Math.round(100 * it.near.n / it.near.of) + "%" } })))),
    ce("div", { key: set.key, className: "cab-grid", role: "group", "aria-label": set.label }, set.items.map((x, k) =>
      ce("button", { key: x.key, className: "cab-cell" + (x.lit ? "" : " no") + (!x.lit && x.near ? " near" : ""), "aria-pressed": k === i, "aria-label": x.said, style: { "--k": k }, onClick: () => { if (k !== i) choose(k); } },
        ce("span", { className: "med" }, ce("img", { src: "art/icons/" + x.art + ".webp", alt: "", loading: "lazy", decoding: "async" }), x.badge || null),
        ce("span", { className: "nm" }, x.t), !x.lit && x.near && ce("span", { className: "cab-bar", "aria-hidden": true }, ce("i", { style: { width: Math.round(100 * x.near.n / x.near.of) + "%" } }))))));
}

// ── Learn tab: the same guide the book opens in a game, starting on Basics ──
function LearnPage({ s, open, go }) {
  const last = Object.values(s.games).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0];
  const rules = { ...DEFAULT_RULES, ...((last && last.rules) || {}) };
  const [tab, setTab] = useState("how");
  return ce("div", { className: "kit kscreen klearn kguide" },
    ce("div", { className: "ph-nav" }, ce("span", { className: "lbl" }, "How to play")),
    ce("main", { className: "ph-body rg-body lc-learn" }, ce("h1", { className: "vh" }, "How to play May I?"),
      ce(RulesBody, { tab, setTab, round: 0, rules, setRules: null, level: null, live: false })));
}
// The basics as seven picture cards, each one sentence. Swipe on a phone; all on the page on a tablet.
function Lesson({ rules }) {
  const ace = rules.aceValue == null && rules.acesPosition === "both" ? "1 or 15" : String(acePoints(rules)), jk = String(wildPoints(rules));
  const lim = buyLimitOf(rules), buys = lim === Infinity ? "As many buys as anyone likes." : ["", "One buy", "Two buys", "Three buys", "Four buys", "Five buys"][lim] ? ["", "One buy", "Two buys", "Three buys", "Four buys", "Five buys"][lim] + " a round." : lim + " buys a round.";
  const pts = ace === jk ? "Ace and Joker at " + ace : "Ace at " + ace + " and Joker at " + jk;
  const [step, setStep] = useState(0), ref = useRef(null);
  const onScroll = () => { const el = ref.current; if (!el) return; const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0, d = Infinity; [...el.children].forEach((c, i) => { const dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (dd < d) { d = dd; best = i; } });
    if (best !== step) setStep(best); };
  const W = (rank, suit, x, y, r, cls) => ce(DeckCard, { key: rank + suit + x, rank, suit, className: "w" + (cls ? " " + cls : ""), style: { left: x, top: y, rotate: r + "deg" } });
  const back = (x, y, r, sm) => ce("img", { className: "lc-back" + (sm ? " sm" : ""), src: "art/card-back.webp", alt: "", style: { left: x, top: y, rotate: r + "deg" } });
  const steps = [
    ["Lowest score wins", null, ce(Fragment, null,
        ce("div", { className: "lc-arc" }, [-36, -24, -12, 0, 12, 24, 36].map(r => ce("img", { key: r, src: "art/card-back.webp", alt: "", style: { "--r": r + "deg" } }))),
        ce("img", { className: "lc-trophy", src: "art/icons/trophy.webp", alt: "" })),
      "Seven rounds. After each one, everyone counts the cards left in hand, and the lowest total after round 7 wins."],
    ["Sets", null, ce(Fragment, null, W("7", "spade", 4, 30, -10), W("7", "heart", 34, 24, 0), W("7", "club", 64, 30, 10),
        W("K", "diamond", 140, 30, -10), W("K", "spade", 170, 24, 0), W("K", "heart", 200, 30, 10)),
      "A set is three cards of the same rank. The suits don't matter."],
    ["Runs", null, ce(Fragment, null, W("8", "heart", 14, 34, -9), W("9", "heart", 72, 26, -3),
        ce(DeckCard, { key: "jk", joker: true, className: "w", style: { left: 130, top: 26, rotate: "3deg" } }), W("J", "heart", 188, 34, 9),
        rules.jokersWild && ce("span", { className: "lc-tag", style: { left: 163, top: 150, translate: "-50% 0", whiteSpace: "nowrap" } }, "Joker as 10♥")),
      rules.jokersWild ? "A run is four cards in a row, all one suit. A joker can fill the gap." : "A run is four cards in a row, all one suit."],
    ["The round's goal", "Round 2 · " + ROUNDS[1].name, ce(GoalMelds, { r: ROUNDS[1] }),
      "Each round asks for its own sets and runs. Lay the whole goal down in one turn, once a round.", "lc-ill-melds"],
    ["May I?", null, ce(Fragment, null, back(10, 44, -6), W("9", "heart", 96, 40, 4), back(178, 92, 18, true),
        ce("span", { className: "lc-plus1", style: { left: 206, top: 70 } }, "+1"), ce("span", { className: "kb sapphire sm lc-call" }, "May I?")),
      "Want someone else's discard? Call May I? and take it with one penalty card from the stock. " + buys],
    ["Going out", null, ce(Fragment, null, W("Q", "club", 20, 44, -8), W("Q", "spade", 50, 40, 0), W("Q", "heart", 80, 44, 8), W("Q", "diamond", 150, 6, 16, "lc-last-c"),
        ce("img", { className: "lc-out", src: "art/icons/out.webp", alt: "" })),
      "Play the last card to go out. Going out scores nothing for the round, and it ends for everyone."],
    ["Counting up", null, [["5", "diamond", "5"], ["10", "club", "10"], ["K", "spade", "10"], ["A", "spade", ace], [null, null, jk]].map(([rk, st, v], i) =>
        ce("span", { key: i }, ce("span", null, rk ? ce(DeckCard, { rank: rk, suit: st }) : ce(DeckCard, { joker: true })), ce("b", null, v))),
      "Everyone else adds up their hand: 2 to 9 at face value, 10 J Q K at 10, " + pts + ". House rules can change the last two.", "lc-ill-count"]];
  return ce("div", { className: "rg-lesson" },
      ce("div", { ref, onScroll, className: "guides lc-guides", tabIndex: 0, role: "region", "aria-label": "How to play in 7 steps. Scroll sideways for the next step." },
        steps.map(([h, line, ill, say, cls], i) => ce("article", { key: i, className: "gcard", "aria-label": "Step " + (i + 1) + " of 7" },
          ce("span", { className: "num" }, i + 1), ce("h3", null, h), line && ce("span", { className: "line" }, line),
          ce("div", { className: "lc-ill" + (cls ? " " + cls : ""), "aria-hidden": true }, ill), ce("p", { className: "lc-say" }, say)))),
      ce("div", { className: "lc-dots", "aria-hidden": true }, steps.map((_, i) => ce("i", { key: i, className: i === step ? "on" : "" }))),
      ce("p", { className: "lc-stepof vh", "aria-live": "polite" }, "Step " + (step + 1) + " of 7"));
}
// ── Stats tab: the trophy room across every table ─────────────────
function StatsPage({ s, open, go }) {
  const done = Object.values(s.games).filter(g => g.status === "done" && s.groups[g.groupId]);
  const won = done.map(g => [g, gameAwards(g)]);
  const and = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  // Hall of fame: who has won each award most often across every table. A tie at the top is shared.
  const hall = AWARD_ORDER.map(key => {
    const tally = {};
    won.forEach(([g, aw]) => aw.forEach(a => { if (a.key !== key) return; const k = g.groupId + ":" + a.id; tally[k] = tally[k] || { n: 0, p: plOf(s.groups[g.groupId], g)(a.id) }; tally[k].n++; }));
    const rows = Object.values(tally), top = rows.length ? Math.max(...rows.map(r => r.n)) : 0, who = rows.filter(r => r.n === top), names = and(who.map(r => r.p.name)), A = AWARDS[key];
    return { key, art: A.art, t: A.t, how: A.how, lit: who.length > 0,
      st: !who.length ? "Not won yet" : who.length > 1 ? "Shared by " + names + " · " + timesWord(top) + " each" : "Held by " + names + " · won " + timesWord(top),
      said: A.t + ", " + (!who.length ? "not won yet" : (who.length > 1 ? "shared by " : "held by ") + names),
      badge: who.length ? ce("span", { className: "holder", "aria-hidden": true }, who.slice(0, 2).map(r => ce(Tok, { key: r.p.id + r.p.name, p: r.p }))) : null };
  });
  const tables = s.groupOrder.map(id => s.groups[id]).filter(Boolean).map(g => { const st = groupStats(s, g.id), top = Object.entries(st.wins).sort((a, b) => b[1] - a[1]);
    const champ = top[0] && !(top[1] && top[1][1] === top[0][1]) ? plOf(g, null)(top[0][0]) : null; return { g, st, champ, wins: top[0] ? top[0][1] : 0 }; });
  const claimed = hall.filter(h => h.lit).length, nT = tables.filter(t => t.st.games.length).length;
  // Nearly there: the achievements closest to being earned, across everyone at every table (one line per person, their closest).
  const near = []; const seen = new Set();
  tables.forEach(({ g }) => (g.players || []).forEach(p => { const k = (p.name || "").trim().toLowerCase(); if (seen.has(k)) return; seen.add(k);
    const pp = plOf(g, null)(p.id), all = lifeAchievements(s, g.id, p.id).filter(x => x.near && x.near.n < x.near.of).sort((a, b) => b.near.n / b.near.of - a.near.n / a.near.of);
    if (all.length) near.push({ g, p: pp, all, f: all[0].near.n / all[0].near.of }); }));
  // Each line tries a different achievement, so four people don't all say the same thing.
  near.sort((a, b) => b.f - a.f); const used = new Set();
  const nearTop = near.slice(0, 4).map(x => { const a = x.all.find(y => !used.has(y.key)) || x.all[0]; used.add(a.key); return { ...x, a }; });
  // Players: one row per person (by name, across tables), most wins first. A tap opens their profile at the table they played most recently (owner, 24 Nov).
  const people = {};
  won.forEach(([g, aw]) => { const pl = plOf(s.groups[g.groupId], g), r = rankOf(g), best = r[0] && r[0].total;
    g.players.forEach(id => { const p = pl(id), k = (p.name || "").trim().toLowerCase(); if (!k) return;
      const o = people[k] = people[k] || { p, g: g.groupId, id, at: 0, games: 0, wins: 0, aw: 0 };
      o.games++; if (r.find(x => x.id === id && x.total === best)) o.wins++; o.aw += aw.filter(a => a.id === id).length;
      if ((g.endedAt || 0) > o.at) { o.at = g.endedAt || 0; o.g = g.groupId; o.id = id; o.p = p; } }); });
  const folk = Object.values(people).sort((a, b) => b.wins - a.wins || b.aw - a.aw || a.p.name.localeCompare(b.p.name));
  return ce("div", { className: "kit kscreen kstats" },
    ce("div", { className: "ph-nav" }, ce("span", { className: "lbl" }, "Stats")),
    ce("main", { className: "ph-body st-body" }, ce("h1", { className: "vh" }, "Stats"),
      ce("div", { className: "st-hero" }, ce("img", { src: "art/crown.webp", alt: "" }),
        ce("p", null, done.length ? stPlural(done.length, "game") + " across " + stPlural(nT, "table") + ", and " + claimed + " of " + AWARD_ORDER.length + " awards claimed"
          : "Finish a game and the awards, records and champions show up here.")),
      folk.length > 0 && ce("section", { className: "st-sect" }, ce("h2", { className: "sub" }, "Players"),
        ce("ul", { className: "st-folk" }, folk.map(o => ce("li", { key: o.p.name },
          ce("button", { onClick: () => { haptic(6); open("profile", { groupId: o.g, playerId: o.id }); }, "aria-label": o.p.name + ": " + stPlural(o.wins, "win") + ", " + stPlural(o.aw, "award") + " from " + stPlural(o.games, "game") + ". Open their awards and games" },
            ce(Tok, { p: o.p }), ce("span", { className: "grow" }, ce("b", null, o.p.name), ce("small", null, stPlural(o.games, "game") + " · " + stPlural(o.aw, "award"))),
            ce("span", { className: "st-wins" }, ce("b", null, o.wins), ce("small", null, o.wins === 1 ? "win" : "wins")), kIcon("chev", "chev")))))),
      nearTop.length > 0 && ce("section", { className: "st-sect" }, ce("h2", { className: "sub" }, "Nearly there"),
        ce("ul", { className: "st-near" }, nearTop.map(({ g, p, a }) => ce("li", { key: g.id + p.id },
          ce("button", { onClick: () => { haptic(6); open("profile", { groupId: g.id, playerId: p.id }); }, "aria-label": p.name + ", " + a.t + ": " + a.near.n + " of " + a.near.of + " " + a.near.what + ". Open " + p.name + "'s profile" },
            ce("span", { className: "med" }, ce("img", { src: "art/icons/" + a.art + ".webp", alt: "" })),
            ce("span", { className: "grow" }, ce("b", null, p.name + " · " + a.t), ce("small", null, a.near.n + " of " + a.near.of + " " + a.near.what),
              ce("span", { className: "pf-bar", "aria-hidden": true }, ce("i", { style: { width: Math.round(100 * a.near.n / a.near.of) + "%" } }))),
            ce(Tok, { p })))))),
      done.length > 0 && ce("section", { className: "st-sect" }, ce("h2", { className: "sub" }, "Hall of fame"),
        ce(Shelf, { label: "Hall of fame", lockable: true, sets: [{ key: "hall", label: "Hall of fame", items: hall }] }),
        ce("p", { className: "st-note" }, "Who has won each award most often, across every table. " + (AWARD_ORDER.length - claimed > 0 ? (AWARD_ORDER.length - claimed) + " still to find." : "Every award has a holder.")))));
}
// Bottom tabs on the three top-level screens, so nothing important hides behind an icon.
const TABS = [["home", "play", "Play"], ["learn", "rules", "Learn"], ["stats", "trophy", "Stats"]];
// Desktop: the tab bar becomes a rail on the left, with every table one click away (kit: Desktop · the table page).
function DeskRail({ s, view, go }) {
  const here = k => view.at === k ? "page" : undefined;
  const lnk = (k, art, label) => ce("button", { key: k, className: "dk-a", "aria-current": here(k), onClick: () => go({ at: k }) }, ce("img", { src: "art/icons/" + art + ".webp", alt: "" }), label);
  return ce("nav", { className: "kit dk-rail", "aria-label": "May I?" },
    ce("button", { className: "dk-logo", onClick: () => go({ at: "home" }), "aria-label": "May I? home" }, ce("img", { src: "art/logo-wordmark-v2.webp", alt: "" })),
    ce("div", { className: "dk-nav" }, ce("h2", null, "Tables"),
      s.groupOrder.map(id => s.groups[id]).filter(Boolean).map(t => {
        const live = Object.values(s.games).some(x => x.groupId === t.id && x.status === "live");
        return ce("button", { key: t.id, className: "dk-a", "aria-current": view.at === "group" && view.groupId === t.id ? "page" : undefined, onClick: () => go({ at: "group", groupId: t.id }) },
          ce("span", { className: "dk-t" }, t.name, live && ce("small", null, "Playing now")), ce("span", { className: "dk-avs" }, t.players.slice(0, 3).map(p => ce(Tok, { key: p.id, p })))); }),
      ce("button", { className: "dk-a dk-add", "aria-current": here("newtable"), onClick: () => go({ at: "newtable" }) }, ce("span", { className: "dk-plus" }, kIcon("plus")), "New table")),
    ce("div", { className: "dk-nav" }, lnk("home", "play", "Play"), lnk("learn", "rules", "Learn"), lnk("stats", "trophy", "Stats"), lnk("settings", "settings", "Settings")));
}
function TabBar({ at, go }) {
  return ce("div", { className: "kit ktabdock" }, ce(KTabs, { at, go }));
}
// ── Styles ────────────────────────────────────────────────────────
const CSS = `
:root { --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --display: "Fraunces", Georgia, serif; --label: "Barlow Condensed", "Arial Narrow", sans-serif; --num: "Barlow Semi Condensed", "Barlow Condensed", sans-serif;
  --out-e: cubic-bezier(.16,.84,.3,1); --spring: cubic-bezier(.34,1.3,.64,1); --hair: 1px; --r: 14px;
  /* Lagoon materials from the kit (docs/ui-kit.html): the water, gilt rims, enamel and paper */
  --g1: #6CE9BF; --g2: #3DBDB1; --g3: #1C8E9D; --g4: #106F7F; --g5: #0B5866;
  --gold-hi: #FFEDB0; --gilt: #E9B44C; --gold-lo: #A86F1B; --gold-deep: #6E4A10;
  --rim: linear-gradient(180deg, #FFEDB0 0%, #E6B04A 42%, #A86F1B 74%, #F4D27A 100%);
  --rim-soft: linear-gradient(180deg, #F2E2BA 0%, #CFAE6E 50%, #9C7A3E 100%);
  --teal-hi: #24979C; --teal-face: #177880; --teal: #136F78; --teal-lo: #0D5761; --teal-deep: #083E46;
  --sap-hi: #3C83CC; --sap: #215C9E; --sap-lo: #163F72;
  --ruby-hi: #D0485A; --ruby: #A8263B; --ruby-lo: #7A1529;
  --paper-hi: #FFFBEF; --paper: #FBF0D6; --paper-lo: #F1DDB3; --paper-line: #D9BE86;
  --paper-ink: #0F3247; --paper-ink2: #3D5361; --heart: #B3243A; --spade: #1B3F72; --club: #0E6A70;
  --lift: 0 18px 36px -14px rgba(0,0,0,.55);
  /* Per-look materials (Lagoon values here; other looks redefine them near the end of this sheet) */
  --g45: #0E6573; --orb1: 126,238,204; --orb2: 255,228,160; --tile: rgba(214,255,246,.11); --halo1: 108,233,191; --halo2: 61,189,177;
  --well-hi: #1C3A42; --well-lo: #12292F; --well2-hi: #2C434A; --well2-lo: #1C3036; --dis-hi: #3E7378; --dis-lo: #2F5D63;
  --panel-hi: #11606B; --panel-lo: #0A434C; --tab-hi: #0F5E69; --tab-lo: #093E47; --panel-ink2: #D9F3EC;
  --now-1: #1C8E9D; --now-2: #0F6874; --now-3: #0A4C56; --again-1: #0B4F5A; --again-2: #083E48;
  --gem-1: #D8FDFF; --gem-2: #7FD8E0; --gem-3: #2B8E9C; --sap-deep: #0E2C52;
  --hl: #FFE7A3; --gline: rgba(255,233,166,.18); --gline2: rgba(255,233,166,.42); --glass: rgba(255,251,239,.14); --glass-ink: rgba(255,247,226,.72); --track: rgba(0,0,0,.3);
  --scrim: rgba(2,24,30,.55); --veil: rgba(5,48,57,.9); --glow: 108,233,191; --glow2: 61,189,177; }
@media (min-resolution: 2dppx) { :root { --hair: .5px; } }
* { box-sizing: border-box; }
/* Only the root paints a colour. A body background would cover the ground layer. */
html { font-size: 17px; -webkit-text-size-adjust: 100%; background: var(--bg); overflow-x: clip; }
@supports (font: -apple-system-body) { html { font: -apple-system-body; } }
body { margin: 0; color: var(--ink); font-family: var(--font); line-height: 1.4; -webkit-font-smoothing: antialiased; overflow-x: clip; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; border: 0; background: none; padding: 0; -webkit-tap-highlight-color: transparent; transition: transform .25s var(--spring); }
button:active:not(:disabled) { transform: scale(.97); transition-duration: .08s; }
button:disabled { cursor: default; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 10px; }
::selection { background: var(--gold-soft); color: var(--ink); }
input { caret-color: var(--accent); }
.grow { flex: 1; }
.err { color: var(--red); font-weight: 600; margin: 4px 4px 0; }
.hint { color: var(--ink3); font-size: .88rem; text-align: center; margin: 0; }

/* The table: deep water, two slow lights orbiting under a suit pattern. Shown on looks that have a ground. */
.ground { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; display: none;
  background: radial-gradient(140% 100% at 50% 0%, var(--g4) 0%, var(--g45) 55%, var(--g5) 100%); }
:root[data-ground] .ground { display: block; }
.ground .orbit { position: absolute; left: 50%; top: 34%; width: 0; height: 0; animation: orbit 52s linear infinite; }
.ground .orbit.b { top: 72%; animation-duration: 74s; animation-direction: reverse; }
.ground .light { position: absolute; width: 84vmax; height: 84vmax; left: -42vmax; top: -42vmax; transform: translateX(30vmax);
  background: radial-gradient(closest-side, rgba(var(--orb1),.34), rgba(var(--orb1),.13) 50%, rgba(var(--orb1),0) 100%); }
.ground .orbit.b .light { transform: translateX(-28vmax); background: radial-gradient(closest-side, rgba(var(--orb2),.24), rgba(var(--orb2),.09) 50%, rgba(var(--orb2),0) 100%); }
.ground .suits-tile { position: absolute; inset: 0; background: var(--tile);
  -webkit-mask: url(art/suit-tile.webp) 0 0 / 252px 95px repeat; mask: url(art/suit-tile.webp) 0 0 / 252px 95px repeat; }
@keyframes orbit { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ground .orbit { animation: none; } }
/* The lights: two soft pools of the look's own colour in opposite corners, still, painted as plain gradients. */
.ground .orbit { display: none; }
.ground::before { content: ""; position: absolute; inset: 0; z-index: 0;
  background: radial-gradient(120% 62% at 0% 0%, rgba(var(--orb1), .3), transparent 62%), radial-gradient(110% 52% at 100% 100%, rgba(var(--orb1), .14), transparent 62%); }
.ground .suits-tile { z-index: 1; }
@keyframes drift { to { transform: rotate(360deg); } }

/* Nav + pages */
.page { min-height: 100vh; min-height: 100dvh; padding-bottom: calc(136px + env(safe-area-inset-bottom)); }
.nav { position: sticky; top: 0; z-index: 10; padding: env(safe-area-inset-top) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left)); border-bottom: 1px solid transparent; transition: background .25s, border-color .25s; }
.nav.collapsed { background: color-mix(in srgb, var(--bg) 82%, transparent); -webkit-backdrop-filter: saturate(160%) blur(20px); backdrop-filter: saturate(160%) blur(20px); border-bottom-color: var(--line); }
.nav-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 60px; max-width: 720px; margin: 0 auto; }
.nav-l { display: flex; min-width: 0; } .nav-r { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
.nav-title { font: 700 1.05rem/1.2 var(--display); opacity: 0; transform: translateY(4px); transition: opacity .2s, transform .25s var(--out-e); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48vw; }
.nav.collapsed .nav-title { opacity: 1; transform: none; }
/* Back: a round gilt-rimmed button, then the place it returns to in gold capitals */
.nav-back { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding-right: 8px; max-width: 44vw; color: var(--accent); font: 700 .86rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase; }
.nav-back span:not(.nb-ic) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-top: 1px; }
.nav-back:active:not(:disabled) { transform: none; }
/* Round icon buttons: teal enamel in a gilt rim */
.nav-icon, .nb-ic, .round-btn { position: relative; display: inline-grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid transparent; color: #FFF7E2;
  background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 var(--teal-deep), inset 0 1.5px 0 rgba(255,255,255,.25);
  transition: transform .12s ease, filter .2s ease; }
.nav-icon:active:not(:disabled), .round-btn:active:not(:disabled), .nav-back:active .nb-ic { transform: translateY(1px); filter: brightness(.86); }
.nav-icon.danger { color: #FFB4BC; }
.content { max-width: 720px; margin: 0 auto; padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
.large-title { font: 800 2.3rem/1.04 var(--display); font-variation-settings: "SOFT" 50; letter-spacing: -.015em; margin: 4px 4px 16px; text-wrap: balance; }
.lede { display: flex; align-items: center; gap: 8px; margin: -6px 4px 6px; color: var(--ink2); }
.lede svg { color: var(--gold-ring); flex: none; }

/* Inset grouped lists */
.group { margin-top: 26px; }
.group-h { margin: 22px 16px 8px; font: 700 .76rem/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); }
.group-f { font-size: .84rem; line-height: 1.4; color: var(--ink3); margin: 8px 16px 0; }
.list { background: var(--surface); border-radius: 20px; overflow: hidden; border: 1px solid var(--line); }
.row { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 10px 16px; text-align: left; color: var(--ink); }
.row + .row::before, .row + form.row::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: 1px; background: var(--line); }
.row:has(.row-lead) + .row::before { left: 68px; }
.row.tap { transition: background .15s; } .row.tap:active { background: color-mix(in srgb, var(--accent) 10%, transparent); transform: none; }
.row.col { flex-direction: column; align-items: stretch; gap: 10px; }
.row-lead { flex: none; display: flex; }
.row-main { flex: 1; min-width: 0; display: grid; gap: 2px; }
.row-main b { font: 700 1.08rem/1.2 var(--display); }
.row-main small { color: var(--ink2); font-size: .9rem; }
.row-trail { color: var(--ink2); flex: none; }
.row.accent .row-main b { color: var(--accent); }
.row.danger .row-main b { color: var(--red); text-align: center; }
.chev { color: var(--accent); flex: none; display: flex; }
/* Leading icons sit in a small enamel disc with a gilt rim */
.row-ic { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; border: 2px solid transparent; color: #FFF7E2;
  background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; }
.row-ic.soft { color: var(--ink2); background: linear-gradient(180deg, var(--well-hi), var(--well-lo)) padding-box, var(--rim-soft) border-box; }
.row-ic.add { color: #FFF7E2; }
.num-trail { display: grid; justify-items: end; line-height: 1.05; } .num-trail b { font: 600 1.3rem var(--num); color: var(--ink); font-variant-numeric: tabular-nums; } .num-trail small { font-size: .72rem; }
.avs { display: flex; } .avs .peg + .peg { margin-left: -9px; } .avs .peg { box-shadow: 0 0 0 2px var(--surface); }
.row.edit { gap: 10px; padding: 6px 8px 6px 12px; }
.row-input { flex: 1; min-width: 0; min-height: 44px; border: 0; background: transparent; font-size: 1rem; outline: none; color: var(--ink); }
.row-input.solo { padding: 0 16px; min-height: 54px; width: 100%; }
.row-input::placeholder { color: var(--ink3); }
.code-in { text-align: center; font: 600 1.5rem var(--num); letter-spacing: .25em; text-transform: uppercase; }

/* Buttons: enamel inside a gilt rim, with a gem stud at each end (kit .kb).
   Teal is the main action, cream the second, ruby the destructive one, and gold text the quiet one. */
.btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 24px 4px; border-radius: 999px; border: 2.5px solid transparent;
  font: 700 1.12rem/1 var(--display); font-variation-settings: "SOFT" 50; letter-spacing: .005em; color: #FFF7E2; white-space: nowrap;
  transition: transform .12s ease, box-shadow .12s ease, filter .2s ease; }
.btn svg { flex: none; }
.btn.lg { min-height: 56px; padding: 0 28px 4px; font-size: 1.22rem; }
.btn.sm { min-height: 42px; padding: 0 18px 3px; font-size: 1rem; }
.btn.block { width: 100%; }
.btn:is(.primary, .gold) { background: linear-gradient(180deg, var(--teal-face) 0%, var(--teal) 56%, var(--teal-lo) 100%) padding-box, var(--rim) border-box;
  box-shadow: inset 0 -5px 0 var(--teal-deep), inset 0 2px 0 rgba(255,255,255,.3); }
.btn:is(.tonal, .on-band) { color: var(--paper-ink); background: linear-gradient(180deg, var(--paper-hi) 0%, var(--paper) 58%, var(--paper-lo) 100%) padding-box, var(--rim) border-box;
  box-shadow: inset 0 -5px 0 #D9BE86, inset 0 2px 0 #fff; }
.btn.tonal.danger { color: #FFF7E2; background: linear-gradient(180deg, var(--ruby-hi) 0%, var(--ruby) 56%, var(--ruby-lo) 100%) padding-box, var(--rim) border-box;
  box-shadow: inset 0 -5px 0 #520C1B, inset 0 2px 0 rgba(255,255,255,.26); }
.btn.sm:is(.primary, .gold) { box-shadow: inset 0 -4px 0 var(--teal-deep), inset 0 2px 0 rgba(255,255,255,.26); }
.btn.sm.tonal { box-shadow: inset 0 -4px 0 #D9BE86, inset 0 2px 0 #fff; }
.btn.sm.tonal.danger { box-shadow: inset 0 -4px 0 #520C1B, inset 0 2px 0 rgba(255,255,255,.26); }
.btn:is(.primary, .gold, .tonal, .on-band)::before, .btn:is(.primary, .gold, .tonal, .on-band)::after { content: ""; position: absolute; top: 50%; width: 13px; height: 13px; margin-top: -7px;
  transform: rotate(45deg); border-radius: 2px; pointer-events: none; background: linear-gradient(135deg, var(--gem-1) 0%, var(--gem-2) 45%, var(--gem-3) 100%); border: 2px solid var(--gilt); }
.btn::before { left: -8px; } .btn::after { right: -8px; }
.btn.danger::before, .btn.danger::after { background: linear-gradient(135deg, #FFE3E6 0%, #F08A98 45%, #A8263B 100%); }
.btn.sm::before, .btn.sm::after { width: 10px; height: 10px; margin-top: -5px; border-width: 1.5px; }
.btn.sm::before { left: -6px; } .btn.sm::after { right: -6px; }
.btn:is(.primary, .gold):active:not(:disabled) { transform: translateY(2px); padding-bottom: 1px; box-shadow: inset 0 -2px 0 var(--teal-deep), inset 0 3px 7px rgba(0,0,0,.3); filter: brightness(.84); }
.btn:is(.tonal, .on-band):active:not(:disabled) { transform: translateY(2px); padding-bottom: 1px; box-shadow: inset 0 -2px 0 #D9BE86, inset 0 3px 6px rgba(110,74,16,.18); }
.btn.tonal.danger:active:not(:disabled) { box-shadow: inset 0 -2px 0 #520C1B, inset 0 3px 7px rgba(0,0,0,.3); filter: brightness(.88); }
.btn:is(.primary, .gold, .tonal, .on-band):disabled { color: rgba(255,247,226,.62); filter: saturate(.35); background: linear-gradient(180deg, var(--dis-hi), var(--dis-lo)) padding-box, var(--rim-soft) border-box; box-shadow: inset 0 -3px 0 rgba(0,0,0,.18); }
.btn:disabled::before, .btn:disabled::after { border-color: #B49A68; }
/* Quiet action: gold words with a soft underline */
.btn.plain { min-height: 44px; padding: 0 8px; border: 0; color: var(--accent); font: 700 1rem/1.25 var(--display); white-space: normal; text-align: center;
  text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); text-underline-offset: 4px; }
/* Out: an outlined pill that fills with teal once chosen */
@keyframes nudge { 0%, 60%, 100% { transform: none; } 70% { transform: translateY(-2px); } 80% { transform: none; } }
.dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 8; display: flex; justify-content: center; padding: 18px max(24px, env(safe-area-inset-right)) calc(14px + env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg) 92%, transparent) 45%); }
.dock > * { max-width: 680px; }

/* Peg avatar */
.peg { flex: none; border-radius: 50%; display: inline-grid; place-items: center; background: var(--peg); color: var(--peg-ink); font-weight: 700; line-height: 1; }
.peg.ring { box-shadow: 0 0 0 2.5px var(--surface), 0 0 0 5px var(--gold-ring); }

/* Home */

/* Cards (em-sized) */
.pc { position: relative; display: inline-block; flex: none; width: 2.9em; height: 4.1em; border-radius: .42em; background: linear-gradient(170deg, #FFFFFF, #F6F5F1); color: #15181A;
  box-shadow: 0 0 0 .5px rgba(20,24,30,.28), 0 1px 1px rgba(0,0,0,.08), 0 3px 8px -3px rgba(0,0,0,.35); font-size: 10px; }
.pc.red { color: #C8283A; }
.pc + .pc { margin-left: -1.15em; }
.pc-corner { position: absolute; top: .3em; left: .35em; display: grid; justify-items: center; line-height: .95; }
.pc-corner b { font: 700 1.1em/1 var(--font); letter-spacing: -.05em; } .pc-corner i { font-style: normal; font-size: .95em; }
.pc-pip { position: absolute; right: .3em; bottom: .15em; font-size: 1.8em; line-height: 1; }
.melds { display: flex; flex-wrap: wrap; gap: 10px; } .meld { display: inline-flex; }
.meld .pc:nth-child(2) { transform: translateY(-1px); } .meld .pc:nth-child(3) { transform: translateY(-2px); }

/* Game */
.game { min-height: 100vh; min-height: 100dvh; }
[data-look="daylight"] .finale, [data-look="daylight"] .scoreboard { box-shadow: inset 0 0 0 2px #000; }
.nav-back.on-band, .nav-icon.on-band { color: var(--band-ink); }
.crown-ic { color: var(--gold-ring); display: inline-flex; } .crown-ic svg { fill: currentColor; }
/* Scoreboard */
.scoreboard { min-height: 100vh; min-height: 100dvh; padding: 24px 32px; display: flex; flex-direction: column; gap: 20px; color: var(--band-ink);
  background: radial-gradient(120% 140% at 30% 0%, color-mix(in srgb, var(--band) 86%, #fff) 0%, var(--band) 45%, var(--band2) 100%); }
.sb-head { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; } .sb-head > span:first-child { color: var(--band-ink2); font-weight: 600; }
.sb-head h1 { margin: 0; font: 700 2.6rem var(--display); letter-spacing: -.01em; } .sb-head .melds { font-size: 13px; }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; vertical-align: 1px; }

/* Recap */
.scoreboard .peg { box-shadow: 0 0 0 3px #fff, 0 4px 10px -1px rgba(10,20,60,.32); }

/* Sheets */
/* Tab bar */
/* The tray floats over the water. The chosen tab's icon lifts, and a gold pip slides beneath it. */
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9; display: flex; justify-content: center; pointer-events: none;
  padding: 22px max(12px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg) 88%, transparent) 60%); }
.tabbar-in { pointer-events: auto; position: relative; display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; max-width: 460px; padding: 6px 10px 10px; border-radius: 26px; border: 2.5px solid transparent;
  background: linear-gradient(180deg, var(--tab-hi), var(--tab-lo)) padding-box, var(--rim) border-box; box-shadow: var(--lift); }
.tabbar-in::after { content: ""; position: absolute; bottom: 7px; left: calc(10px + (100% - 20px) / 3 * (var(--i, 0) + .5)); width: 8px; height: 8px; margin-left: -4px;
  rotate: 45deg; border-radius: 1.5px; background: var(--gilt); transition: left .48s var(--spring); }
.tab { position: relative; display: grid; justify-items: center; gap: 3px; min-height: 44px; padding: 2px 6px 10px; font: 700 .8rem/1 var(--label); letter-spacing: .12em; text-transform: uppercase; color: var(--panel-ink2); }
.tab img { width: 46px; height: 46px; object-fit: contain; filter: saturate(.55) brightness(.82); transition: transform .3s var(--spring), filter .2s ease; }
.tab.on { color: #FFE7A3; }
.tab.on img { filter: drop-shadow(0 6px 8px rgba(0,0,0,.4)); transform: translateY(-6px) scale(1.08); }
.tab:active:not(:disabled) { transform: none; } .tab:active img { transform: translateY(-2px) scale(.94); }
@media (prefers-reduced-motion: reduce) { .tabbar-in::after { transition: none; } }
.page-lede { margin: -6px 4px 14px; color: var(--ink2); font-size: 1rem; line-height: 1.45; max-width: 52ch; }
.empty-state { display: grid; justify-items: center; text-align: center; gap: 8px; padding: 36px 20px; border-radius: 20px; background: var(--surface); box-shadow: 0 0 0 var(--hair) var(--line); }
.empty-state h2 { margin: 4px 0 0; font: 700 1.4rem var(--display); letter-spacing: -.005em; } .empty-state p { margin: 0; color: var(--ink2); max-width: 32ch; line-height: 1.45; }
.empty-ic { width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; background: var(--gold-soft); color: var(--ink); }
.row-add { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: none; }
html.locked, html.locked body { overflow: hidden; overscroll-behavior: none; }
.scrim { position: fixed; left: 0; right: 0; top: var(--vv-top, 0px); height: var(--vv-h, 100%); z-index: 30; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; animation: fade .2s ease both; }
.scrim.out { animation: fade .24s ease reverse both; }
/* Sheets are cream paper inside a gilt rim. Inside one the ink turns dark and the accents turn deep gold and teal. */
.sheet { --bg: #FBF0D6; --surface: rgba(255,255,255,.5); --fill: rgba(110,74,16,.09); --line: rgba(196,148,62,.34); --ink: var(--paper-ink); --ink2: var(--paper-ink2); --ink3: #556670;
  --accent: #8B5A12; --accent-ink: #FFF7E2; --accent-soft: rgba(168,111,27,.13); --red: #A8263B; --out: #0E6A55; --out-soft: rgba(14,106,85,.12); --gold: #8B5A12; --gold-soft: rgba(233,180,76,.24); --focus: var(--teal);
  position: relative; width: 100%; max-width: 560px; max-height: 94vh; max-height: calc(var(--vv-h, 100dvh) - 20px); display: flex; flex-direction: column; overflow: hidden; color: var(--ink);
  border: 3px solid transparent; border-bottom-width: 0; border-radius: 26px 26px 0 0;
  background: radial-gradient(120% 60% at 50% 0%, var(--paper-hi), var(--paper) 60%, var(--paper-lo)) padding-box, var(--rim) border-box;
  box-shadow: 0 -12px 40px rgba(0,0,0,.32); animation: up .5s var(--out-e) both; }
.sheet.out { animation: down .24s ease-in both; } .sheet.drag { animation: none; transition: none; } .sheet.tall { min-height: min(72vh, calc(var(--vv-h, 100dvh) - 20px)); }
@media (min-width: 700px) { .scrim { align-items: center; } .sheet { border-radius: 26px; border-bottom-width: 3px; max-height: 86vh; } }
.sheet-head { display: flex; align-items: center; gap: 10px; padding: 18px 12px 6px 22px; position: relative; touch-action: none; }
.grab { position: absolute; top: 7px; left: 50%; width: 44px; height: 5px; border-radius: 9px; background: rgba(110,74,16,.3); transform: translateX(-50%); }
.sheet-head h2 { flex: 1; margin: 4px 0 0; font: 800 1.4rem/1.1 var(--display); letter-spacing: -.005em; text-wrap: balance; }
.sheet-head .icon-btn, .ib-cream { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; border: 2.5px solid transparent; color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 #D9BE86, inset 0 1.5px 0 #fff; transition: transform .12s ease, filter .2s ease; }
.sheet-head .icon-btn:active, .ib-cream:active { transform: translateY(1px); filter: brightness(.94); }
.sheet-body { padding: 8px 18px 20px; overflow-y: auto; display: grid; grid-auto-rows: max-content; gap: 12px; align-content: start; overscroll-behavior: contain; }
.sheet-body > .group-h { margin-bottom: -5px; } .sheet-body > .group-f { margin-top: -5px; }
.sheet-foot { padding: 12px 22px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid rgba(196,148,62,.35); background: rgba(241,221,179,.5); }
.sheet .group-h { color: #7A5A1E; }
.sheet .row-ic.soft { color: var(--paper-ink2); background: linear-gradient(180deg, #FFFDF6, #F1DDB3) padding-box, var(--rim-soft) border-box; }
.sheet .round-btn { color: var(--paper-ink); background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 #D9BE86, inset 0 1.5px 0 #fff; }
/* Segmented control: a dark trough, and one paper pill that glides to the choice. On paper the trough is light and the pill is teal. */
.seg { position: relative; display: flex; padding: 4px; gap: 4px; border-radius: 99px; border: 2px solid transparent;
  background: linear-gradient(180deg, var(--well-hi), var(--well-lo)) padding-box, var(--rim-soft) border-box; box-shadow: inset 0 3px 6px rgba(0,0,0,.35); }
.seg::before { --w: calc((100% - 8px - (var(--n, 1) - 1) * 4px) / var(--n, 1)); content: ""; position: absolute; z-index: 0; top: 4px; bottom: 4px; width: var(--w); left: calc(4px + var(--i, 0) * (var(--w) + 4px));
  border-radius: 99px; border: 1.5px solid var(--gilt); background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)); box-shadow: inset 0 -3px 0 #D9BE86, 0 2px 4px rgba(0,0,0,.3);
  transition: left .42s var(--spring); }
.seg.none::before { opacity: 0; }
.seg button { position: relative; z-index: 1; flex: 1; min-width: 0; min-height: 40px; padding: 0 6px; border-radius: 99px; font: 700 .92rem/1.1 var(--display); color: rgba(255,247,226,.82); transition: color .16s ease; }
.seg button.on { color: var(--paper-ink); }
.sheet .seg { background: linear-gradient(180deg, #E9D7AE, #F3E6C6) padding-box, var(--rim-soft) border-box; box-shadow: inset 0 2px 5px rgba(110,74,16,.25); }
.sheet .seg button { color: #5C4A2A; } .sheet .seg button.on { color: #FFF7E2; }
.sheet .seg::before { background: linear-gradient(180deg, var(--teal-face), var(--teal-lo)); box-shadow: inset 0 -3px 0 var(--teal-deep), 0 2px 4px rgba(0,0,0,.25); }
@media (prefers-reduced-motion: reduce) { .seg::before { transition: none; } }
/* Switch: a dark slot that turns teal, a paper knob, and ON or OFF in the slot */
.switch { position: relative; width: 78px; height: 38px; flex: none; border-radius: 99px; border: 2.5px solid transparent;
  background: linear-gradient(180deg, var(--well2-hi), var(--well2-lo)) padding-box, var(--rim-soft) border-box; box-shadow: inset 0 3px 5px rgba(0,0,0,.35); transition: background .25s ease; }
.switch span { position: absolute; top: 50%; right: 11px; transform: translateY(-50%); font: 800 .8rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase; color: rgba(255,247,226,.62); }
.switch i { position: absolute; top: 3px; left: 3px; width: 27px; height: 27px; border-radius: 50%; transition: transform .28s var(--spring), scale .12s ease;
  background: radial-gradient(circle at 38% 30%, #FFFFFF 0%, #FBF0D6 46%, #DCC291 100%); border: 1.5px solid var(--gilt); box-shadow: 0 2px 3px rgba(0,0,0,.3); }
.switch.on { background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; }
.switch.on span { left: 12px; right: auto; color: #FFF7E2; }
.switch.on i { transform: translateX(40px); }
.switch:active:not(:disabled) { transform: none; } .switch:active i { scale: .9; }
.stepper { display: flex; align-items: center; gap: 16px; justify-content: center; } .stepper b { font: 700 2rem/1 var(--num); min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums; }
.pick { flex: 1; display: flex; align-items: center; gap: 12px; min-height: 44px; text-align: left; } .pick b { font: 700 1.05rem/1.2 var(--display); }
/* Check: a small rimmed square that fills with teal */
.check { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 9px; border: 2px solid transparent; color: #FFF7E2;
  background: linear-gradient(180deg, var(--well-hi), var(--well-lo)) padding-box, var(--rim-soft) border-box; transition: background .2s ease; }
.check.on { background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; }
.check.on svg { animation: pop .3s var(--spring) both; }
.sheet .check:not(.on) { background: linear-gradient(180deg, #F6EBD0, #fff) padding-box, var(--rim-soft) border-box; }
.deal-chip { flex: none; min-height: 32px; padding: 0 12px; border-radius: 99px; border: 1.5px solid rgba(255,233,166,.38); font: 700 .78rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
.deal-chip.on { color: var(--paper-ink); border-color: var(--gilt); background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)); }
.sheet .deal-chip { color: #5C4A2A; border-color: rgba(168,111,27,.5); }
.sheet .deal-chip.on { color: #FFF7E2; border-color: var(--gilt); background: linear-gradient(180deg, var(--teal-face), var(--teal-lo)); }
.note { background: var(--gold-soft); color: var(--ink); border-radius: 12px; padding: 12px 14px; font-size: .9rem; margin: 0; }
.code-box { display: grid; text-align: center; padding: 18px; border-radius: 14px; background: var(--surface); box-shadow: 0 0 0 var(--hair) var(--line); }
.code-box small { color: var(--ink3); font-weight: 600; } .code { font: 700 2.4rem var(--num); letter-spacing: .14em; }
.credits { margin: 0; padding: 0 16px 8px; text-align: center; color: var(--ink3); font-size: .74rem; line-height: 1.4; }
.tip-link { text-align: center; color: var(--ink3); font-size: .9rem; padding: 10px; text-decoration: none; } .tip-link b { color: var(--accent); }
.rc-melds { display: flex; justify-content: center; margin: 10px 0; } .rc-melds .melds { justify-content: center; font-size: 13px; } .rc-melds .pc { font-size: 11px; }
.facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; text-align: left; }
.facts li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: #F4F1EA; font-size: .92rem; } .facts svg { flex: none; margin-top: 1px; color: #6B5A2A; }
.rnum { width: 30px; height: 30px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; font: 600 .9rem var(--num); }
.rnum.on { background: var(--accent); color: var(--accent-ink); }
.values { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.values div { background: var(--surface); box-shadow: 0 0 0 var(--hair) var(--line); border-radius: 12px; padding: 10px 4px; text-align: center; display: grid; gap: 2px; }
.values span { font-size: .75rem; color: var(--ink3); font-weight: 600; } .values b { font: 600 1.05rem var(--num); }

/* Toast */
/* A small banner in deep teal inside a gilt rim */
.toast { position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 60; width: max-content; max-width: calc(100vw - 32px);
  padding: 12px 20px; border-radius: 16px; border: 2.5px solid transparent; color: #FFF7E2; font: 700 1rem/1.25 var(--display);
  background: linear-gradient(180deg, var(--panel-hi) 0%, var(--panel-lo) 100%) padding-box, var(--rim) border-box; box-shadow: var(--lift); animation: toastIn .5s var(--spring) both; }


/* Toast with Undo */
.toast.has-undo { display: flex; align-items: center; gap: 14px; padding: 6px 6px 6px 18px; }
.toast-undo { min-height: 38px; padding: 0 16px; border-radius: 99px; border: 2px solid transparent; color: var(--paper-ink); font: 700 .86rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase;
  background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 #D9BE86, inset 0 1.5px 0 #fff; }
.list.gap { margin-top: 22px; }

/* Coaching: round guide, steps, Q&A, rule hints */
.pc.joker { color: #7A4BD8; }
.rpick { display: flex; justify-content: space-between; gap: 6px; }
.rpick .rnum { width: 40px; height: 40px; font-size: 1rem; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; position: relative; }
.steps li { display: grid; grid-template-columns: 30px 1fr; gap: 12px; padding: 0 0 16px; position: relative; }
.steps li:not(:last-child)::before { content: ""; position: absolute; left: 14.5px; top: 30px; bottom: 2px; width: 1px; background: var(--line); }
.step-n { width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; font: 700 .9rem var(--num); }
.steps b { display: block; font-weight: 600; margin-top: 4px; } .steps small { display: block; color: var(--ink2); font-size: .9rem; line-height: 1.4; margin-top: 2px; }
.qa { border-bottom: var(--hair) solid var(--line); } .qa:last-child { border-bottom: 0; }
.qa summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; padding: 12px 16px; font-weight: 600; cursor: pointer; }
.qa summary::-webkit-details-marker { display: none; }
.qa summary svg { flex: none; color: var(--ink3); transition: transform .2s var(--out-e); } .qa[open] summary svg { transform: rotate(90deg); }
.qa p { margin: 0; padding: 0 16px 14px; color: var(--ink2); line-height: 1.45; }
.gloss { gap: 4px; } .gloss small { color: var(--ink2); line-height: 1.4; } .gloss-ex { font-size: 11px; margin-top: 6px; }
.rule-top { display: flex; justify-content: space-between; align-items: center; }
.rule-meta { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: start; }
.rule-meta small, .rule-hint { color: var(--ink2); font-size: .86rem; line-height: 1.35; }
.why { color: var(--accent); font-weight: 600; font-size: .86rem; padding: 0 2px; min-height: 28px; }
.why-text { grid-column: 1 / -1; margin: 2px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--fill); font-size: .88rem; line-height: 1.4; color: var(--ink2); }
.sheet-lede { margin: 0; color: var(--ink2); }
.level-pick { display: grid; gap: 10px; }
.level { display: grid; grid-template-columns: 44px 1fr; gap: 2px 12px; text-align: left; padding: 16px; border-radius: 16px; background: var(--surface); box-shadow: 0 0 0 var(--hair) var(--line); }
.level .row-ic { grid-row: span 2; width: 44px; height: 44px; border-radius: 12px; } .level b { font-weight: 600; font-size: 1.05rem; } .level small { color: var(--ink2); line-height: 1.35; }
.level:active { transform: scale(.98); }

/* Card scanner and hand coach */
.code-box.idle { cursor: default; }
@keyframes pulse { 50% { transform: scale(.92); opacity: .7; } }
.scan-msg { margin: 0; font-size: .86rem; color: var(--ink2); text-align: center; line-height: 1.35; } .scan-msg.err { color: var(--red); }
.row-input.boxed { background: var(--fill); border-radius: 10px; padding: 0 12px; }
.coach { display: grid; gap: 12px; margin-top: 10px; padding: 16px; border-radius: 16px; background: var(--surface); box-shadow: 0 0 0 var(--hair) var(--line); }
.coach-head { display: flex; gap: 12px; align-items: flex-start; } .coach-head b { display: block; font-weight: 600; } .coach-head small { color: var(--ink2); line-height: 1.35; }
.coach-out { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; }
.coach-out dt { font-size: .8rem; font-weight: 600; color: var(--ink3); padding-top: 2px; } .coach-out dd { margin: 0; line-height: 1.4; }

/* Stats: race, awards, caught bars, profiles */
.sb-chase { margin: 0; color: var(--band-ink2); font-size: clamp(1rem, 1.6vw, 1.4rem); text-align: center; }
.row-ic.award { background: var(--gold-soft); color: var(--gold); }
.list.pad { padding: 14px 16px; display: grid; gap: 10px; }
.bar-row { display: grid; grid-template-columns: 110px 1fr 40px; gap: 10px; align-items: center; font-size: .88rem; }
.bar { height: 10px; border-radius: 5px; background: var(--fill); overflow: hidden; } .bar i { display: block; height: 100%; border-radius: 5px; background: var(--accent); }
.bar-row b { text-align: right; font: 600 .9rem var(--num); }
.facts-list { margin: 4px 0 0; padding: 10px 0 0 18px; border-top: var(--hair) solid var(--line); display: grid; gap: 6px; color: var(--ink2); font-size: .9rem; line-height: 1.4; } .facts-list:empty { display: none; }
.facts-list b { color: var(--ink); font-weight: 600; }
.h2h b { font: 700 1.1rem var(--num); } .h2h b.up { color: var(--out); } .h2h b.down { color: var(--red); }

/* Game world: bright colour fields dotted like a game board, lit inside their shape with a thick lower lip */
.band, .now-card:not(.again), .finale, .scoreboard, .hero.felt, .av-stage {
  background-color: var(--band);
  background-image: radial-gradient(circle, rgba(255,255,255,.16) 0 2.6px, transparent 3.1px), radial-gradient(circle, rgba(255,255,255,.08) 0 2.6px, transparent 3.1px), linear-gradient(180deg, color-mix(in srgb, var(--band) 92%, #fff) 0%, var(--band) 40%, var(--band2) 100%);
  background-size: 24px 24px, 24px 24px, auto; background-position: 0 0, 12px 12px, 0 0;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.24), inset 0 -6px 0 color-mix(in srgb, var(--band2) 78%, #000); }
[data-look="lime"] .band, [data-look="lime"] .finale, [data-look="lime"] .scoreboard, [data-look="lime"] .hero.felt, [data-look="lime"] .av-stage {
  background-image: radial-gradient(circle, rgba(255,255,255,.22) 0 2.6px, transparent 3.1px), radial-gradient(circle, rgba(255,255,255,.12) 0 2.6px, transparent 3.1px), linear-gradient(180deg, color-mix(in srgb, var(--band) 92%, #fff) 0%, var(--band) 40%, var(--band2) 100%); }
[data-look="daylight"] .band, [data-look="daylight"] .finale, [data-look="daylight"] .scoreboard, [data-look="daylight"] .hero.felt, [data-look="daylight"] .av-stage { background-image: none; background-color: #fff; box-shadow: inset 0 0 0 2px #000; }
.deal-pick { display: flex; flex-wrap: wrap; gap: 8px; } .deal-pick .deal-chip { min-height: 44px; font-size: .9rem; padding: 0 16px; }
.row.tap:disabled { opacity: .5; }
.champ-peg { position: relative; display: inline-grid; } .champ-peg .crown { position: absolute; top: -22px; left: 50%; transform: translateX(-50%) rotate(-6deg); }
/* Card backs: the look's colour with white dots and a fat white rim */
:root { --back: radial-gradient(circle, rgba(255,255,255,.34) 0 1.6px, transparent 2.1px) 0 0 / 8px 8px, linear-gradient(160deg, color-mix(in srgb, var(--band) 88%, #fff), var(--band2)); }
[data-look="daylight"] { --back: radial-gradient(circle, #000 0 1.6px, transparent 2.1px) 0 0 / 7px 7px, #fff; }
.pc.back { background: var(--back); box-shadow: inset 0 0 0 .3em #fff, 0 0 0 .5px rgba(20,24,60,.22), 0 3px 8px -3px rgba(10,20,60,.35); }
/* Surprise me and roll for dealer */
@keyframes spin { to { transform: rotate(360deg); } }
.group-h.split { display: flex; justify-content: space-between; align-items: center; }
.list.rolling .deal-chip { transition: none; }
/* ── Home: the wordmark, a hand dealt from the deck, and the one way to start ── */
.brand { position: relative; isolation: isolate; display: grid; justify-items: center; gap: 2px; text-align: center; padding: 0 0 16px; }
.brand::before { content: ""; position: absolute; z-index: -1; left: 50%; top: -30px; bottom: -10px; width: min(760px, 100vw); transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(closest-side, rgba(var(--halo1),.5) 0%, rgba(var(--halo2),.22) 46%, rgba(var(--halo2),0) 100%); }
.brand-mark { margin: 0; line-height: 0; }
.brand-mark img { width: min(250px, 64vw); height: auto; filter: drop-shadow(0 14px 18px rgba(0,0,0,.35)); animation: logoin .9s .1s var(--spring) both; }
.brand-fan { position: relative; width: min(300px, 78%); aspect-ratio: 1.62; margin-top: 2px; filter: drop-shadow(0 18px 22px rgba(0,0,0,.3)); -webkit-tap-highlight-color: transparent; }
.brand-fan .dcard { position: absolute; left: 33%; bottom: 7%; width: 34%; transform-origin: 50% 160%; rotate: var(--r); transition: rotate .55s var(--spring), translate .45s var(--spring);
  animation: fanin .85s calc(.35s + var(--i) * 90ms) var(--spring) both; }
.brand-fan.spread .dcard { rotate: calc(var(--r) * 1.22); } .brand-fan.spread .dcard:last-child { translate: 0 -10px; }
@media (hover: hover) and (pointer: fine) { .brand-fan:hover .dcard { rotate: calc(var(--r) * 1.22); } .brand-fan:hover .dcard:last-child { translate: 0 -10px; } }
.brand-sub { margin: 4px 0 0; max-width: 34ch; color: var(--ink2); font-size: 1rem; line-height: 1.4; text-wrap: pretty; }
.brand-cta { margin-top: 14px; min-width: min(280px, 100%); }
@keyframes logoin { from { opacity: 0; scale: .86; translate: 0 -16px; } }
@keyframes fanin { from { opacity: 0; translate: 0 40px; rotate: 0deg; } }

/* Playing now: an enamel card with the round dealt on a small card */
.now { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 3px 16px; width: 100%; margin: 0 0 14px; padding: 16px 16px 14px; border-radius: 22px; border: 2.5px solid transparent; text-align: left; color: #FFF7E2;
  background: radial-gradient(120% 120% at 0% 0%, var(--now-1) 0%, var(--now-2) 55%, var(--now-3) 100%) padding-box, var(--rim) border-box; box-shadow: var(--lift); }
.now:active { transform: translateY(2px) scale(.99); }
.mini { grid-row: span 3; align-self: center; position: relative; width: 62px; height: 86px; margin-left: 4px; border-radius: 9px; display: grid; place-items: center; rotate: -6deg;
  background: linear-gradient(180deg, #FFFDF6, #F3E5C4); border: 2px solid #D9B166; box-shadow: 0 6px 10px -4px rgba(0,0,0,.5); transition: rotate .45s var(--spring); }
.mini::before { content: ""; position: absolute; inset: 4px; border-radius: 6px; border: 1px solid rgba(196,148,62,.55); }
.mini b { position: absolute; top: 5px; left: 7px; font: 800 1.05rem/1 var(--display); color: var(--spade); }
.mini[data-suit="heart"] b, .mini[data-suit="diamond"] b { color: var(--heart); }
.mini img { width: 34px; height: 34px; object-fit: contain; }
.mini.back { background: none; border: 0; overflow: hidden; }
.mini.back::before { display: none; }
.mini.back img { width: 100%; height: 100%; object-fit: cover; }
@media (hover: hover) and (pointer: fine) { .now:hover .mini { rotate: 0deg; } }
.now .live { align-self: end; display: inline-flex; align-items: center; gap: 7px; font: 700 .76rem/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: #FFE7A3; }
.now:not(.again) .live::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #7CF5C8; animation: livepulse 2.2s ease-out infinite; }
.now .live svg { color: var(--gilt); }
.now .name { font: 800 1.45rem/1.08 var(--display); letter-spacing: -.01em; min-width: 0; overflow-wrap: anywhere; }
.now .meta { align-self: start; color: var(--panel-ink2); font-size: .94rem; line-height: 1.3; }
.now .foot { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 12px; border-top: 1px solid rgba(255,233,166,.2); min-width: 0; }
.now .foot .avs .peg { box-shadow: 0 0 0 2px var(--now-2); } .now .foot .avs .peg + .peg { margin-left: -10px; }
.now .leads { display: inline-flex; align-items: center; gap: 5px; min-width: 0; font: 700 .92rem/1.1 var(--display); color: #FFE7A3; }
.now .leads span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.now .foot .btn.sm { padding: 0 15px 3px; }
.now .leads img { width: 20px; height: 20px; object-fit: contain; flex: none; }
.now .foot .btn { flex: none; pointer-events: none; }
.now.again { background: linear-gradient(180deg, var(--again-1) 0%, var(--again-2) 100%) padding-box, var(--rim-soft) border-box; box-shadow: none; }
.now.again .foot .avs .peg { box-shadow: 0 0 0 2px var(--again-2); }
@keyframes livepulse { 0% { box-shadow: 0 0 0 0 rgba(124,245,200,.6); } 70%, 100% { box-shadow: 0 0 0 7px rgba(124,245,200,0); } }

/* First run: no tables yet */
.welcome { text-align: center; padding: 0 8px; display: grid; gap: 10px; justify-items: center; }
.welcome h2 { font: 800 1.5rem/1.15 var(--display); letter-spacing: -.01em; margin: 4px 0 0; }
.welcome p { color: var(--ink2); margin: 0 auto 6px; max-width: 40ch; text-wrap: pretty; }

/* New game: each table is an enamel block; the dashed one opens new players */
.blocks { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 12px; }
.blk { position: relative; display: grid; gap: 12px; align-content: space-between; min-height: 132px; padding: 14px; border-radius: 20px; border: 2.5px solid transparent; text-align: left; overflow: hidden; isolation: isolate; color: #FFF7E2; }
.blk:not(.add) { background: linear-gradient(160deg, var(--b1) 0%, var(--b2) 60%, var(--b3) 100%) padding-box, var(--rim) border-box; box-shadow: inset 0 -5px 0 rgba(0,0,0,.2), 0 0 20px -6px rgba(60,40,10,.45); }
.blk::before { content: ""; position: absolute; inset: 0; z-index: -1; background: rgba(255,255,255,.1);
  -webkit-mask: url(art/suit-tile.webp) 0 0 / 190px 72px repeat; mask: url(art/suit-tile.webp) 0 0 / 190px 72px repeat; }
.blk b { display: block; font: 800 1.2rem/1.1 var(--display); overflow-wrap: anywhere; }
.blk small { display: flex; align-items: center; gap: 6px; margin-top: 5px; color: rgba(255,247,226,.9); font-size: .86rem; line-height: 1.3; }
.blk .live-tag { align-items: flex-start; } .blk .live-tag::before { content: ""; width: 7px; height: 7px; margin-top: .42em; border-radius: 50%; background: #7CF5C8; flex: none; }
.blk .avs .peg { box-shadow: 0 0 0 2px rgba(255,244,214,.9); }
.blk.teal { --b1: var(--teal-hi); --b2: var(--teal); --b3: var(--teal-lo); }
.blk.sap { --b1: #3C83CC; --b2: #215C9E; --b3: #163F72; }
.blk.ruby { --b1: #C9475A; --b2: #9A2238; --b3: #6A1226; }
.blk.jade { --b1: #4E9E3A; --b2: #2F7424; --b3: #1E5216; }
.blk:active { transform: translateY(2px); }
@media (hover: hover) and (pointer: fine) { .blk:hover { transform: translateY(-3px); } }
.blk.add { align-content: center; justify-items: center; text-align: center; gap: 8px; color: var(--accent); background: rgba(255,255,255,.4); border: 2px dashed rgba(168,111,27,.55); }
.blk.add::before { display: none; }
.blk.add .plus { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; border: 2px solid var(--gilt); color: var(--gold-deep); transition: rotate .4s var(--spring); }
@media (hover: hover) and (pointer: fine) { .blk.add:hover .plus { rotate: 90deg; } }

/* Players: names edit in place, the picture opens the dressing room */
.pe-list .row.edit { min-height: 66px; gap: 10px; padding: 8px 10px 8px 12px; }
.pe-av { position: relative; flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; }
.pe-badge { position: absolute; right: -5px; bottom: -4px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #FFF8E6; color: #fff;
  background: linear-gradient(180deg, var(--teal-face), var(--teal-lo)); box-shadow: 0 2px 4px rgba(0,0,0,.25); transition: rotate .4s var(--spring); }
.pe-av:active .pe-badge { rotate: -14deg; }
@media (hover: hover) and (pointer: fine) { .pe-av:hover .pe-badge { rotate: -14deg; } }
.pe-av:focus-visible { outline: 3px solid var(--gold-deep); outline-offset: 3px; }
.pe-in { flex: 1; min-width: 0; height: 44px; padding: 0 10px; border-radius: 12px; border: 2px solid transparent; outline: none; font: 700 1.1rem/1 var(--display); color: var(--ink);
  background: linear-gradient(90deg, rgba(168,111,27,.5) 50%, transparent 0) 10px calc(100% - 7px) / 6px 2px repeat-x; background-clip: padding-box; }
.pe-in::placeholder { color: #7D6C4E; font-weight: 600; }
.pe-in:focus { background: linear-gradient(180deg, #FFFDF6, #FBF2DC) padding-box, var(--rim) border-box; }
.pe-plus { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; border: 2px dashed rgba(168,111,27,.6); color: var(--gold-deep); }
.ib-cream.danger { color: var(--red); }
/* Quiet pill: a small action beside content on paper */
.qp { flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 16px; border-radius: 99px; border: 1.5px solid rgba(168,111,27,.55); background: rgba(255,255,255,.5);
  font: 700 .86rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase; color: #6E4A10; white-space: nowrap; }
.qp:active:not(:disabled) { transform: translateY(1px); background: rgba(255,255,255,.75); }
.qp:disabled { opacity: .5; }
.qp.roll.on svg { animation: spin .5s linear infinite; }
.group-h.split .qp { margin: -8px -4px -8px 0; } .sheet-body > .group-h.split { margin-bottom: 2px; }
/* A labelled field on paper */
.kfield { display: grid; gap: 8px; }
.kfield > span { margin: 0 16px; font: 700 .76rem/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: #7A5A1E; }
.kfield input { width: 100%; min-height: 54px; padding: 0 16px; border-radius: 14px; border: 2px solid transparent; outline: none; font: 600 1.1rem/1 var(--display); color: var(--ink);
  background: linear-gradient(180deg, #FFFDF6, #FBF2DC) padding-box, var(--rim-soft) border-box; }
.kfield input::placeholder { color: #8A7A5C; }
.kfield input:focus { background: linear-gradient(180deg, #F6EBD0, #FFFDF6) padding-box, var(--rim) border-box; }

/* Deck cards, sized by their own width */
.dcard { --suit: var(--heart); --ph: 15.5cqw; container-type: inline-size; position: relative; width: 100%; aspect-ratio: 63 / 88; }
.dcard[data-suit="diamond"] { --ph: 17.5cqw; }
.dcard[data-suit="spade"] { --suit: var(--spade); --ph: 17cqw; }
.dcard[data-suit="club"] { --suit: var(--club); --ph: 16.5cqw; }
.dcard .face { position: absolute; inset: 0; overflow: hidden; border-radius: 5.5cqw; color: var(--suit);
  background: radial-gradient(130% 95% at 28% 12%, #FFFDF6 0%, #FCF3DE 52%, #F4E4C0 100%);
  box-shadow: inset 0 0 0 .45cqw #E7D3A4, 0 2.6cqw 5cqw -2.4cqw rgba(0,0,0,.55), 0 .5cqw 1cqw rgba(0,0,0,.14); }
.dcard .frame { position: absolute; inset: 0; width: 100%; height: 100%; }
.dcard .ix { position: absolute; top: 5.6cqw; left: 4.4cqw; width: 15cqw; display: grid; justify-items: center; gap: 1cqw; }
.dcard .ix.br { top: auto; left: auto; bottom: 5.6cqw; right: 4.4cqw; rotate: 180deg; }
.dcard .ix b { font: 800 15cqw/.84 var(--display); font-optical-sizing: auto; font-variation-settings: "SOFT" 0; letter-spacing: -.02em; }
.dcard .ix.ten b { font-size: 12.6cqw; letter-spacing: -.07em; translate: -.5cqw 0; }
.dcard .ix svg { width: 8.6cqw; height: 8.6cqw; }
.dcard .pip { position: absolute; left: calc(var(--x) * 1%); top: calc(var(--y) * 1%); height: var(--ph); width: auto; translate: -50% -50%; filter: drop-shadow(0 .5cqw .45cqw rgba(70,40,0,.22)); }
.dcard .pip.flip { rotate: 180deg; }
.dcard .mid { position: absolute; left: 50%; top: 50%; width: 70cqw; aspect-ratio: 1; translate: -50% -50%; display: grid; place-items: center; }
.dcard .mid::before { content: ""; position: absolute; inset: 12%; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--suit) 14%, transparent) 0%, transparent 70%); }
.dcard .mid .ring { position: absolute; inset: 0; width: 100%; height: 100%; }
.dcard .mid img { position: relative; width: 44cqw; height: 44cqw; object-fit: contain; filter: drop-shadow(0 1.4cqw 1.4cqw rgba(70,40,0,.28)); }
.dcard .portrait { position: absolute; left: 21cqw; top: 9.5cqw; width: 58cqw; height: 120.6cqw; border-radius: 2cqw; overflow: hidden;
  background: radial-gradient(110% 60% at 50% 50%, color-mix(in srgb, var(--suit) 6%, #FFF9EA) 0%, color-mix(in srgb, var(--suit) 16%, #F4E3BE) 100%); }
.dcard .portrait::before { content: ""; position: absolute; inset: 0; opacity: .55;
  background: repeating-linear-gradient(45deg, transparent 0 2.6cqw, color-mix(in srgb, var(--suit) 14%, transparent) 2.6cqw 2.8cqw), repeating-linear-gradient(-45deg, transparent 0 2.6cqw, color-mix(in srgb, var(--suit) 14%, transparent) 2.6cqw 2.8cqw); }
.dcard .portrait::after { content: ""; position: absolute; inset: 0; z-index: 3; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 .4cqw #C59A4A, inset 0 0 0 1cqw rgba(255,250,236,.9), inset 0 0 0 1.2cqw rgba(197,154,74,.75); }
.dcard .half { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; z-index: 1; }
.dcard .half.top { top: 0; }
.dcard .half.bot { bottom: 0; rotate: 180deg; }
.dcard .half .fig { position: absolute; left: 4%; right: 4%; bottom: 0; width: 92%; height: 93%; object-fit: contain; object-position: 50% 100%; }
.dcard .half .s { position: absolute; left: 3.6cqw; top: 3.6cqw; width: 8.5cqw; height: 8.5cqw; object-fit: contain; filter: drop-shadow(0 .4cqw .4cqw rgba(70,40,0,.22)); }
.dcard .portrait .cut { position: absolute; z-index: 2; left: 0; right: 0; top: 50%; height: .6cqw; translate: 0 -50%; background: linear-gradient(90deg, transparent, #B98A3A 10%, #EBCB80 50%, #B98A3A 90%, transparent); }
.dcard.joker { --suit: var(--club); }
.dcard.joker .face { background: radial-gradient(15cqw 2.2cqw at 51% 91%, rgba(92,58,14,.24), rgba(92,58,14,0)), radial-gradient(130% 95% at 28% 12%, #FFFDF6 0%, #FCF3DE 52%, #F4E4C0 100%); }
.dcard.joker .jk { position: absolute; left: 50%; top: 50%; height: 114cqw; width: auto; translate: -50% -50%; filter: drop-shadow(0 .8cqw 1cqw rgba(70,40,0,.2)); }
.dcard.joker .ix svg { width: 11cqw; height: 11cqw; color: #C9A052; filter: drop-shadow(0 .3cqw 0 rgba(110,74,16,.35)); }
.dcard.joker .ix b { font: 800 3.9cqw/1 var(--label); letter-spacing: .12em; padding-left: .12em; color: var(--suit); }
.dcard.back .face { background: none; box-shadow: 0 2.6cqw 5cqw -2.4cqw rgba(0,0,0,.55), 0 .5cqw 1cqw rgba(0,0,0,.14); }
.dcard.back img { display: block; width: 100%; height: 100%; }
/* Tablet and desktop: two columns on Home and the table page */
@media (min-width: 900px) {
  .home .content, .tablepage .content { max-width: 1040px; display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; }
  .home .content > .brand, .home .content > .welcome, .tablepage .content > .hero, .home .content > .brand + .group { grid-column: 1 / -1; }
  .home .content > .now { grid-column: 1; margin: 0 0 14px; } .home .content > .now + .group { grid-column: 2; margin-top: 0; }
  .brand { grid-template-columns: 1fr 1fr; align-items: center; column-gap: 24px; padding: 4px 0 30px; }
  .brand-mark { grid-column: 1; grid-row: 1; align-self: end; } .brand-sub { grid-column: 1; grid-row: 2; } .brand-cta { grid-column: 1; grid-row: 3; align-self: start; }
  .brand::before { left: 75%; }
  .brand-mark img { width: 330px; } .brand-fan { grid-column: 2; grid-row: 1 / span 3; width: min(400px, 100%); margin: 0; }
  .home .content > .large-title, .tablepage .content > .large-title { grid-column: 1 / -1; }
  .home .nav-row, .tablepage .nav-row { max-width: 1040px; }
  .hero.felt { padding: 26px 28px 22px; } .hero.felt .large-title { font-size: 3rem; } .hero .fan { height: 130px; width: 150px; } .hero .fan > span { font-size: 17px; }
}

#root { position: relative; z-index: 1; }
.band, .hero.felt, .finale, .scoreboard { position: relative; isolation: isolate; overflow: hidden; }
/* Crowns for 1st, 2nd and 3rd: gold, silver and bronze */
.crown-b { display: inline-block; flex: none; line-height: 0; } .crown-b svg { width: 100%; height: 100%; display: block; overflow: visible; }
/* Avatars: a face from our own deck in a cream medallion ringed in the player's colour, a photo, or initials on their colour */
.peg.photo { background: var(--peg) center / cover no-repeat; }
.peg.card { position: relative; overflow: hidden; background: radial-gradient(circle at 50% 30%, #FFFDF6, #F3E3BF); border: max(2px, .09em) solid var(--peg); }
.peg.card img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.peg.card.ace img { width: 62%; height: 62%; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(70,40,0,.25)); }
.av-sheet .sheet-body { gap: 14px; flex: 1; }
.sheet.av-sheet { height: min(860px, calc(var(--vv-h, 100dvh) - 20px)); }
.av-head { position: sticky; top: -8px; z-index: 2; display: grid; gap: 12px; margin: -8px -16px 0; padding: 8px 16px 10px; background: var(--bg); }
.av-stage { position: relative; display: grid; place-items: center; min-height: 208px; border-radius: 22px; }
.av-stage .peg.ring { box-shadow: 0 0 0 4px #fff, 0 6px 16px -2px rgba(10,20,60,.35); }
.av-note { margin: 0 4px; font-size: .84rem; color: var(--ink2); text-align: center; }
/* The dressing room: the picked card on a stage in the player's own colour */
.av-stage.dress { min-height: 252px; place-items: center; overflow: hidden; background-color: var(--peg);
  background-image: radial-gradient(circle, rgba(255,255,255,.22) 0 2.6px, transparent 3.1px), radial-gradient(circle, rgba(255,255,255,.12) 0 2.6px, transparent 3.1px), linear-gradient(180deg, color-mix(in srgb, var(--peg) 78%, #fff) 0%, var(--peg) 55%, color-mix(in srgb, var(--peg) 84%, #000) 100%);
  background-size: 22px 22px, 22px 22px, auto; background-position: 0 0, 11px 11px, 0 0; box-shadow: inset 0 2px 0 rgba(255,255,255,.25), inset 0 -6px 0 color-mix(in srgb, var(--peg) 70%, #000); }
.av-figure { position: relative; display: block; width: 112px; margin: 6px 0; rotate: -5deg; filter: drop-shadow(0 12px 14px rgba(10,20,60,.32)); animation: avHop .55s var(--spring) both; }
.av-figure .dcard { width: 100%; }
@keyframes avHop { 0% { transform: translateY(16px) scale(.9); opacity: 0; } 60% { transform: translateY(-8px) scale(1.03); opacity: 1; } 100% { transform: none; } }
.av-peek { position: absolute; top: 12px; left: 12px; }
.av-peek .peg { box-shadow: 0 0 0 3px #fff, 0 4px 10px -2px rgba(10,20,60,.3); }
.av-rail { position: absolute; top: 12px; right: 12px; display: grid; gap: 8px; }
.av-rail button { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; align-content: center; gap: 2px; background: var(--surface); color: var(--accent); font-size: .68rem; font-weight: 700;
  box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--line) 80%, transparent); transition: transform .2s var(--spring); }
.av-rail button:active { transform: translateY(2px); }
.av-rail button:disabled { opacity: 1; color: var(--ink3); }
.av-grid.cards { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.av-card { display: grid; justify-items: center; align-content: start; gap: 5px; padding: 0; background: none; color: var(--ink2); transition: transform .25s var(--spring); }
.av-card img { width: 100%; aspect-ratio: 1; border-radius: 18px; object-fit: cover; display: block; pointer-events: none;
  background: color-mix(in srgb, var(--peg) 16%, var(--surface)); box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--peg) 26%, var(--line)); transition: box-shadow .15s; }
.av-card.ace img { object-fit: contain; padding: 20%; }
.av-card.on img { outline: 3px solid var(--accent); outline-offset: 2px; }
.av-card.on { color: var(--ink); transform: translateY(-2px); }
.av-nm { font-size: .78rem; font-weight: 600; line-height: 1.15; text-align: center; text-wrap: balance; }
.av-card:active { transform: scale(.96); }
button.seat-av { padding: 0; border-radius: 50%; }
.av-note.err { color: var(--red); }
.av-pop { display: grid; animation: pop .35s var(--spring) both; }
.av-cats { display: flex; gap: 6px; overflow-x: auto; margin: 0 -16px; padding: 2px 16px; scrollbar-width: none; scroll-padding-inline: 16px; scroll-snap-type: x proximity; } .av-cats::-webkit-scrollbar { display: none; }
.av-cat { flex: none; scroll-snap-align: start; min-height: 40px; padding: 0 14px; border-radius: 99px; font-weight: 600; font-size: .9rem; color: var(--ink2); background: var(--fill); }
.av-cat.on { background: var(--ink); color: var(--bg); }
.av-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; animation: fade .2s ease both; }
.av-tile .peg { width: 80% !important; height: 80% !important; }
.av-grid.dense { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.av-tile { aspect-ratio: 1; border-radius: 18px; display: grid; place-items: center; background: var(--surface); box-shadow: inset 0 0 0 var(--hair) var(--line); transition: transform .25s var(--spring), box-shadow .15s; }
.av-tile.on { box-shadow: inset 0 0 0 2.5px var(--accent); }
.av-tile:disabled { opacity: .3; }
.av-dot { width: 40px; height: 40px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
.av-crop { position: relative; border-radius: 50%; overflow: hidden; background: var(--peg); touch-action: none; cursor: grab; box-shadow: 0 0 0 3px var(--surface), 0 0 0 6px var(--gold-ring); }
.av-crop img { position: absolute; left: 50%; top: 50%; max-width: none; user-select: none; pointer-events: none; }
.av-zoom { display: flex; align-items: center; gap: 12px; color: var(--ink2); font-size: .9rem; } .av-zoom input { flex: 1; accent-color: var(--accent); min-height: 44px; }
.av-photo-btns { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
/* Rules on tablets: the rounds sit in a list beside the guide */
.rname { display: none; }
@media (min-width: 900px) {
  .sheet.rules { max-width: 880px; }
  .rounds-pane { display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start; }
  .rounds-pane .rpick { flex-direction: column; justify-content: flex-start; position: sticky; top: 0; }
  .rounds-pane .rpick .rnum { width: auto; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-radius: 12px; text-align: left; font-size: .95rem; }
  .rounds-pane .rname { display: inline; font-weight: 500; }
}
@keyframes fade { from { opacity: 0; } }
@keyframes up { from { transform: translateY(100%); } }
@keyframes down { to { transform: translateY(100%); } }
@keyframes rise { from { transform: translateY(10px); opacity: 0; } }
@keyframes pop { from { transform: scale(.6); opacity: 0; } }
@keyframes blink { 50% { opacity: .35; } }
@keyframes toastIn { from { transform: translate(-50%, -20px); opacity: 0; } }
@keyframes fanIn { from { transform: rotate(0) translateY(30px); opacity: 0; } }
@keyframes deal2 { from { transform: translateY(60px) rotate(-6deg) scale(.9); opacity: 0; } }
@keyframes dealOut { to { transform: translateY(-24px) rotate(3deg); opacity: 0; } }
/* ── At the table (kit: docs/ui-kit.html#table): a navbar on the water, seven round cards, the contract on paper, seats in a panel ── */
.tnav { display: flex; align-items: center; gap: 10px; max-width: 1080px; margin: 0 auto; padding: calc(6px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left)); }
.table-body { display: grid; gap: 18px; max-width: 520px; margin: 0 auto; padding: 2px max(16px, env(safe-area-inset-right)) calc(132px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.t-lead, .t-play { display: grid; gap: 16px; align-content: start; min-width: 0; }
.game.wide .table-body { max-width: 1080px; grid-template-columns: minmax(0, 430px) minmax(0, 1fr); gap: 40px; align-items: start; padding-top: 8px; }
.game.wide .t-lead { position: sticky; top: 12px; }
.rstrip { display: flex; justify-content: space-between; gap: 6px; padding: 14px 2px 24px; }
.rs { position: relative; flex: 0 1 44px; display: grid; place-items: center; height: 58px; padding: 0; border-radius: 8px; border: 1.5px solid #D9B166; color: var(--spade); font: 800 1.2rem/1 var(--display);
  background: linear-gradient(180deg, #FFFDF6, #F3E5C4); box-shadow: 0 4px 6px -3px rgba(0,0,0,.45); transition: transform .38s var(--spring), translate .3s var(--out-e); }
.rs::before { content: ""; position: absolute; left: 0; right: 0; top: 0; bottom: -12px; }
.rs:disabled { cursor: default; }
.rs .ok { position: absolute; left: 50%; bottom: -8px; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%; display: grid; place-items: center; background: var(--teal); border: 1.5px solid var(--gilt); color: #FFF7E2; }
.rs .ok.peg { background: var(--peg); }
.rs.cur { z-index: 1; transform: translateY(-8px) scale(1.12); border: 2px solid var(--gilt); box-shadow: 0 10px 16px -6px rgba(0,0,0,.55); }
.rs.cur::after { content: "Now"; position: absolute; left: 0; right: 0; bottom: -22px; text-align: center; font: 800 .62rem/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: var(--hl); }
.rs.next { color: var(--glass-ink); background: var(--glass); border: 1.5px dashed var(--gline2); box-shadow: none; }
.rs:not(.cur):not(.next):not(:disabled):active { transform: scale(.92); }
@media (hover: hover) and (pointer: fine) { .rs:not(:disabled):hover { translate: 0 -3px; } }
.contract { position: relative; display: grid; justify-items: center; gap: 8px; width: 100%; padding: 14px 14px 16px; border-radius: 18px; border: 2.5px solid transparent; text-align: center; color: var(--paper-ink);
  background: radial-gradient(120% 90% at 50% 0%, var(--paper-hi), var(--paper) 62%, var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: var(--lift); transition: transform .2s var(--spring); }
.contract:active { transform: scale(.985); }
.c-guide { position: absolute; top: 10px; right: 10px; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; border: 2px solid transparent;
  background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 #D9BE86, inset 0 1.5px 0 #fff; transition: rotate .45s var(--spring); }
.c-guide img { width: 26px; height: 26px; object-fit: contain; }
@media (hover: hover) and (pointer: fine) { .contract:hover .c-guide { rotate: -12deg; } }
.c-cap { padding: 4px 42px 0; font: 800 .74rem/1.25 var(--label); letter-spacing: .16em; text-transform: uppercase; color: #74500F; text-wrap: balance; }
.c-name { display: block; padding: 0 42px; font: 800 1.6rem/1.05 var(--display); letter-spacing: -.015em; text-wrap: balance; animation: rise .45s var(--out-e) both; }
.contract .melds, .cf-face .melds { justify-content: center; gap: 12px; }
/* The kit's small cards, used by the contract and the round card; Rules and Learn keep their own. */
.contract .pc, .cf-face .pc { display: inline-grid; place-items: center; width: 3em; height: 4.2em; font-size: 10px; border-radius: .5em; color: var(--spade);
  background: linear-gradient(180deg, #FFFFFF, #F7ECD2); box-shadow: 0 0 0 1px var(--paper-line), 0 2px 3px rgba(0,0,0,.22); }
.contract .pc + .pc, .cf-face .pc + .pc { margin-left: -.8em; }
.contract .meld .pc, .cf-face .meld .pc { transform: none; }
.contract .pc.red, .cf-face .pc.red { color: var(--heart); }
.contract .pc.s-c, .cf-face .pc.s-c { color: var(--club); }
.contract .pc-corner, .cf-face .pc-corner { position: static; display: grid; justify-items: center; gap: .15em; }
.contract .pc-corner b, .cf-face .pc-corner b { font: 800 1.36em/1 var(--display); letter-spacing: -.02em; }
.contract .pc-corner i, .cf-face .pc-corner i { font-size: 1.28em; line-height: 1; }
.contract .pc-pip, .cf-face .pc-pip { display: none; }
.seats-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 4px -6px; font: 700 .8rem/1.2 var(--label); letter-spacing: .12em; text-transform: uppercase; color: var(--ink2); }
.seats-edit { flex: none; min-height: 44px; margin: -10px -8px; padding: 0 10px; color: var(--hl); font: 700 .8rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase;
  text-decoration: underline; text-decoration-color: var(--gline2); text-underline-offset: 4px; }
.seats { list-style: none; margin: 0; padding: 4px 0; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); overflow: hidden; }
.seat { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 8px; padding: 10px 12px; animation: rise .45s calc(var(--i) * 60ms) var(--out-e) both; }
.seat + .seat { border-top: 1px solid var(--gline); }
.seat.lead { background: linear-gradient(90deg, rgba(255,228,160,.12), rgba(255,228,160,0) 70%); }
.seat-av { position: relative; display: block; border-radius: 50%; transition: transform .2s var(--spring); }
.seat-av:active { transform: scale(.94); }
.seat-av .peg.ring, .pcard .peg.ring, .lane-peg .peg.ring { box-shadow: none; outline: 2.5px solid var(--gilt); outline-offset: 1.5px; }
.seat-medal { position: absolute; right: -8px; bottom: -6px; width: 27px; height: 27px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.4)); animation: pop .35s var(--spring) both; }
.seat-av .dealer { position: absolute; left: -5px; bottom: -4px; width: 21px; height: 21px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--gilt);
  background: var(--paper); color: var(--paper-ink); font: 800 .72rem/1 var(--label); }
.seat-main { display: grid; min-width: 0; text-align: left; }
.seat-main b { font: 700 1.08rem/1.15 var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.seat-main small { margin-top: 2px; color: var(--ink2); font-size: .84rem; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mv { font-style: normal; font-weight: 700; } .mv.up { color: var(--out); } .mv.down { color: var(--red); }
.lane-name .mv { font-size: .72em; margin-left: 5px; }
.chip { display: inline-grid; grid-auto-flow: column; align-items: center; justify-content: center; gap: 3px; min-width: 46px; height: 30px; padding: 0 9px; border-radius: 99px;
  font: 700 .98rem/1 var(--num); color: var(--paper-ink); background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)); border: 1.5px solid var(--paper-line); animation: pop .35s var(--spring) both; }
.chip.out { color: #4A3206; background: linear-gradient(180deg, #FFE9A8, #E9B44C); border-color: #A86F1B; }
.chip.out img { width: 18px; height: 18px; object-fit: contain; margin-left: -4px; }
.seat-total { position: relative; min-width: 2ch; text-align: right; font: 800 1.75rem/1 var(--num); font-variant-numeric: tabular-nums; }
.seat-total .plus { position: absolute; right: 0; bottom: 100%; font: 800 1rem/1 var(--num); color: var(--hl); pointer-events: none; animation: k3float 1.2s ease-out both; }
@keyframes k3float { from { transform: translateY(14px); opacity: 0; } 30% { opacity: 1; } to { transform: translateY(-12px); opacity: 0; } }
.buy { position: relative; display: inline-grid; }
.mayi { position: relative; display: grid; justify-items: center; align-content: center; gap: 4px; min-width: 64px; min-height: 48px; padding: 7px 8px 6px; white-space: nowrap; border-radius: 14px; border: 2px solid transparent; color: #FFF7E2;
  background: linear-gradient(180deg, var(--sap-hi), var(--sap) 60%, var(--sap-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -3px 0 var(--sap-deep); font: 800 .86rem/1 var(--display); transition: transform .12s ease, filter .2s ease; }
.mayi:active:not(:disabled) { transform: translateY(1px); filter: brightness(.88); }
.mayi:disabled { cursor: default; filter: saturate(.4); opacity: .75; }
.mayi.bump { animation: k3bump .5s var(--spring); }
@keyframes k3bump { 40% { transform: scale(1.12); } }
.mpips { display: flex; align-items: center; gap: 4px; min-height: 10px; }
.mpips i { width: 8px; height: 8px; transform: rotate(45deg); border-radius: 1.5px; border: 1.5px solid #F4D27A; background: rgba(8,30,60,.6); transition: background .2s ease; }
.mpips i.on { background: linear-gradient(135deg, #FFFFFF, #BFD7FF); }
.mpips i.lit { animation: k3pip .5s var(--spring); }
@keyframes k3pip { from { scale: .2; } 55% { scale: 1.6; } }
.mpips.n { font: 700 .78rem/1 var(--num); color: #BFD7FF; }
@media (hover: hover) and (pointer: fine) { .mayi:not(:disabled):hover .mpips i:first-child:not(.on), .mayi:not(:disabled):hover .mpips i.on + i:not(.on) { background: rgba(191,215,255,.5); } }
.buy-undo { position: absolute; z-index: 2; left: -15px; top: -13px; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; }
.buy-undo i { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: var(--paper-ink); border: 1.5px solid var(--gilt);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)); box-shadow: 0 2px 4px rgba(0,0,0,.35); animation: pop .3s var(--spring) both; transition: transform .12s ease; }
.buy-undo:active i { transform: scale(.88); }
.flycard { position: absolute; z-index: 3; width: 26px; height: 36px; border-radius: 4px; border: 1.5px solid #D9B166; background: url(art/card-back.webp) center / 100% 100%; pointer-events: none;
  animation: k3fly .7s cubic-bezier(.5,0,.3,1) both; }
@keyframes k3fly { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(-200deg) scale(.5); opacity: 0; } }
/* Player cards: the finished round, to check before moving on */
.pcards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.pcard { position: relative; overflow: clip; display: grid; justify-items: center; gap: 4px; padding: 16px 10px 12px; border-radius: 20px; border: 2.5px solid transparent; text-align: center; color: var(--paper-ink);
  background: radial-gradient(120% 90% at 50% 0%, var(--paper-hi), var(--paper) 62%, var(--paper-lo)) padding-box, var(--rim-soft) border-box; box-shadow: 0 12px 22px -14px rgba(0,0,0,.6);
  animation: k3deal .5s calc(var(--i) * 70ms) var(--spring) both; }
.pcard > b { max-width: 100%; font: 700 1.05rem/1.1 var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcard .this { font: 800 2.3rem/1 var(--num); font-variant-numeric: tabular-nums; }
.pcard .sum { font: 700 .82rem/1 var(--label); letter-spacing: .1em; text-transform: uppercase; color: #7A5A1E; }
.pcard .ib-cream.edit { position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; }
.pcard.out { background: radial-gradient(120% 90% at 50% 0%, #FFF8DD, #FBE8B4 62%, #F3D58C) padding-box, var(--rim) border-box; }
.pcard.out .this { font-family: var(--display); font-weight: 900; font-size: 2rem; line-height: 1.15; color: #8B5A12; }
.pc-badge { position: absolute; top: 8px; left: 8px; width: 36px; height: 36px; object-fit: contain; rotate: -8deg; animation: k3stamp .5s calc(var(--i) * 70ms + .5s) var(--spring) both; }
.pc-av { position: relative; display: grid; place-items: center; margin: 2px 0 4px; }
.pcard.out .pc-av .peg { animation: k3hop .6s calc(var(--i) * 70ms + .3s) var(--spring) both; }
@keyframes k3deal { from { transform: translateY(18px) rotate(-3deg) scale(.94); opacity: 0; } }
@keyframes k3hop { 40% { transform: translateY(-16px) scale(1.08); } }
@keyframes k3stamp { from { transform: scale(2.2); opacity: 0; } }
/* Crystal sparks: someone went out */
.sparks { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.sparks i { --a: calc(var(--k) * 45deg); --d: -56px; position: absolute; width: 11px; height: 11px; border-radius: 2px; border: 1.5px solid var(--gilt);
  background: linear-gradient(135deg, var(--gem-1), var(--gem-2) 45%, var(--gem-3)); opacity: 0; animation: k3spark .75s var(--sd, .15s) cubic-bezier(.2,.7,.3,1); }
.pcard .sparks i { --sd: calc(var(--i, 0) * 70ms + .35s); }
.sparks.sm i { --d: -30px; --sd: 0s; width: 8px; height: 8px; }
@keyframes k3spark { from { transform: rotate(var(--a)) translateY(0) rotate(45deg) scale(.4); opacity: 1; } to { transform: rotate(var(--a)) translateY(var(--d)) rotate(45deg) scale(.2); opacity: 0; } }
/* Award race: illustrated awards up for grabs */
.arace { display: grid; gap: 10px; }
.race-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 4px; font: 700 .8rem/1.2 var(--label); letter-spacing: .12em; text-transform: uppercase; color: var(--ink2); }
.race-h small { font: 600 .8rem/1.2 var(--font); letter-spacing: 0; text-transform: none; color: var(--ink3); }
.race-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 10px; }
.race-chip { min-width: 0; display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); }
.race-art { flex: none; width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 3px 4px rgba(0,0,0,.35)); }
.race-t { flex: 1; min-width: 0; display: grid; gap: 2px; }
.race-t b { font: 700 .92rem/1.15 var(--display); color: var(--hl); } .race-t small { color: var(--ink2); font-size: .8rem; }
.tip { display: flex; align-items: flex-start; gap: 10px; margin: 0 4px; color: var(--ink2); font-size: .92rem; line-height: 1.4; }
.tip svg { flex: none; margin-top: 2px; color: var(--gilt); }
/* Race lanes (recap and the TV scoreboard) */
.race { display: grid; gap: 6px; padding: 12px 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
.lane { display: grid; grid-template-columns: minmax(56px, 22%) 1fr 44px; align-items: center; gap: 12px; min-height: 46px; }
.lane-name { font: 700 .95rem/1 var(--display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lane-track { position: relative; height: 12px; border-radius: 99px; background: var(--track); border: 1px solid var(--gline); }
.lane-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, rgba(233,180,76,.25), var(--gilt)); transition: width .7s var(--out-e); }
.lane-peg { position: absolute; top: 50%; transform: translateY(-50%); transition: left .7s var(--spring); }
.lane-total { font: 800 1.1rem/1 var(--num); text-align: right; font-variant-numeric: tabular-nums; }
.race.big { flex: 1; align-content: center; gap: 14px; padding: 0; background: transparent; border: 0; }
.race.big .lane { grid-template-columns: minmax(120px, 18%) 1fr 90px; min-height: 64px; gap: 20px; }
.race.big .lane-name { font-size: clamp(1.2rem, 2.2vw, 2rem); color: var(--band-ink); } .race.big .lane-total { font-size: clamp(1.6rem, 3.4vw, 3rem); color: var(--band-ink); }
.race.big .lane-track { height: 16px; }
/* Round grid on wide screens */
.grid-wrap { overflow-x: auto; padding: 4px 8px; border-radius: 18px; border: 2px solid transparent; color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper)) padding-box, var(--rim-soft) border-box; }
.sgrid { width: 100%; border-collapse: collapse; font: 700 .92rem/1 var(--num); font-variant-numeric: tabular-nums; }
.sgrid th { padding: 12px 3px 8px; font: 700 .72rem/1 var(--label); letter-spacing: .12em; text-transform: uppercase; color: #7A5A1E; } .sgrid th.cur { color: var(--teal); }
.sgrid td { padding: 10px 3px; text-align: center; border-top: 1px solid rgba(196,148,62,.3); color: var(--paper-ink2); }
.sgrid .l { text-align: left; padding-left: 10px; white-space: nowrap; } .sgrid td.l { font: 700 .95rem/1 var(--display); color: var(--paper-ink); }
.sgrid td.zero { color: #8B5A12; font: 800 .8rem/1 var(--display); } .sgrid td.t { padding-right: 10px; font-weight: 800; font-size: 1.05rem; color: var(--paper-ink); }
/* Banner toast: art, a headline and a second line (kit .kt); a new leader's crown drops in */
.toast.kt { display: flex; align-items: center; gap: 12px; padding: 8px 18px 8px 8px; text-align: left; }
.toast.kt img { flex: none; width: 46px; height: 46px; object-fit: contain; animation: k3crown .8s .1s var(--spring) both; }
.toast.kt b { display: block; font: 800 1.1rem/1.15 var(--display); color: #FFE7A3; }
.toast.kt small { display: block; margin-top: 2px; font: 500 .9rem/1.3 var(--font); color: var(--panel-ink2); }
@keyframes k3crown { from { transform: translateY(-34px) rotate(-20deg); opacity: 0; } }

/* ── Score pad (kit #scoring and #scan): who's up, the plaque, then type, tap cards or photograph ── */
.sheet.pad .sheet-body { gap: 14px; }
.who-strip { display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px; padding: 8px 18px 6px; scrollbar-width: none; }
.who-strip::-webkit-scrollbar { display: none; }
.who { flex: none; display: grid; justify-items: center; gap: 4px; min-width: 70px; padding: 8px 6px 7px; border-radius: 16px; border: 2px solid transparent; color: var(--ink); transition: transform .12s ease; }
.who:active { transform: scale(.95); }
.who-av { position: relative; display: grid; place-items: center; }
.who-av .peg { transition: translate .32s var(--out-e), opacity .2s ease; }
.who-n { max-width: 9ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 .86rem/1.1 var(--display); }
.who em { display: block; font: 700 .9rem/1 var(--num); font-style: normal; color: var(--ink2); }
.who.done em { color: var(--club); }
.who[aria-selected="true"] { background: linear-gradient(180deg, #FFFFFF, #FFF6DF) padding-box, var(--rim) border-box; box-shadow: 0 6px 12px -8px rgba(110,74,16,.7); }
.who:not([aria-selected="true"]):not(.done) .peg { opacity: .6; }
.who em.landed { animation: k3landed .45s var(--spring); }
@keyframes k3landed { from { scale: 1.7; color: var(--club); } }
@media (hover: hover) and (pointer: fine) { .who:not([aria-selected="true"]):hover .peg { translate: 0 -3px; } }
.plaque { position: relative; display: grid; justify-items: center; gap: 2px; padding: 14px 12px 12px; border-radius: 18px; border: 2px solid rgba(196,148,62,.55); background: rgba(255,255,255,.55); text-align: center; }
.plaque b { display: block; font: 800 4rem/1 var(--num); font-variant-numeric: tabular-nums; color: var(--ink); }
.plaque b.nudge { animation: k3nudge .2s var(--out-e); }
@keyframes k3nudge { from { scale: 1.1; } }
.plaque.empty b { color: rgba(15,50,71,.28); }
.plaque small { font: 600 .92rem/1.25 var(--font); color: var(--ink2); text-wrap: balance; }
.plaque.out { border-color: var(--gilt); background: radial-gradient(circle at 50% 30%, #FFF8DD, rgba(255,236,170,.6)); }
.plaque.out b { font-family: var(--display); font-weight: 900; color: #A86F1B; }
.plaque .stamp { position: absolute; top: 10px; right: 12px; width: 46px; height: 46px; object-fit: contain; rotate: 10deg; animation: k3stamp .5s var(--spring) both; }
.pad-clear { min-height: 36px; margin-top: 2px; padding: 0 10px; color: var(--accent); font: 700 .9rem/1 var(--display);
  text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); text-underline-offset: 4px; }
.numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.nk { min-height: 58px; display: grid; place-items: center; border-radius: 16px; border: 2px solid transparent; font: 700 1.7rem/1 var(--num); color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF, #FBF2DC 60%, #F1E1BC) padding-box, var(--rim-soft) border-box; box-shadow: inset 0 -4px 0 #DCC291, inset 0 2px 0 #fff; transition: transform .08s ease, box-shadow .08s ease; }
.nk:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #DCC291, inset 0 3px 6px rgba(110,74,16,.18); }
.nk.fn { color: #FFF7E2; background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -4px 0 var(--teal-deep); }
.nk.fn:active { box-shadow: inset 0 -1px 0 var(--teal-deep), inset 0 3px 6px rgba(0,0,0,.25); }
.tapped { --ov: 10px; display: flex; align-items: center; justify-content: center; min-height: 78px; padding: 8px; border-radius: 16px; border: 1.5px dashed rgba(168,111,27,.45); overflow: hidden; }
.tapped.busy { opacity: .45; }
.tapped .none { max-width: 30ch; text-align: center; font: 600 .92rem/1.3 var(--font); color: var(--ink2); text-wrap: balance; }
.hc { position: relative; flex: none; display: grid; justify-items: center; align-content: center; gap: 3px; width: 42px; height: 58px; border-radius: 7px; border: 1.5px solid var(--paper-line); color: var(--spade);
  background: linear-gradient(180deg, #FFFFFF, #F7ECD2); box-shadow: 0 4px 6px -2px rgba(0,0,0,.3); transform: rotate(var(--r, 0deg)); transition: transform .38s var(--spring), translate .3s var(--out-e); }
.hc + .hc { margin-left: calc(var(--ov) * -1); }
.hc b { font: 800 1.05rem/1 var(--display); white-space: nowrap; } .hc b i { font-style: normal; font-size: .78em; margin-left: 1px; }
.hc small { font: 700 .74rem/1 var(--label); color: #74500F; }
.hc.h { color: var(--heart); } .hc.c { color: var(--club); }
.hc.doubt { outline: 2.5px dashed var(--gilt); outline-offset: 2px; }
.hc.fresh { animation: k3in .32s var(--spring) both; }
.hc:active { transform: rotate(var(--r, 0deg)) translateY(2px) scale(.96); }
@keyframes k3in { from { translate: 0 -18px; scale: .7; opacity: 0; } }
@media (hover: hover) and (pointer: fine) { .hc:hover { z-index: 1; translate: 0 -9px; } }
.ckeys { display: grid; grid-template-columns: repeat(60, minmax(0, 1fr)); row-gap: 8px; margin: 0 -4px; }
.ck { margin: 0 4px; display: grid; justify-items: center; align-content: center; gap: 3px; min-height: 58px; padding: 6px 0 7px; border-radius: 12px; border: 1.5px solid var(--paper-line); color: var(--spade);
  background: linear-gradient(180deg, #FFFFFF, #F7ECD2); box-shadow: inset 0 -3px 0 #E4D0A2, 0 2px 3px rgba(110,74,16,.2); transition: transform .08s ease, box-shadow .08s ease; }
.ck b { font: 800 1.42rem/1 var(--display); } .ck small { font: 700 .8rem/1 var(--label); letter-spacing: .04em; color: #74500F; }
.ck.jk { color: var(--heart); }
.ck:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #E4D0A2; }
.sc-pane { display: grid; justify-items: center; gap: 10px; text-align: center; }
.sc-view { --in: 10px; position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 16 / 10; border-radius: 18px; overflow: hidden; isolation: isolate;
  background: radial-gradient(80% 75% at 50% 45%, rgba(255,255,255,.75), rgba(238,216,170,.6)); box-shadow: inset 0 2px 10px rgba(110,74,16,.22), inset 0 0 0 1.5px rgba(196,148,62,.35); }
.sc-ghost { position: absolute; inset: 0; display: grid; place-items: center; }
.sc-ghost i { grid-area: 1 / 1; width: 50px; height: 70px; border-radius: 8px; border: 2px dashed rgba(168,111,27,.42); transform-origin: 50% 135%; translate: 0 -4px; }
.sc-ghost i:nth-child(1) { rotate: -18deg; } .sc-ghost i:nth-child(3) { rotate: 18deg; }
.sc-cam { position: relative; width: 66px; height: 66px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(110,74,16,.3)); }
.sc-photo { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: cover; animation: k3develop .6s ease-out both; transition: filter .3s ease; }
@keyframes k3develop { from { filter: brightness(2.2) saturate(0); } }
.sc-view.busy .sc-photo { filter: brightness(.82) saturate(.85); }
.sc-corners i { position: absolute; z-index: 5; width: 24px; height: 24px; border: 0 solid var(--gold-deep); transition: border-color .25s ease; }
.sc-corners i:nth-child(1) { top: var(--in); left: var(--in); border-width: 3px 0 0 3px; border-radius: 9px 0 0 0; }
.sc-corners i:nth-child(2) { top: var(--in); right: var(--in); border-width: 3px 3px 0 0; border-radius: 0 9px 0 0; }
.sc-corners i:nth-child(3) { bottom: var(--in); left: var(--in); border-width: 0 0 3px 3px; border-radius: 0 0 0 9px; }
.sc-corners i:nth-child(4) { bottom: var(--in); right: var(--in); border-width: 0 3px 3px 0; border-radius: 0 0 9px 0; }
.sc-view.shot .sc-corners i { border-color: #FFF4D6; }
.sc-view.bad .sc-corners i { border-color: #FF8A9A; }
.sc-view.bad { animation: k3shake .36s ease; }
.sc-view.busy::after { content: ""; position: absolute; z-index: 3; top: 0; bottom: 0; left: -45%; width: 45%; pointer-events: none;
  background: linear-gradient(100deg, rgba(255,250,230,0), rgba(255,250,230,.5), rgba(255,250,230,0)); animation: k3sweep 1.2s ease-in-out infinite; }
.sc-view.busy .sc-corners i { animation: k3pulse 1.2s ease-in-out infinite; }
@keyframes k3sweep { to { translate: 322% 0; } }
@keyframes k3pulse { 50% { opacity: .4; } }
@keyframes k3shake { 20%, 60% { translate: -6px 0; } 40%, 80% { translate: 6px 0; } }
.sc-title { font: 800 1.2rem/1.2 var(--display); text-wrap: balance; }
.sc-tip { margin: 0; max-width: 40ch; color: var(--ink2); font-size: .94rem; line-height: 1.4; text-wrap: balance; }
.sc-msg { margin: 0; max-width: 34ch; color: var(--ruby); font-size: .92rem; font-weight: 600; line-height: 1.4; text-wrap: pretty; }
.sc-msg.ok { color: var(--ink); }
.sc-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; width: 100%; max-width: 360px; margin-top: 2px; padding: 0 8px; }
.sc-acts .btn { padding: 0 12px 3px; }
.sc-key { width: 100%; text-align: left; }
.sc-receipt { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; border-radius: 14px; border: 1.5px solid rgba(196,148,62,.45); background: rgba(255,255,255,.55); }
.sc-stub { flex: none; width: 64px; aspect-ratio: 16 / 10; border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 2px #FFF8E6, 0 0 0 3.5px rgba(196,148,62,.7); animation: k3stub .5s var(--spring) both; }
.sc-stub img { display: block; width: 100%; height: 100%; object-fit: cover; }
@keyframes k3stub { from { transform: scale(2.2) translate(40%, 30%); opacity: 0; } }
.sc-receipt p { display: grid; gap: 3px; margin: 0; text-align: left; }
.sc-receipt b { font: 800 1rem/1.15 var(--display); }
.sc-receipt small { color: var(--ink2); font-size: .86rem; line-height: 1.35; text-wrap: pretty; }
.foot-col { display: grid; gap: 14px; padding: 0 4px; }
.btn.out-btn.on { color: #4A3206; background: linear-gradient(180deg, #FFE9A8, #F2C861 55%, #E0A93E) padding-box, var(--rim) border-box; box-shadow: inset 0 -5px 0 #B98228, inset 0 2px 0 rgba(255,255,255,.6); }
.btn.out-btn.likely { animation: k3nudgeY 1.6s var(--out-e) 2; }
@keyframes k3nudgeY { 0%, 60%, 100% { transform: none; } 70% { transform: translateY(-3px); } 80% { transform: none; } }

/* ── Between rounds (kit #between): the contract dealt face down, turned over, with a gold line that runs down ── */
.intro { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  padding: calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom));
  background: radial-gradient(90% 60% at 50% 42%, rgba(var(--glow),.34), rgba(var(--glow2),0) 70%), var(--veil); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); animation: fade .25s ease both; }
.intro.out { animation: fade .26s ease reverse both; }
.won-pill { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 6px 16px 6px 8px; border-radius: 99px; border: 2px solid transparent; font: 700 1rem/1.1 var(--display); color: #FFE7A3;
  background: linear-gradient(180deg, var(--panel-hi), var(--panel-lo)) padding-box, var(--rim) border-box; animation: k3drop .6s var(--spring) both; }
.won-pill img { width: 30px; height: 30px; object-fit: contain; }
@keyframes k3drop { from { transform: translateY(-18px) scale(.96); opacity: 0; } }
.cflip { --w: min(272px, 74vw, calc((100dvh - 250px) / 1.485)); flex: none; width: var(--w); height: calc(var(--w) * 1.485); perspective: 1200px; container-type: inline-size; }
.cflip-in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; animation: k3flip 1s .15s var(--spring) both; }
.intro.out .cflip-in { animation: dealOut .26s ease-in both; }
.cf-face, .cf-back { position: absolute; inset: 0; border-radius: 6.6cqw; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.cf-back { transform: rotateY(180deg); background: url(art/card-back.webp) center / 100% 100%; border: 3px solid #D9B166; }
.cf-face { display: grid; justify-items: center; align-content: center; gap: 3.3cqw; padding: 11cqw 12.5cqw 15cqw; text-align: center; color: var(--paper-ink);
  background: radial-gradient(110% 80% at 50% 20%, #FFFFFF, #FBF2DC 60%, #F1E1BC); border: 3px solid #D9B166; box-shadow: 0 26px 40px -18px rgba(0,0,0,.65); }
.cf-face::before { content: ""; position: absolute; inset: 3cqw; border-radius: 4.4cqw; border: 1.5px solid rgba(196,148,62,.6); pointer-events: none; }
.cf-face.s-heart, .cf-face.s-diamond { --suit: var(--heart); } .cf-face.s-spade { --suit: var(--spade); } .cf-face.s-club { --suit: var(--club); }
.cf-face .idx { position: absolute; top: 5.2cqw; left: 5.5cqw; display: grid; justify-items: center; color: var(--suit); }
.cf-face .idx b { font: 800 10cqw/1 var(--display); } .cf-face .idx i { font-style: normal; font-size: 6.8cqw; line-height: 1; }
.cf-face .idx.bot { top: auto; left: auto; bottom: 5.2cqw; right: 5.5cqw; transform: rotate(180deg); }
.cf-face .cap { font: 800 4.35cqw/1 var(--label); letter-spacing: .16em; text-transform: uppercase; color: #74500F; }
.cf-face .suit { width: 28.7cqw; height: 28.7cqw; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(0,0,0,.25)); }
.cf-face h2 { margin: 0; font: 900 11.8cqw/1 var(--display); letter-spacing: -.02em; text-wrap: balance; }
.cf-face .deal { font: 700 5.6cqw/1.2 var(--display); color: var(--paper-ink2); }
.cf-face .melds { gap: 3cqw; } .cf-face .pc { font-size: 3.3cqw; }
.cf-face .tip { display: block; max-width: 24ch; margin: 0; font-size: 5cqw; line-height: 1.35; font-style: italic; color: var(--paper-ink2); text-wrap: balance; }
.cf-face .timer { position: absolute; left: 22cqw; right: 22cqw; bottom: 7cqw; height: 3px; border-radius: 3px; background: rgba(196,148,62,.3); overflow: hidden; }
.cf-face .timer::after { content: ""; position: absolute; inset: 0; background: var(--gilt); transform-origin: left; animation: k3timer 4.6s 1.1s linear both; }
@keyframes k3flip { from { transform: rotateY(180deg) scale(.86); } }
@keyframes k3timer { to { transform: scaleX(0); } }
.intro-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px 26px; }
@media (prefers-reduced-motion: reduce) { .sc-view.busy::after { animation: none; left: 0; width: 100%; background: rgba(255,250,230,.2); } .sc-view.busy .sc-corners i { animation: none; } .flycard, .sparks { display: none; } }
/* ── Looks: Game night, Lime and Cherry are the same materials in their own colours. Gold and paper stay; the water, enamel, gem and panels change. ── */
:root[data-look="table"] { --teal-hi: #4E7DF4; --teal-face: #3365E6; --teal: #2A57D6; --teal-lo: #1E42AE; --teal-deep: #142D7E; --sap-hi: #9A6BF0; --sap: #7444D6; --sap-lo: #5129A6; --sap-deep: #36176F; --gem-1: #FFF8D2; --gem-2: #FFD54F; --gem-3: #D99A00; --well-hi: #233163; --well-lo: #18224A; --well2-hi: #313F72; --well2-lo: #222D58; --dis-hi: #6370A0; --dis-lo: #4C5886; --panel-hi: #2D52C8; --panel-lo: #1A3290; --tab-hi: #2A4DBE; --tab-lo: #172C82; --panel-ink2: #DCE6FF; --now-1: #4775EE; --now-2: #2A54CF; --now-3: #1A3592; --again-1: #24408F; --again-2: #182D6C; --glow: 255,214,90; --glow2: 120,150,255; --veil: rgba(12,22,72,.9); --scrim: rgba(8,14,46,.55); }
:root[data-look="table"][data-scheme="light"] { --gline: rgba(20,36,92,.13); --gline2: rgba(20,36,92,.3); --glass: rgba(255,255,255,.55); --track: rgba(20,36,92,.09); --g4: #F7F9FF; --g45: #E8EEFF; --g5: #D9E3FC; --orb1: 255,255,255; --orb2: 255,200,61; --tile: rgba(42,91,234,.06); --halo1: 255,255,255; --halo2: 255,214,90; --hl: #8A5800; --glass-ink: #5A6390; }
:root[data-look="table"][data-scheme="dark"] { --g4: #23388C; --g45: #1A2B74; --g5: #111D56; --orb1: 120,160,255; --orb2: 255,214,90; --tile: rgba(205,220,255,.09); --halo1: 120,160,255; --halo2: 70,100,220; --hl: #FFE08A; --gline: rgba(255,240,200,.16); --gline2: rgba(255,240,200,.4); --glass: rgba(220,230,255,.1); --glass-ink: rgba(241,244,255,.72); --track: rgba(0,0,0,.3); }
:root[data-look="lime"] { --teal-hi: #62B43C; --teal-face: #45992A; --teal: #3B8C24; --teal-lo: #2A6C18; --teal-deep: #1B4C0E; --gem-1: #E6EEFF; --gem-2: #8FB0FF; --gem-3: #2A5BEA; --well-hi: #233D20; --well-lo: #172B15; --well2-hi: #304C2C; --well2-lo: #22381F; --dis-hi: #66805C; --dis-lo: #4F6646; --panel-hi: #3C8A25; --panel-lo: #22591A; --tab-hi: #377F22; --tab-lo: #1F5016; --panel-ink2: #E2F5D4; --now-1: #5AAA38; --now-2: #3A8524; --now-3: #245A16; --again-1: #2A5A1E; --again-2: #1D4315; --glow: 190,240,120; --glow2: 90,170,60; --veil: rgba(14,40,12,.9); --scrim: rgba(10,28,8,.55); }
:root[data-look="lime"][data-scheme="light"] { --gline: rgba(24,52,18,.13); --gline2: rgba(24,52,18,.3); --glass: rgba(255,255,255,.55); --track: rgba(24,52,18,.09); --g4: #F8FDF2; --g45: #EAF6DD; --g5: #DCEDCB; --orb1: 255,255,255; --orb2: 255,220,90; --tile: rgba(62,140,36,.07); --halo1: 255,255,255; --halo2: 190,240,120; --hl: #7A4E00; --glass-ink: #566B4E; }
:root[data-look="lime"][data-scheme="dark"] { --g4: #3A6618; --g45: #2C5212; --g5: #1C380C; --orb1: 170,235,120; --orb2: 255,220,110; --tile: rgba(220,255,200,.08); --halo1: 170,235,120; --halo2: 80,160,50; --hl: #FFE08A; --gline: rgba(255,240,200,.16); --gline2: rgba(255,240,200,.4); --glass: rgba(220,255,210,.1); --glass-ink: rgba(240,248,234,.72); --track: rgba(0,0,0,.3); }
:root[data-look="parlour"] { --teal-hi: #E2486C; --teal-face: #CC2C51; --teal: #BE2448; --teal-lo: #961539; --teal-deep: #690B27; --gem-1: #FFF8D2; --gem-2: #FFD54F; --gem-3: #D99A00; --well-hi: #4A1B2C; --well-lo: #34111F; --well2-hi: #5A2638; --well2-lo: #421929; --dis-hi: #8E5C68; --dis-lo: #724752; --panel-hi: #C42A4E; --panel-lo: #82102F; --tab-hi: #B82548; --tab-lo: #7A0E2C; --panel-ink2: #FFE1E7; --now-1: #DA3E62; --now-2: #B42246; --now-3: #7E0E2E; --again-1: #7A1631; --again-2: #5A0D23; --glow: 255,214,90; --glow2: 255,120,150; --veil: rgba(60,8,22,.9); --scrim: rgba(40,6,16,.55); }
:root[data-look="parlour"][data-scheme="light"] { --gline: rgba(80,14,28,.13); --gline2: rgba(80,14,28,.3); --glass: rgba(255,255,255,.55); --track: rgba(80,14,28,.09); --g4: #FFF8F9; --g45: #FFEBEE; --g5: #FBDCE1; --orb1: 255,255,255; --orb2: 255,200,61; --tile: rgba(212,36,69,.06); --halo1: 255,255,255; --halo2: 255,214,90; --hl: #8A5000; --glass-ink: #78545B; }
:root[data-look="parlour"][data-scheme="dark"] { --g4: #8A2244; --g45: #6C1835; --g5: #470D22; --orb1: 255,140,165; --orb2: 255,214,90; --tile: rgba(255,220,228,.08); --halo1: 255,140,165; --halo2: 200,40,80; --hl: #FFE08A; --gline: rgba(255,240,200,.16); --gline2: rgba(255,240,200,.4); --glass: rgba(255,225,232,.1); --glass-ink: rgba(255,240,242,.72); --track: rgba(0,0,0,.3); }
/* ── Results: the finale stage, full-bleed under the nav. Deep enamel in every look and both modes, like the
   Playing now card, so the fireworks always have a night sky. ─────────────────────────────────────────────── */
.fin { position: relative; isolation: isolate; overflow: hidden; display: grid; justify-items: center; align-content: start; gap: 10px; text-align: center; color: #FFF7E2;
  margin-top: calc(-60px - env(safe-area-inset-top)); padding: calc(70px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 20px max(16px, env(safe-area-inset-left));
  background: radial-gradient(70% 42% at 50% 24%, rgba(var(--glow), .26), rgba(var(--glow2), 0) 72%), linear-gradient(180deg, var(--now-2), var(--now-3) 84%);
  border-bottom: 2px solid var(--gilt); }
.recap .nav:not(.collapsed) .nav-back { color: #FFE7A3; }
.fin-rays { position: absolute; z-index: -1; top: calc(122px + env(safe-area-inset-top)); left: 50%; width: 760px; height: 760px; margin: -380px 0 0 -380px; fill: #FFE9A6; opacity: .2;
  -webkit-mask: radial-gradient(closest-side, #000 10%, transparent 75%); mask: radial-gradient(closest-side, #000 10%, transparent 75%); animation: orbit 80s linear infinite; }
.fin-fw { position: absolute; z-index: -1; left: 0; top: 0; width: 100%; height: 64%; pointer-events: none; }
.fin-trophy { width: 104px; height: 104px; object-fit: contain; filter: drop-shadow(0 12px 16px rgba(0,0,0,.4)); animation: finRise .8s .1s var(--spring) both; }
.fin-ribbon { position: relative; max-width: calc(100% - 68px); margin: 2px 0 0; padding: 10px 22px 14px; border-radius: 8px; border: 3px solid transparent;
  font: 900 clamp(1.6rem, 7.6vw, 2.2rem)/1.05 var(--display); letter-spacing: -.02em; color: #FFF7E2; text-wrap: balance;
  background: linear-gradient(180deg, var(--teal-face), var(--teal) 60%, var(--teal-lo)) padding-box, var(--rim) border-box;
  box-shadow: inset 0 -5px 0 var(--teal-deep), 0 12px 20px -10px rgba(0,0,0,.5); animation: finPop .7s .35s var(--spring) both; }
.fin-tail { position: absolute; top: 12px; width: 30px; height: calc(100% - 4px); background: linear-gradient(180deg, var(--teal-lo), var(--teal-deep)); }
.fin-tail.l { left: -31px; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 34% 50%); }
.fin-tail.r { right: -31px; clip-path: polygon(0 0, 100% 0, 66% 50%, 100% 100%, 0 100%); }
.fin-lede { display: grid; gap: 4px; margin: 4px 0 2px; color: rgba(255,247,226,.88); font-size: 1rem; }
.fin-lede small { color: rgba(255,247,226,.64); font-size: .84rem; }
.fin-podium { display: flex; align-items: flex-end; justify-content: center; gap: 8px; width: 100%; max-width: 420px; padding-top: 34px; }
.fpod { position: relative; flex: 1; min-width: 0; display: grid; justify-items: center; gap: 4px; }
.fpod b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 1.05rem/1.15 var(--display); }
.fpod-pts { font: 700 1rem/1 var(--num); color: #FFE7A3; }
.fpod-crown { position: absolute; z-index: 1; top: -40px; width: 56px; filter: drop-shadow(0 6px 8px rgba(0,0,0,.4)); animation: finCrown .8s 1.5s var(--spring) both; }
.fpod-av { display: grid; animation: finRise .6s var(--spring) both; animation-delay: calc(.6s + var(--d) * .2s); }
.fin .peg { box-shadow: 0 0 0 3px #FFF7E2, 0 6px 12px -2px rgba(0,0,0,.4); }
.fin .peg.ring { box-shadow: 0 0 0 3px #FFF7E2, 0 0 0 6px var(--gold-ring), 0 8px 16px 2px rgba(0,0,0,.35); }
.fpod-plinth { width: 100%; display: grid; justify-items: center; align-content: start; padding-top: 12px; border-radius: 14px 14px 0 0; border: 3px solid transparent; border-bottom: 0; transform-origin: bottom;
  background: linear-gradient(180deg, var(--teal-hi) 0%, var(--teal) 30%, var(--teal-lo) 100%) padding-box, var(--rim) border-box; box-shadow: inset 0 8px 0 rgba(255,255,255,.14);
  animation: finGrow .7s var(--spring) both; animation-delay: calc(var(--d) * .2s); }
.fpod-plinth img { width: 46px; height: 46px; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(0,0,0,.35)); }
.fpod.p1 .fpod-plinth { height: 132px; background: linear-gradient(180deg, color-mix(in srgb, var(--teal-hi) 64%, #fff) 0%, var(--teal-hi) 30%, var(--teal-lo) 100%) padding-box, var(--rim) border-box; }
.fpod.p2 .fpod-plinth { height: 100px; } .fpod.p3 .fpod-plinth { height: 76px; }
.fpod.p1 .fpod-plinth img { width: 56px; height: 56px; }
.fin-base { width: calc(100% + 24px); max-width: 444px; height: 16px; margin-top: -10px; border-radius: 6px; border: 2.5px solid transparent;
  background: linear-gradient(180deg, var(--teal-lo), var(--teal-deep)) padding-box, var(--rim) border-box; }
.fin-replay { margin-top: 10px; min-height: 44px; padding: 0 20px; border-radius: 99px; border: 1.5px solid rgba(255,233,166,.42); background: rgba(0,0,0,.2); color: #FFE7A3;
  font: 700 .78rem/1 var(--label); letter-spacing: .12em; text-transform: uppercase; transition: transform .2s var(--spring), background .2s; }
.fin-replay:active { transform: scale(.95); background: rgba(0,0,0,.3); }
.fin-confetti { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
.fin-confetti i, .fin-confetti img { position: absolute; top: -30px; left: var(--x); width: var(--w); animation: finFall var(--t) var(--delay) cubic-bezier(.25,.5,.5,1) both; }
.fin-confetti i { height: calc(var(--w) * 1.4); border-radius: 2px; background: var(--c); }
.fin-confetti i.paper { background: #FFF6DC; border: 1px solid #D9B166; }
.fin-confetti .drift { animation: finDrift var(--t) var(--delay) linear infinite both; }
.fin-confetti.asleep > * { animation-play-state: paused; }
@keyframes finRise { from { transform: translateY(24px) scale(.6); opacity: 0; } }
@keyframes finPop { from { transform: scale(.4); opacity: 0; } }
@keyframes finGrow { from { transform: scaleY(0); } }
@keyframes finCrown { from { transform: translateY(-70px) rotate(-20deg); opacity: 0; } }
@keyframes finFall { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 85% { opacity: 1; } 100% { transform: translate(var(--dx), var(--fy, 640px)) rotate(var(--r)); opacity: 0; } }
@keyframes finDrift { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 6% { opacity: 1; } 50% { transform: translate(var(--dx), calc(var(--fy, 640px) * .5)) rotate(calc(var(--r) * .5)); }
  90% { opacity: 1; } 100% { transform: translate(0, var(--fy, 640px)) rotate(var(--r)); opacity: 0; } }
/* Table moments: a plaque for the whole table, right under the stage. */
.tm-plaque { display: flex; align-items: center; gap: 14px; margin-top: 18px; padding: 10px 16px 10px 10px; border-radius: 18px; border: 2.5px solid transparent; color: var(--paper-ink);
  background: radial-gradient(120% 120% at 0% 0%, var(--paper-hi), var(--paper) 58%, var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: 0 12px 24px -16px rgba(0,0,0,.5);
  animation: finRise .6s .9s var(--spring) both; }
.tm-list { list-style: none; margin: 10px 0 0; padding: 4px 0; border-radius: 18px; border: 2px solid transparent; color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper)) padding-box, var(--rim-soft) border-box; animation: finRise .6s 1s var(--spring) both; }
.tm-list li { display: grid; grid-template-columns: 44px 1fr; align-items: center; column-gap: 12px; padding: 8px 14px; }
.tm-list li + li { border-top: 1px solid var(--paper-line); }
.tm-list img { grid-row: span 2; width: 44px; height: 44px; object-fit: contain; }
.tm-list b { font: 800 1rem/1.15 var(--display); }
.tm-list span { color: var(--paper-ink2); font-size: .88rem; line-height: 1.3; }
.tm-med, .aw-med { flex: none; display: grid; place-items: center; border-radius: 50%; border: 3px solid transparent;
  background: radial-gradient(circle at 50% 35%, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; }
.tm-med { width: 66px; height: 66px; } .tm-med img { width: 50px; height: 50px; object-fit: contain; }
.tm-plaque > div { flex: 1; min-width: 0; }
.tm-plaque b { display: block; font: 800 1.2rem/1.1 var(--display); letter-spacing: -.01em; }
.tm-plaque div span { display: block; margin-top: 3px; color: var(--paper-ink2); font-size: .92rem; line-height: 1.3; text-wrap: pretty; }
.tm-table { flex: none; } .tm-table .avs .peg { box-shadow: 0 0 0 2px var(--paper); }
@media (max-width: 520px) { .tm-table { display: none; } }
/* Awards: paper cards with an enamel medal, rarest first. */
.aw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.aw { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 14px 10px; border-radius: 18px; border: 2px solid transparent; text-align: center; color: var(--paper-ink);
  background: radial-gradient(120% 90% at 50% 0%, var(--paper-hi), var(--paper) 62%, var(--paper-lo)) padding-box, var(--rim) border-box;
  animation: finRise .5s var(--spring) both; animation-delay: calc(var(--i) * 70ms); }
.aw-med { width: 64px; height: 64px; margin-bottom: 4px; } .aw-med img { width: 46px; height: 46px; object-fit: contain; }
.aw b { font: 800 1rem/1.15 var(--display); text-wrap: balance; }
.aw small { color: var(--paper-ink2); font-size: .82rem; line-height: 1.3; text-wrap: balance; }
.aw-who { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; margin-top: auto; padding-top: 8px; font: 700 .9rem/1 var(--display); }
.aw-who > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-who .peg { box-shadow: 0 0 0 2px var(--paper); }
.aw-more { display: flex; justify-content: center; margin-top: 16px; }
.badge-art { width: 40px; height: 40px; object-fit: contain; }
/* ── Page heroes: a full-bleed top section under the nav, deep enamel like the finale (Learn, Stats, a table) ── */
.ptop { position: relative; isolation: isolate; overflow: hidden; color: #FFF7E2;
  margin-top: calc(-60px - env(safe-area-inset-top)); padding: calc(66px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left));
  background: radial-gradient(80% 70% at 78% 18%, rgba(var(--glow), .24), rgba(var(--glow2), 0) 70%), linear-gradient(180deg, var(--now-2), var(--now-3) 88%);
  border-bottom: 2px solid var(--gilt); margin-bottom: 6px; }
.ptop::before { content: ""; position: absolute; inset: 0; z-index: -1; background: var(--back-tile, none); opacity: .5; }
.ptop-in { max-width: 720px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 14px; row-gap: 6px; }
.ptop-title { grid-column: 1; margin: 0; font: 800 2.5rem/1.02 var(--display); font-variation-settings: "SOFT" 50; letter-spacing: -.015em; text-wrap: balance; overflow-wrap: anywhere; animation: finRise .5s var(--spring) both; }
.ptop-sub { grid-column: 1; margin: 0; color: rgba(255,247,226,.84); font-size: 1rem; line-height: 1.35; text-wrap: pretty; animation: finRise .5s .08s var(--spring) both; }
.ptop-art { grid-column: 2; grid-row: 1 / span 2; width: 96px; height: 96px; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(0,0,0,.4)); animation: finPop .6s .15s var(--spring) both; }
.ptop-avs { grid-column: 2; grid-row: 1 / span 2; } .ptop-avs .avs .peg { box-shadow: 0 0 0 2px var(--now-2); }
.has-top .nav:not(.collapsed) .nav-back { color: #FFE7A3; }
.ptop .fin-podium.tp { grid-column: 1 / -1; justify-self: center; max-width: 360px; padding-top: 34px; }
.ptop .fin-base { grid-column: 1 / -1; justify-self: center; width: calc(100% + 16px); max-width: 376px; height: 14px; margin-top: -6px; }
.fin-podium.tp .fpod b { font-size: .98rem; } .fin-podium.tp .fpod-pts { font-size: .9rem; }
.fin-podium.tp .fpod-crown { width: 44px; top: -32px; animation-delay: .9s; }
.fin-podium.tp .fpod.p1 .fpod-plinth { height: 76px; } .fin-podium.tp .fpod.p2 .fpod-plinth { height: 58px; } .fin-podium.tp .fpod.p3 .fpod-plinth { height: 44px; }
.fin-podium.tp .fpod-plinth { padding-top: 8px; } .fin-podium.tp .fpod-plinth img { width: 34px; height: 34px; } .fin-podium.tp .fpod.p1 .fpod-plinth img { width: 40px; height: 40px; }
button.fpod { color: inherit; font: inherit; } button.fpod:active .fpod-av { transform: scale(.94); } .fpod-av { transition: transform .2s var(--spring); }
.ptop .peg { box-shadow: 0 0 0 3px #FFF7E2, 0 6px 12px -2px rgba(0,0,0,.4); }
.ptop .peg.ring { box-shadow: 0 0 0 3px #FFF7E2, 0 0 0 6px var(--gold-ring), 0 8px 16px 2px rgba(0,0,0,.35); }
@media (min-width: 760px) { .ptop-title { font-size: 3rem; } .ptop-art { width: 120px; height: 120px; } }

/* ── Learn, in kit parts: numbered steps in enamel rings, paper callouts, tilted value tiles, a paper Q&A ── */
.steps { gap: 14px; } .steps li { grid-template-columns: auto 1fr; padding: 0; align-items: start; } .steps li:not(:last-child)::before { content: none; }
.step-n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; border: 2px solid transparent; font: 800 1rem/1 var(--display); color: #FFF7E2;
  background: radial-gradient(circle at 50% 35%, var(--teal-face), var(--teal-lo)) padding-box, var(--rim) border-box; }
.steps b { margin-top: 5px; font: 700 1.05rem/1.25 var(--display); } .steps small { font-size: .94rem; }
.calls { display: grid; gap: 12px; margin: 16px 0 14px; }
.call { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 18px; border: 2px solid transparent; color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper)) padding-box, var(--rim-soft) border-box; animation: finRise .45s var(--spring) both; }
.call:nth-child(2) { animation-delay: .05s; } .call:nth-child(3) { animation-delay: .1s; } .call:nth-child(4) { animation-delay: .15s; }
.call .ci { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; border: 2px solid transparent; color: #FFF7E2;
  background: radial-gradient(circle at 50% 35%, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; }
.call.warn .ci { background: radial-gradient(circle at 50% 35%, var(--ruby-hi), var(--ruby-lo)) padding-box, var(--rim) border-box; }
.call > div { min-width: 0; } .call b { display: block; margin-top: 2px; font: 800 1.02rem/1.2 var(--display); }
.call p { margin: 3px 0 0; color: var(--paper-ink2); font-size: .95rem; line-height: 1.4; }
.call ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 6px; color: var(--paper-ink2); font-size: .95rem; line-height: 1.4; }
.call li::marker { color: var(--gilt); }
.rule-card { position: relative; display: grid; justify-items: center; gap: 8px; margin-top: 30px; padding: 36px 16px 18px; border-radius: 22px; border: 3px solid transparent; text-align: center; color: var(--paper-ink);
  background: radial-gradient(120% 80% at 50% 0%, var(--paper-hi), var(--paper) 62%, var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: 0 16px 28px -18px rgba(0,0,0,.55); animation: finRise .5s var(--spring) both; }
.rc-num { position: absolute; top: -24px; left: 50%; margin-left: -24px; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; border: 3px solid transparent;
  font: 900 1.4rem/1 var(--display); color: #FFF7E2; background: radial-gradient(circle at 50% 35%, var(--teal-face), var(--teal-lo)) padding-box, var(--rim) border-box; box-shadow: 0 6px 10px -4px rgba(0,0,0,.5); }
.rule-card h3 { margin: 0; font: 800 1.6rem/1.05 var(--display); letter-spacing: -.01em; }
.rc-line { margin: 0; font: 700 .82rem/1.2 var(--label); letter-spacing: .1em; text-transform: uppercase; color: #7A5A1E; }
.rc-goal { margin: 2px 0 0; color: var(--paper-ink); font-size: .98rem; line-height: 1.4; text-wrap: pretty; }
.rc-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; margin-top: 4px; }
.rc-facts span { display: grid; gap: 3px; padding: 8px 4px; border-radius: 12px; background: rgba(255,255,255,.6); border: 1px solid rgba(196,148,62,.35); font: 700 .7rem/1.1 var(--label); letter-spacing: .06em; text-transform: uppercase; color: #6E5530; }
.rc-facts b { font: 800 1.35rem/1 var(--num); color: var(--paper-ink); letter-spacing: 0; }
.rpick { gap: 4px; } .rpick .rnum { width: 40px; height: 40px; border: 2px solid var(--gline2); background: var(--glass); color: var(--ink); font: 800 1rem/1 var(--display); transition: transform .2s var(--spring); }
.rpick .rnum.on { border-color: transparent; color: #FFF7E2; background: radial-gradient(circle at 50% 35%, var(--teal-face), var(--teal-lo)) padding-box, var(--rim) border-box; transform: translateY(-2px); }
.rpick .rnum:active { transform: scale(.92); }
.sheet .rpick .rnum:not(.on) { border-color: var(--paper-line); background: rgba(255,255,255,.55); color: var(--paper-ink); }
.values { gap: 10px; padding: 4px 2px 6px; }
.values div { display: grid; justify-items: center; align-content: start; gap: 6px; padding: 14px 4px 12px; border-radius: 14px; border: 2px solid #D9B166; text-align: center; color: var(--paper-ink);
  background: linear-gradient(180deg, #FFFFFF, #F6EAC9); box-shadow: 0 8px 14px -8px rgba(0,0,0,.5); transform: rotate(-2deg); transition: transform .25s var(--spring); }
.values div:nth-child(even) { transform: rotate(2deg); } .values div:active { transform: rotate(0) scale(.96); }
.values span { font: 700 .8rem/1.1 var(--label); letter-spacing: .06em; text-transform: uppercase; color: #6E5530; }
.values b { font: 800 1.6rem/1 var(--num); } .values .long b { font-size: .95rem; line-height: 1.15; }
.faq { padding: 4px 6px; border-radius: 18px; border: 2px solid transparent; overflow: hidden; color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper)) padding-box, var(--rim-soft) border-box; }
.faq .qa { border-bottom: 0; } .faq .qa + .qa { border-top: 1px solid rgba(196,148,62,.35); }
.faq .qa summary { font: 700 1.02rem/1.3 var(--display); border-radius: 12px; transition: background .2s ease; }
.faq .qa summary:active { background: rgba(168,111,27,.08); }
.faq .qa summary svg { color: #A86F1B; } .faq .qa p { color: var(--paper-ink2); } .faq .qa[open] p { animation: finRise .3s var(--out-e) both; }

.glossary { padding: 2px 16px; } .glossary .gloss { display: grid; gap: 4px; padding: 13px 0; }
.glossary .gloss + .gloss { border-top: 1px solid rgba(196,148,62,.35); }
.glossary .gloss b { font: 800 1.08rem/1.2 var(--display); color: var(--paper-ink); } .glossary .gloss small { color: var(--paper-ink2); font-size: .95rem; line-height: 1.4; }
/* ── Profile: the player's stage, a dotted ledger, the cabinet on a shelf ── */
.pf-stage { position: relative; display: grid; place-items: end center; height: 196px; border-radius: 20px; overflow: hidden; isolation: isolate;
  background: radial-gradient(75% 85% at 50% 28%, color-mix(in srgb, var(--peg) 52%, #FFF4D6) 0%, var(--peg) 58%, color-mix(in srgb, var(--peg) 62%, #1A0A08) 100%); }
.pf-stage::before { content: ""; position: absolute; z-index: -1; left: 50%; bottom: 10px; width: 170px; height: 26px; translate: -50% 0; border-radius: 50%; background: radial-gradient(closest-side, rgba(20,6,4,.42), rgba(20,6,4,0)); }
.pf-card { display: block; width: 112px; margin-bottom: 20px; rotate: -5deg; filter: drop-shadow(0 12px 14px rgba(20,6,4,.4)); animation: pfHop .8s .2s var(--spring) both; }
.pf-peg { display: block; margin-bottom: 34px; animation: pfHop .8s .2s var(--spring) both; } .pf-peg .peg { box-shadow: 0 0 0 4px #FFF7E2, 0 14px 18px -4px rgba(20,6,4,.45); }
@keyframes pfHop { 0% { opacity: 0; translate: 0 26px; scale: .86; } 55% { opacity: 1; translate: 0 -10px; scale: 1.03; } 100% { translate: 0 0; scale: 1; } }
.pf-who { display: flex; align-items: center; gap: 12px; margin: 12px 0 4px; }
.pf-who p { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; margin: 0; color: var(--ink2); font-size: 1rem; line-height: 1.3; }
.pf-who p img { flex: none; width: 26px; height: 26px; object-fit: contain; }
.pf-dress { flex: none; min-height: 44px; padding: 0 18px 2px; border-radius: 99px; border: 2px solid transparent; font: 700 .98rem/1 var(--display); color: var(--paper-ink);
  background: linear-gradient(180deg, var(--paper-hi), var(--paper-lo)) padding-box, var(--rim) border-box; box-shadow: inset 0 -2px 0 #D9BE86; transition: translate .15s ease; }
.pf-dress:active { box-shadow: inset 0 2px 4px rgba(110,74,16,.25); translate: 0 1px; }
.ledger { display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; row-gap: 2px; margin: 0 0 14px; }
.ledger div { display: flex; align-items: baseline; gap: 6px; padding: 7px 0; }
.ledger dt { font: 700 1rem/1 var(--label); letter-spacing: .02em; color: var(--ink2); }
.ledger div::after { content: ""; order: 1; flex: 1; min-width: 12px; translate: 0 -3px; border-bottom: 2px dotted rgba(168,111,27,.45); }
.ledger dd { order: 2; margin: 0; font: 700 1.3rem/1 var(--num); font-variant-numeric: tabular-nums; color: var(--ink); }
@media (max-width: 359px) { .ledger { grid-template-columns: 1fr; } }
.pf-cab { display: grid; gap: 6px; width: 100%; padding: 12px 14px 0; border-radius: 20px; border: 1px solid rgba(196,148,62,.4); background: rgba(255,255,255,.45); color: var(--paper-ink); text-align: left; transition: background .15s ease; }
.pf-cab:active { background: rgba(168,111,27,.09); }
@media (hover: hover) and (pointer: fine) { .pf-cab:hover { background: rgba(255,255,255,.62); } .pf-cab:hover .pf-cab-h svg { translate: 3px 0; } }
.pf-cab-h { display: flex; align-items: center; gap: 10px; } .pf-cab-h .grow { flex: 1; min-width: 0; }
.pf-cab-h b { display: block; font: 800 1.15rem/1.1 var(--display); } .pf-cab-h small { display: block; margin-top: 3px; color: var(--paper-ink2); font-size: .88rem; text-wrap: balance; }
.pf-cab-h svg { flex: none; color: #A86F1B; transition: translate .3s var(--spring); }
.pf-cab .cab-grid { --row: 122px; position: relative; grid-template-columns: repeat(4, 1fr); padding: 0; background: none; }
.pf-cab .cab-grid::before { content: ""; position: absolute; left: 0; right: 0; top: 80px; height: 12px; pointer-events: none;
  background: linear-gradient(180deg, #FFEDB0 0, #E6B04A 2px, #A86F1B 5px, rgba(110,74,16,.28) 6px, rgba(110,74,16,0) 12px); }
.pf-cab .cab-cell { color: var(--paper-ink); }
.sheet.profile .h2h b { font: 700 1.2rem/1 var(--num); font-variant-numeric: tabular-nums; }
/* ── Settings: tilted look tiles, each its own water with a jewel; coaching as two paper choices ── */
.looks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 10px; padding: 4px 2px 2px; }
.look { position: relative; display: grid; align-content: end; aspect-ratio: 1; padding: 9px 10px; border-radius: 16px; border: 3px solid transparent; text-align: left; overflow: hidden; isolation: isolate;
  background: radial-gradient(130% 90% at 50% 8%, var(--c2) 0%, var(--c3) 52%, var(--c5) 100%) padding-box, var(--rim-soft) border-box;
  transform: rotate(var(--tilt, -2deg)); transition: transform .3s var(--spring); box-shadow: 0 12px 20px -12px rgba(60,40,10,.6); }
.look:nth-child(even) { --tilt: 2deg; }
.look img { position: absolute; top: 9%; left: 50%; height: 52%; max-width: 62%; object-fit: contain; transform: translateX(-50%); filter: drop-shadow(0 8px 10px rgba(0,0,0,.35)); transition: transform .35s var(--spring); }
.look b { font: 800 1rem/1.05 var(--display); color: #FFFBEF; text-shadow: 0 1px 2px rgba(0,0,0,.35); text-wrap: balance; }
.look[aria-checked="true"] { --tilt: 0deg; background: radial-gradient(130% 90% at 50% 8%, var(--c2) 0%, var(--c3) 52%, var(--c5) 100%) padding-box, var(--rim) border-box; }
.look[aria-checked="true"] img { transform: translateX(-50%) scale(1.08); }
.look:active { transform: rotate(0) scale(.95); }
@media (hover: hover) and (pointer: fine) { .look:hover { --tilt: 0deg; } }
.look.day b { color: #000; text-shadow: none; }
.look.surprise { background: radial-gradient(130% 90% at 50% 8%, #FFF8E6 0%, #F3E3BE 52%, #DCC08A 100%) padding-box, var(--rim-soft) border-box; }
.look.surprise b { color: var(--paper-ink); text-shadow: none; }
.look.surprise .die { position: absolute; top: 9%; left: 50%; height: 52%; aspect-ratio: 1; translate: -50% 0; display: grid; place-items: center; color: #8A5800; }
.look.surprise.rolling .die svg { animation: spin .5s linear infinite; }
.tick { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; border: 2px solid transparent; color: #FFF7E2;
  background: linear-gradient(180deg, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; box-shadow: 0 3px 6px rgba(0,0,0,.35);
  opacity: 0; transform: scale(.4) rotate(-30deg); transition: transform .35s var(--spring), opacity .15s ease; }
[aria-checked="true"] > .tick { opacity: 1; transform: none; }
.choices { display: grid; gap: 12px; }
.choice { position: relative; display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 48px 14px 14px; border-radius: 20px; border: 3px solid transparent; text-align: left; color: var(--paper-ink);
  background: radial-gradient(120% 90% at 30% 0%, var(--paper-hi), var(--paper) 60%, var(--paper-lo)) padding-box, var(--rim-soft) border-box; box-shadow: 0 8px 16px -12px rgba(60,40,10,.5); transition: transform .2s var(--spring); }
.choice img { flex: none; width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 4px 5px rgba(0,0,0,.25)); }
.choice b { display: block; font: 800 1.15rem/1.15 var(--display); } .choice small { display: block; margin-top: 3px; color: var(--paper-ink2); font-size: .92rem; line-height: 1.35; text-wrap: pretty; }
.choice[aria-checked="true"] { background: radial-gradient(120% 90% at 30% 0%, var(--paper-hi), var(--paper) 60%, var(--paper-lo)) padding-box, var(--rim) border-box; transform: translateY(-2px); }
.choice:active { transform: scale(.98); }
.choice .tick { top: 50%; right: 14px; margin-top: -12px; }
.row-art { width: 40px; height: 40px; object-fit: contain; flex: none; filter: drop-shadow(0 3px 4px rgba(60,40,10,.25)); }
.look img { height: 46%; top: 8%; }
/* ── Shelf (Hall of fame, cabinet) ───────────────────────────────── */
.cab { display: grid; gap: 18px; }
.cab-spot { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 18px; min-height: 120px; padding: 0 4px; }
.cab .med { position: relative; display: grid; place-items: center; border-radius: 50%; border: 3px solid transparent;
  background: radial-gradient(circle at 50% 35%, var(--teal-hi), var(--teal-lo)) padding-box, var(--rim) border-box; box-shadow: 0 8px 14px -6px rgba(0,0,0,.55); }
.cab .med img { object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.3)); transition: filter .4s ease, opacity .4s ease; }
.cab .no .med, .cab-spot.no .med { background: var(--fill); border: 2px dashed var(--gline2); box-shadow: none; }
.cab .no .med img, .cab-spot.no .med img { filter: grayscale(1) brightness(.78); opacity: .5; }
.cab-spot .med { width: 108px; height: 108px; } .cab-spot .med img { width: 80px; height: 80px; }
.cab-spot .med.pop { animation: spotPop .62s var(--spring) both; } .cab-spot .slide { animation: spotSlide .38s .06s var(--out-e) both; }
.cab-spot b { display: block; font: 800 1.5rem/1.1 var(--display); letter-spacing: -.015em; color: var(--hl); text-wrap: balance; }
.cab-spot.no b { color: var(--ink); }
.cab-spot p { margin: 5px 0 9px; color: var(--ink); font-size: 1rem; line-height: 1.35; text-wrap: balance; }
.cab-spot .st { font: 600 .95rem/1.3 var(--font); color: var(--ink2); }
.cab-grid { --row: 132px; display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); grid-auto-rows: var(--row); padding: 0 4px;
  background: linear-gradient(180deg, transparent 80px, #FFEDB0 80px, #E6B04A 82px, #A86F1B 85px, rgba(0,0,0,.32) 86px, rgba(0,0,0,0) 98px) 0 0 / 100% var(--row) repeat-y; }
.cab-cell { position: relative; display: grid; grid-template-rows: 80px auto; justify-items: center; padding: 0 3px; color: var(--ink); text-align: center; }
.cab-cell .med { align-self: end; width: 64px; height: 64px; margin-bottom: 2px; transition: translate .4s var(--spring), box-shadow .3s ease; animation: cabIn .48s var(--spring) both; animation-delay: calc(min(var(--k), 24) * 22ms); }
.cab-cell .med img { width: 48px; height: 48px; }
.cab-cell .nm { padding-top: 12px; font: 700 .88rem/1.12 var(--label); letter-spacing: .01em; text-wrap: balance; }
.cab-cell.no .nm { color: var(--ink2); }
.cab-cell .n { position: absolute; right: -6px; top: -4px; min-width: 24px; height: 22px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center;
  font: 700 .78rem/1 var(--num); font-style: normal; color: #0F3247; background: linear-gradient(180deg, #FFEDB0, #E9B44C); box-shadow: 0 2px 4px rgba(0,0,0,.35); }
.cab-cell[aria-pressed="true"] .med { translate: 0 -7px; box-shadow: 0 0 0 3px rgba(255,237,176,.9), 0 16px 18px -8px rgba(0,0,0,.6); }
.cab-cell[aria-pressed="true"] .nm { color: var(--hl); }
.cab-cell:active .med { scale: .94; }
.cab-cell .holder { position: absolute; right: -8px; bottom: -6px; display: flex; }
.cab-cell .holder .peg { box-shadow: 0 2px 4px rgba(0,0,0,.35); } .cab-cell .holder .peg + .peg { margin-left: -12px; }
@media (hover: hover) and (pointer: fine) { .cab-cell:hover .med { translate: 0 -4px; } .cab-cell[aria-pressed="true"]:hover .med { translate: 0 -7px; } }
.sheet .cab { --hl: #8A5800; --fill: rgba(110,74,16,.08); --gline2: rgba(168,111,27,.5); }
.sheet .cab-spot b, .sheet .cab-spot p, .sheet .cab-cell { color: var(--paper-ink); } .sheet .cab-spot .st, .sheet .cab-cell.no .nm { color: var(--paper-ink2); }
.sheet .cab-grid { background: linear-gradient(180deg, transparent 80px, #FFEDB0 80px, #E6B04A 82px, #A86F1B 85px, rgba(110,74,16,.28) 86px, rgba(110,74,16,0) 98px) 0 0 / 100% var(--row) repeat-y; }
@keyframes cabIn { from { opacity: 0; translate: 0 -18px; scale: .8; } }
@keyframes spotPop { from { scale: .55; rotate: -14deg; opacity: .4; } }
@keyframes spotSlide { from { opacity: 0; translate: 10px 0; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0ms !important; transition-duration: .01ms !important; } }
`;
(function () { const el = document.createElement("style"); el.textContent = CSS; document.head.appendChild(el); })();
(function launchLook() {
  const st = loadSettings();
  if (st.surprise) { const others = Object.keys(LOOKS).filter(k => k !== st.look); st.look = others[Math.floor(Math.random() * others.length)]; saveJSON(SETTINGS_KEY, st); }
  applyLook(st.look);
})();


export { App };
export default App;
