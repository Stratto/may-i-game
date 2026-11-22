// Loads the real app module (src/ClaudeApp.jsx) and returns its pure functions,
// so the tests check the code that ships rather than a copy of it.
// The browser is stubbed: React renders nothing and nothing touches the DOM.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXPORTS = [
  "ROUNDS", "DEFAULT_RULES", "GUIDE", "TURN_STEPS", "MAYI_STEPS", "RULE_WHY",
  "ruleHint", "rankPart", "cardValue", "buyLimitOf", "rulesLine", "contractLine",
  "roundDone", "totalsOf", "rankOf", "dealerIdx", "plOf", "namesOf",
  "gameAwards", "tableMoments", "AWARDS", "LIFE", "lifeAchievements", "chaseNotes", "caughtStats", "playerProfile", "groupRecords", "rankMoves",
  "mergeGame", "applyDoc", "AV_CARDS", "AV_FACES", "avSeed", "avOf", "avKept", "heldFaces", "dealFaces", "cardOfAv", "cardAvSrc", "faceProps", "avatarSrc", "addToGame", "dropFromGame",
];

// Anything the app pokes at load time (document, matchMedia, style setters)
// resolves to a callable that returns itself.
function anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (t, k) => k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : proxy,
    set: () => true,
    apply: () => proxy,
    construct: () => proxy,
  });
  return proxy;
}

function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "ClaudeApp.jsx"), "utf8");
  // Drop the module lines; React and ReactDOM are supplied as globals below.
  const code = src.split("\n").filter(l => !/^(import |export )/.test(l)).join("\n")
    + "\nglobalThis.__mayi = { " + EXPORTS.join(", ") + " };";

  const memory = {};
  const React = { createElement: () => null, Fragment: "f", useState: v => [typeof v === "function" ? v() : v, () => {}],
    useEffect: () => {}, useRef: v => ({ current: v }), useMemo: f => f(), useCallback: f => f };
  const window = {
    React, ReactDOM: { createRoot: () => ({ render() {} }) },
    localStorage: { getItem: k => (k in memory ? memory[k] : null), setItem: (k, v) => { memory[k] = String(v); }, removeItem: k => { delete memory[k]; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    navigator: { onLine: true }, document: anything(), location: { hash: "", search: "", href: "http://localhost/" },
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, getComputedStyle: anything(),
    console, Date, Math, JSON, Promise, Intl, URL, URLSearchParams,
  };
  window.window = window; window.globalThis = window; window.self = window;
  const ctx = vm.createContext(window);
  vm.runInContext(code, ctx, { filename: "src/ClaudeApp.jsx" });
  const out = window.__mayi;
  if (!out) throw new Error("App script ran but exported nothing");
  for (const k of EXPORTS) if (out[k] === undefined) throw new Error("Missing export: " + k);
  // Values made inside the VM have its own Object prototype, which trips
  // deepStrictEqual. Copy everything back into this realm.
  const api = {};
  for (const k of EXPORTS) {
    const v = out[k];
    api[k] = typeof v === "function" ? (...a) => { const r = v(...a); return typeof r === "function" ? (...b) => structuredClone(r(...b)) : structuredClone(r); } : structuredClone(v);
  }
  return api;
}

module.exports = load();
