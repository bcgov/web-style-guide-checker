(function (global) {
  "use strict";
  async function pick(options = {}) {
    if (global.__bcExclusionPickerCancel) global.__bcExclusionPickerCancel();
    const doc = document, originalFocus = doc.activeElement, pageUrl = location.href;
    const fonts = [];
    if (options.fonts) {
      try {
        for (const [weight, bytes] of Object.entries(options.fonts)) {
          const font = new FontFace("BC Sans Checker", new Uint8Array(bytes).buffer, { weight });
          await font.load();
          doc.fonts.add(font);
          fonts.push(font);
        }
      } catch (error) { fonts.forEach(font => doc.fonts.delete(font)); throw new Error("BC Sans could not be loaded. Reload the checker and try again."); }
    }
    const host = doc.createElement("div");
    host.setAttribute("data-bc-wsg-exclusion-ui", "true");
    host.style.cssText = "all:initial!important;font:15px/1.5 'BC Sans Checker','BC Sans',Arial,sans-serif!important;color:#252525!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      *{box-sizing:border-box;font-family:inherit}button{font-family:inherit}
      .box{position:fixed;border:3px solid #fcba19;background:rgba(0,51,102,.08);pointer-events:none}
      .tools{position:fixed;top:12px;right:12px;width:min(350px,calc(100vw - 24px));background:white;border:2px solid #003366;border-radius:6px;padding:14px;box-shadow:0 3px 16px #0004;pointer-events:auto;max-height:calc(100vh - 24px);overflow:auto}
      .top{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:17px;margin:0;color:#003366}p{margin:8px 0}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .move{touch-action:none;cursor:move;padding:4px 8px;font-size:13px}.selection{padding:8px;background:#f4f4f4;border-radius:3px;overflow-wrap:anywhere}.identity{font-size:14px;font-weight:700;display:block}.preview,.help{font-size:13px;color:#555}.preview{display:block;margin-top:4px}.help{margin-top:10px}.selection:focus-visible{outline:3px solid #1a5a96;outline-offset:2px}
      button{font:inherit;padding:7px 10px;border:1px solid #606060;border-radius:4px;background:#fff;color:#003366;cursor:pointer}
      button:focus-visible{outline:3px solid #1a5a96;outline-offset:3px}button:disabled{opacity:.55;cursor:default}.primary{background:#003366;color:white;border-color:#003366}
    </style><div class="box" hidden></div><section class="tools" aria-label="Choose an area to exclude">
      <div class="top"><h2>Choose an area to exclude</h2><button type="button" class="move" title="Drag to move. Click to switch corners." aria-label="Move controls. Click to change corner, drag, or use arrow keys.">Move</button></div><p>Point to an area and click to select it.</p>
      <div class="selection" tabindex="0" role="group" aria-label="Selected area. Use Up and Down to browse areas, Left for a larger area, Right for a smaller area, and Enter to select."><span class="identity" role="status" aria-live="polite">No area selected</span><span class="preview"></span></div>
      <div class="actions"><button type="button" class="larger" disabled>Select a larger area</button><button type="button" class="smaller" disabled>Select a smaller area</button></div>
      <div class="actions"><button type="button" class="reselect" hidden>Reselect area</button><button type="button" class="use primary" disabled>Use selected area</button><button type="button" class="cancel">Cancel</button></div>
      <p class="help">Keyboard: focus the selected area above and use the arrow keys. Page controls are paused while choosing.</p>
    </section>`;
    (doc.documentElement || doc.body).append(host);
    const box = shadow.querySelector(".box"), selection = shadow.querySelector(".selection"), status = shadow.querySelector(".identity"), tools = shadow.querySelector(".tools"), mover = shadow.querySelector(".move");
    let current = null, frozen = false, smaller = [], finished = false, frame = 0, resolve, drag = null, moved = false, corner = 0;
    const promise = new Promise(done => { resolve = done; });
    const visible = element => {
      if (!element || element.nodeType !== 1 || element === host || host.contains(element) || /^(HTML|BODY|HEAD|SCRIPT|STYLE|META|LINK|BR|HR)$/.test(element.tagName)) return false;
      const control = element.closest("a,button,input,select,textarea");
      if (control && control !== element) return false;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    function parent(element) { const candidate = element && element.parentElement; return visible(candidate) ? candidate : null; }
    function draw() {
      frame = 0;
      if (!current || !current.isConnected) { box.hidden = true; return; }
      const rect = current.getBoundingClientRect();
      box.hidden = false;
      box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    }
    function select(element, announce = true) {
      if (!visible(element)) return;
      current = element;
      draw();
      shadow.querySelector(".use").disabled = false;
      shadow.querySelector(".reselect").hidden = !frozen;
      shadow.querySelector(".larger").disabled = !parent(current);
      shadow.querySelector(".smaller").disabled = !smaller.length && !Array.from(current.children).some(visible);
      const description = global.BCReviewExclusions.describe(current);
      const below = current.getBoundingClientRect().bottom > innerHeight ? " Continues below the screen." : "";
      // Hover previews update without repeatedly announcing every mouse movement.
      status.setAttribute("aria-live", announce ? "polite" : "off");
      status.textContent = description.elementName;
      shadow.querySelector(".preview").textContent = description.name + below;
      const controls = tools.getBoundingClientRect();
      position(controls.left, controls.top);
    }
    function finish(result) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      doc.removeEventListener("pointermove", move, true);
      doc.removeEventListener("click", click, true);
      doc.removeEventListener("pointerdown", block, true);
      doc.removeEventListener("keydown", keys, true);
      global.removeEventListener("scroll", redraw, true);
      global.removeEventListener("resize", redraw);
      global.removeEventListener("pagehide", cancel);
      host.remove();
      fonts.forEach(font => doc.fonts.delete(font));
      delete global.__bcExclusionPickerCancel;
      if (originalFocus && originalFocus.isConnected && originalFocus.focus) originalFocus.focus({ preventScroll: true });
      resolve(result);
    }
    const inTools = event => event.composedPath().includes(host);
    function targetFor(event) {
      let element = event.target;
      if (element && element.ownerSVGElement) element = element.ownerSVGElement.parentElement;
      else if (element && element.tagName === "svg") element = element.parentElement;
      if (element && element.closest) element = element.closest("a,button,input,select,textarea") || element;
      if (!element || element.nodeType !== 1 || element.ownerDocument !== doc) return null;
      // Start at the nearest meaningful group, without jumping to an entire main/body.
      // A generic wrapper must contain several content blocks to count as an area.
      let candidate = element;
      while (candidate && !/^(MAIN|BODY|HTML)$/.test(candidate.tagName)) {
        const semantic = candidate.matches("nav,aside,header,footer,section,article,ul,ol,table,[role='navigation'],[role='complementary'],[role='region'],[role='banner'],[role='contentinfo']");
        const group = candidate.tagName === "DIV" && Array.from(candidate.children).filter(child => visible(child) && child.matches("div,p,h1,h2,h3,h4,h5,h6,ul,ol,nav,aside,section,article,table,form")).length > 1;
        if (visible(candidate) && (semantic || group)) return { element: candidate, pointed: element };
        candidate = candidate.parentElement;
      }
      return { element, pointed: element };
    }
    function block(event) { if (!inTools(event)) { event.preventDefault(); event.stopImmediatePropagation(); } }
    function move(event) {
      if (frozen || inTools(event)) return;
      const target = targetFor(event);
      if (target && visible(target.element)) { smaller = target.pointed !== target.element ? [target.pointed] : []; select(target.element, false); }
    }
    function click(event) {
      if (inTools(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const target = targetFor(event);
      if (target && visible(target.element)) { smaller = target.pointed !== target.element ? [target.pointed] : []; frozen = true; select(target.element); shadow.querySelector(".use").focus(); }
    }
    function keys(event) {
      if (event.key === "Tab") {
        const buttons = Array.from(shadow.querySelectorAll(".tools [tabindex='0'],.tools button:not(:disabled):not([hidden])"));
        const index = buttons.indexOf(shadow.activeElement);
        if (index < 0 || (!event.shiftKey && index === buttons.length - 1) || (event.shiftKey && index === 0)) {
          event.preventDefault();
          buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
        }
      }
      if (shadow.activeElement === selection && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (["Enter", " "].includes(event.key)) { if (current) { frozen = true; select(current); shadow.querySelector(".use").focus(); } return; }
        const candidates = Array.from(doc.querySelectorAll("main,nav,aside,header,footer,section,article,div[id],h1,h2,h3,h4,h5,h6,p,ul,ol,table,a,button,input,select,textarea,img")).filter(visible);
        const index = candidates.indexOf(current);
        const next = event.key === "ArrowLeft" ? parent(current) : event.key === "ArrowRight" ? current && Array.from(current.children).find(visible) : candidates[(index + (event.key === "ArrowUp" ? -1 : 1) + candidates.length) % candidates.length];
        if (next) { frozen = true; smaller = []; select(next); next.scrollIntoView({ block: "nearest" }); }
        return;
      }
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(null); }
      else if (!inTools(event) && ["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    function position(left, top) {
      const rect = tools.getBoundingClientRect();
      tools.style.right = "auto"; tools.style.bottom = "auto";
      tools.style.left = Math.max(8, Math.min(innerWidth - rect.width - 8, left)) + "px";
      tools.style.top = Math.max(8, Math.min(innerHeight - rect.height - 8, top)) + "px";
    }
    function redraw() { if (!frame) frame = requestAnimationFrame(draw); const rect = tools.getBoundingClientRect(); position(rect.left, rect.top); }
    function cancel() { finish(null); }
    shadow.querySelector(".cancel").addEventListener("click", cancel);
    shadow.querySelector(".reselect").addEventListener("click", () => {
      frozen = false; current = null; smaller = []; box.hidden = true;
      status.textContent = "Choose another area"; shadow.querySelector(".preview").textContent = "Point to an area and click, or use the arrow keys here.";
      shadow.querySelector(".use").disabled = true; shadow.querySelector(".larger").disabled = true; shadow.querySelector(".smaller").disabled = true; shadow.querySelector(".reselect").hidden = true; selection.focus();
    });
    mover.addEventListener("pointerdown", event => { if (event.button !== 0) return; const rect = tools.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }; moved = false; mover.setPointerCapture(event.pointerId); event.preventDefault(); });
    mover.addEventListener("pointermove", event => { if (!drag) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; position(drag.left + dx, drag.top + dy); });
    mover.addEventListener("pointerup", () => { drag = null; });
    mover.addEventListener("pointercancel", () => { drag = null; });
    mover.addEventListener("click", () => { if (moved) { moved = false; return; } corner = (corner + 1) % 4; const rect = tools.getBoundingClientRect(); position(corner === 1 || corner === 2 ? 12 : innerWidth - rect.width - 12, corner >= 2 ? innerHeight - rect.height - 12 : 12); });
    mover.addEventListener("keydown", event => { if (!event.key.startsWith("Arrow")) return; event.preventDefault(); event.stopPropagation(); const rect = tools.getBoundingClientRect(), step = event.shiftKey ? 48 : 16; position(rect.left + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), rect.top + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)); });
    shadow.querySelector(".larger").addEventListener("click", () => { const next = parent(current); if (next) { smaller.push(current); frozen = true; select(next); } });
    shadow.querySelector(".smaller").addEventListener("click", () => { const next = smaller.pop() || Array.from(current.children).find(visible); if (next) { frozen = true; select(next); } });
    shadow.querySelector(".use").addEventListener("click", () => {
      if (!current || !current.isConnected || location.href !== pageUrl) { finish(null); return; }
      finish({ ...global.BCReviewExclusions.describe(current), pageUrl });
    });
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("click", click, true);
    doc.addEventListener("pointerdown", block, true);
    doc.addEventListener("keydown", keys, true);
    global.addEventListener("scroll", redraw, true);
    global.addEventListener("resize", redraw);
    global.addEventListener("pagehide", cancel);
    global.__bcExclusionPickerCancel = cancel;
    selection.focus();
    return promise;
  }
  global.BCExclusionPicker = { pick };
})(globalThis);
