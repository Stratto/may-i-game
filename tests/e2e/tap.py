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

    print("deal a game for four")
    box = p.get_by_role("textbox", name="Add a player's name")
    for n in ["Ana", "Ben", "Cy", "Di"]:
        tap(p, box, "name box"); p.keyboard.type(n); p.keyboard.press("Enter"); p.wait_for_timeout(150)
    p.keyboard.press("Escape"); shot(p, "04-names")
    deal = p.locator(".ph-dock button").first
    print("  main button: " + repr(deal.inner_text().strip()))
    tap(p, deal, "main button")
    p.wait_for_timeout(900)
    for label in ["I know the game", "Let's play", "Skip"]:          # coaching question / intro card, if shown
        b = p.get_by_role("button", name=label)
        if b.count() and b.first.is_visible(): tap(p, b, label); p.wait_for_timeout(700)
    shot(p, "05-round")
    if not p.locator(".kround, .kscore").count(): fail("round: did not reach the round screen")
    fits(p, "round with 4"); covered_controls(p, "round")

    print("errors")
    for e in errors: fail("page error: " + e[:160])
    br.close()

print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
