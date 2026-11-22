"""Real-tap walk in Safari's engine at an iPhone's Safari size (390 x 664).

Every press is a mouse tap at the point the browser says is on top, never a
script .click(), so a control that is covered or has taps switched off fails.

    npm run dev                      # in one terminal (port 8743)
    python3 tests/e2e/tap.py         # or: tests/e2e/tap.py http://localhost:4173

Writes full-size screenshots to tests/e2e/shots/ (ignored by git).
Exits non-zero if anything fails.
"""
import os, re, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8743/"
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
fails, errors = [], []

def fail(msg):
    print("  FAIL " + msg); fails.append(msg)

def shot(p, name):
    os.makedirs(SHOTS, exist_ok=True); p.screenshot(path=os.path.join(SHOTS, name + ".png"))

def tap(p, loc, what):
    """Scroll into view, ask what is on top at the control's centre, tap there."""
    loc = loc.first
    loc.scroll_into_view_if_needed(timeout=3000)
    b = loc.bounding_box()
    if not b: return fail(what + ": not visible")
    x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    ok = p.evaluate("([x, y, el]) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); }", [x, y, loc.element_handle()])
    if not ok:   # maybe only scrolled under a floating bar: bring it to the middle and look again
        loc.evaluate("el => el.scrollIntoView({ block: 'center' })"); p.wait_for_timeout(150)
        b = loc.bounding_box(); x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        ok = p.evaluate("([x, y, el]) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); }", [x, y, loc.element_handle()])
    if not ok: return fail(what + ": COVERED at its centre")
    p.mouse.click(x, y); p.wait_for_timeout(350)
    return True

def covered_controls(p, where):
    """Every visible button/link/switch in the viewport must be the top layer at its centre."""
    bad = p.evaluate("""() => [...document.querySelectorAll('button, a[href], [role=switch], [role=tab], input')].filter(el => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return false;
        if (getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden=true], [inert]')) return false;
        const t = document.elementFromPoint(x, y);
        if (t && t.closest('.tabbar, .ph-dock') && !el.closest('.tabbar, .ph-dock')) return false;   // scrolled under a floating bar; fits() covers screens that must not scroll
        return !(t && (t === el || el.contains(t) || t.contains(el)));
      }).map(el => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 40))""")
    for b in bad: fail(where + ": control under something else: " + repr(b))

def fits(p, where):
    over = p.evaluate("document.scrollingElement.scrollHeight - innerHeight")
    if over > 2:
        who = p.evaluate("""() => { let best = null, b = 0; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.bottom > b + 1 && r.height) { b = r.bottom; best = el; } }
          return best ? best.tagName.toLowerCase() + '.' + String(best.className).split(' ').join('.') + ' bottom ' + Math.round(b) : ''; }""")
        fail(where + ": " + str(over) + "px taller than the screen (lowest: " + who + ")")


NAMES = ["Ana", "Ben", "Cy", "Di", "Eve", "Fin", "Gus", "Hal"]

def fresh(br):
    ctx = br.new_context(viewport={"width": 390, "height": 664}, device_scale_factor=2)
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    p.add_init_script("sessionStorage.setItem('mayi:intro', '1')")
    p.goto(URL); p.wait_for_timeout(1200)
    return ctx, p

def dock(p):
    return p.locator(".ph-dock button:visible:not(.tab)").first

def game(br, n, full):
    print("round for %d" % n)
    ctx, p = fresh(br)
    box = p.get_by_role("textbox", name="Add a player's name")
    tap(p, box, "name box")                     # one tap; Enter keeps the field focused, as on a phone
    for name in NAMES[:n]:
        p.keyboard.type(name); p.keyboard.press("Enter"); p.wait_for_timeout(120)
    p.keyboard.press("Escape")
    tap(p, dock(p), "deal button"); p.wait_for_timeout(900)
    for label in ["I know the game", "Let's play", "Skip"]:
        b = p.get_by_role("button", name=label)
        if b.count() and b.first.is_visible(): tap(p, b, label); p.wait_for_timeout(700)
    shot(p, "05-round-%d" % n)
    if not p.locator(".kround").count(): fail("round %d: did not reach the round screen" % n); ctx.close(); return
    fits(p, "round with %d" % n); covered_controls(p, "round with %d" % n)
    if not full: ctx.close(); return

    if n == 4:
     print("  buy and undo")
     face = p.locator(".lr-buys .lr-b").nth(1)
     before = face.get_attribute("aria-label") or ""
     tap(p, face, "buy on " + NAMES[1]); p.wait_for_timeout(300)
     after = face.get_attribute("aria-label") or ""
     if after == before: fail("buy: face label did not change after a tap (" + before + ")")
     shot(p, "06-after-buy"); fits(p, "after a buy")
     toast = p.locator(".lr-toast")
     if not toast.count(): fail("buy: no toast with undo")
     else:
         tap(p, toast, "undo toast"); p.wait_for_timeout(300)
         if (face.get_attribute("aria-label") or "") != before: fail("undo: buy was not taken back")

    print("  score the round")
    tap(p, dock(p), "score button"); p.wait_for_timeout(700); shot(p, "07-score-pad")
    outs = p.locator(".ls-out")
    if not outs.count(): fail("score pad: no Out buttons"); ctx.close(); return
    tap(p, outs.first, "Out for " + NAMES[0])
    for i, v in enumerate([str(5 + 10 * j) for j in range(n - 1)]):
        inp = p.locator(".ls-in").nth(i + 1)
        tap(p, inp, "score box"); p.keyboard.type(v); p.keyboard.press("Enter")
    p.wait_for_timeout(300); shot(p, "08-scores-in")
    btns = [b.inner_text().strip() for b in p.locator("button:visible").all() if b.inner_text().strip()]
    save = p.get_by_role("button", name=re.compile("^(Save|Done|Next round|Finish round)", re.I))
    if not save.count(): fail("score pad: no save button among " + repr(btns[-6:])); ctx.close(); return
    tap(p, save, "save scores"); p.wait_for_timeout(1200); shot(p, "09-after-save")
    nxt = p.get_by_role("button", name=re.compile("Start round 2|Let's play", re.I))
    if nxt.count(): tap(p, nxt, "start round 2"); p.wait_for_timeout(1200)
    shot(p, "10-round-2-%d" % n)
    if not p.get_by_text("Round 2 of 7").count(): fail("did not reach round 2")
    else: fits(p, "round 2 with %d" % n)
    ctx.close()

def returning(br):
    print("returning player (two tables)")
    ctx = br.new_context(viewport={"width": 390, "height": 664}, device_scale_factor=2)
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    seed = open(os.path.join(HERE, "seed.js")).read()
    p.add_init_script(seed + "\nsessionStorage.setItem('mayi:intro','1'); if (!sessionStorage.getItem('seeded')) { __mayiSeed({}); sessionStorage.setItem('seeded','1'); }")
    p.goto(URL); p.wait_for_timeout(1300); shot(p, "11-play-returning")
    covered_controls(p, "play (returning)")
    first = p.locator(".lc-tables .lc-tcard").first
    if "Family" not in first.inner_text(): fail("play: the first table card is not Family: " + repr(first.inner_text()[:40]))
    pill = p.get_by_role("button", name="New game at Family")
    if not pill.count(): fail("play: no New game pill on Family")
    elif tap(p, pill, "New game at Family"):
        p.wait_for_timeout(600); shot(p, "12-new-game-family")
        if not p.get_by_text("Family").count(): fail("new game sheet: Family not shown")
        p.keyboard.press("Escape"); p.wait_for_timeout(500)
    if p.get_by_role("button", name="New game at Friday night").count() != 1: fail("play: expected exactly one 'New game at Friday night' (the dock)")
    tap(p, p.locator(".lc-tcard .blk").nth(1), "Friday night card"); p.wait_for_timeout(700); shot(p, "13-table-friday")
    if p.locator(".khome").count(): fail("table card: tap did not open the table")
    # Looks belong to tables: Friday night wears Cherry on its page, a tap in its settings changes it, and Play stays on the lagoon.
    look = lambda: p.evaluate("document.documentElement.dataset.look")
    if look() != "parlour": fail("table page: Friday night should wear Cherry, got " + repr(look()))
    if tap(p, p.get_by_role("button", name="Table settings"), "table settings"):
        p.wait_for_timeout(500)
        if tap(p, p.get_by_role("radio", name="Lime"), "Lime look"):
            if look() != "lime": fail("table settings: tapping Lime did not change the look, got " + repr(look()))
            if p.get_by_role("radio", name="Lime").get_attribute("aria-checked") != "true": fail("table settings: Lime not marked as chosen")
            shot(p, "13b-table-look")
        p.keyboard.press("Escape"); p.wait_for_timeout(400)
    # Results: the awards have their own section, and the rows above never repeat an award's name.
    p.goto(URL); p.wait_for_timeout(1300)
    if look() != "midnight": fail("play: should be Lagoon, got " + repr(look()))
    if "jade" not in (p.locator(".lc-tcard .blk").nth(1).get_attribute("class") or ""): fail("play: Friday night's card does not wear Lime")
    if tap(p, p.locator(".lc-moment"), "last game"):
        p.wait_for_timeout(900); shot(p, "14-results")
        if not p.locator(".lb-aws li").count(): fail("results: no awards section")
        titles = p.locator(".lb-awt").all_inner_texts(); rows = " ".join(p.locator(".ldr").all_inner_texts() + p.locator(".finale").all_inner_texts())
        for t in titles:
            if t in rows: fail("results: award " + repr(t) + " also named in the standings")
        covered_controls(p, "results")
        if look() != "lime": fail("results: Friday night's game should wear its table's look, got " + repr(look()))
    ctx.close()

with sync_playwright() as pw:
    br = pw.webkit.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 664}, device_scale_factor=2, has_touch=False)
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    p.add_init_script("sessionStorage.setItem('mayi:intro', '1')")   # skip the opening
    p.goto(URL); p.wait_for_timeout(1200)
    tabs = ["Learn", "Stats", "Settings", "Play"]

    print("start screen")
    covered_controls(p, "start"); shot(p, "01-start")
    for t in tabs:
        if tap(p, p.get_by_role("button", name=t, exact=True), "tab " + t):
            on = p.evaluate("[...document.querySelectorAll('.tabbar .tab')].find(b => b.getAttribute('aria-current') || b.classList.contains('on'))?.textContent?.trim() || ''")
            if t.lower() not in on.lower(): fail("tab " + t + ": tapped but the bar shows " + repr(on))
            covered_controls(p, t); shot(p, "02-tab-" + t.lower())

    print("house rules")
    if tap(p, p.get_by_text("House rules", exact=True), "House rules row"):
        p.wait_for_timeout(400); shot(p, "03-house-rules")
        sw = p.locator("[role=switch]")
        if not sw.count(): fail("house rules: no switches")
        else:
            before = sw.first.get_attribute("aria-checked")
            tap(p, sw.first, "first switch")
            if sw.first.get_attribute("aria-checked") == before: fail("house rules: switch did not change on a tap")
            tap(p, sw.first, "first switch back")
        p.keyboard.press("Escape"); p.wait_for_timeout(400)
        closer = p.get_by_role("button", name=re.compile("^(Done|Close)$"))
        if closer.count() and closer.first.is_visible(): tap(p, closer, "close house rules")

    br_ctx = (br, ctx)
    returning(br)
    for n in (4, 2, 8):
        game(br, n, full=(n != 2))

    print("errors")
    for e in errors: fail("page error: " + e[:160])
    br.close()

print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
