(function (global) {
  "use strict";

  const MAX_EXCLUSIONS = 100;
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  function webUrl(value) {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      url.hash = "";
      return url;
    } catch (_) { return null; }
  }
  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
    return (result >>> 0).toString(36);
  }
  function sectionChoices(value) {
    const url = webUrl(value);
    if (!url) return [];
    const parts = url.pathname.split("/").filter(Boolean);
    if (!url.pathname.endsWith("/")) parts.pop();
    return parts.map((_, index) => `${url.origin}/${parts.slice(0, index + 1).join("/")}/`).reverse();
  }
  function normalizeRules(value) {
    const ids = new Set();
    return (Array.isArray(value) ? value : []).slice(0, MAX_EXCLUSIONS).flatMap(rule => {
      if (!rule || typeof rule !== "object" || !["page", "section", "site"].includes(rule.scope)) return [];
      const url = webUrl(rule.url);
      const locator = rule.locator;
      const id = clean(rule.id).slice(0, 100);
      if (!url || !id || ids.has(id) || !locator || typeof locator.selector !== "string" || !locator.selector || locator.selector.length > 1500) return [];
      if (!/^[A-Z][A-Z0-9-]*$/.test(locator.tag || "") || /^(HTML|BODY|HEAD|SCRIPT|STYLE)$/.test(locator.tag)) return [];
      if (locator.stable !== true && !clean(locator.fingerprint)) return [];
      if (rule.scope === "site") { url.pathname = "/"; url.search = ""; }
      if (rule.scope === "section") {
        url.search = "";
        if (url.pathname === "/") return [];
        url.pathname = url.pathname.replace(/\/+$/, "") + "/";
      }
      const source = webUrl(rule.sourceUrl);
      const sourceUrl = source && applies({ ...rule, url: url.href, enabled: true }, source.href) ? source.href : url.href;
      ids.add(id);
      return [{ id, name: clean(rule.name).slice(0, 80) || "Excluded area", scope: rule.scope, url: url.href, sourceUrl, enabled: rule.enabled !== false, skipLinks: rule.skipLinks === true,
        locator: { selector: locator.selector, tag: locator.tag, role: clean(locator.role).slice(0, 80),
          landmark: clean(locator.landmark).slice(0, 100), stable: locator.stable === true,
          elementName: clean(locator.elementName).slice(0, 180),
          fingerprint: clean(locator.fingerprint).slice(0, 100) } }];
    });
  }
  function applies(rule, value) {
    const page = webUrl(value), base = webUrl(rule.url);
    if (!page || !base || !["page", "section", "site"].includes(rule.scope) || page.origin !== base.origin || rule.enabled === false) return false;
    if (rule.scope === "site") return true;
    if (rule.scope === "page") return page.href === base.href;
    const path = base.pathname.replace(/\/+$/, "");
    return page.pathname === path || page.pathname.startsWith(path + "/");
  }
  function applicableRules(rules, url) { return normalizeRules(rules).filter(rule => applies(rule, url)); }
  function revision(rules, url) {
    const normalized = url ? applicableRules(rules, url) : normalizeRules(rules);
    return normalized.length ? hash(JSON.stringify(normalized.slice().sort((a, b) => a.id.localeCompare(b.id)))) : "";
  }
  function scopeLabel(rule) {
    return rule.scope === "page" ? `Page: ${rule.url}` : rule.scope === "site" ? `Website: ${rule.url}` : `Section: ${rule.url}`;
  }
  function sameArea(first, second) {
    return first && second && first.selector === second.selector && first.tag === second.tag &&
      first.role === second.role && first.landmark === second.landmark &&
      (first.stable && second.stable || first.fingerprint === second.fingerprint);
  }
  function coversScope(existing, candidate) {
    const base = webUrl(existing.url), page = webUrl(candidate.url);
    if (!base || !page || base.origin !== page.origin) return false;
    if (existing.scope === "site") return true;
    if (candidate.scope === "site") return false;
    if (candidate.scope === "page") return applies({ ...existing, enabled: true }, candidate.url);
    return existing.scope === "section" && applies({ ...existing, enabled: true }, candidate.url);
  }
  function findDuplicate(rules, candidate, matchingIds = []) {
    return normalizeRules(rules).find(rule => rule.id !== candidate.id && coversScope(rule, candidate) &&
      (sameArea(rule.locator, candidate.locator) || matchingIds.includes(rule.id))) || null;
  }
  function landmark(element) {
    const area = element.closest("main,nav,aside,header,footer,[role='main'],[role='navigation'],[role='complementary'],[role='banner'],[role='contentinfo']");
    return area ? `${area.tagName}:${area.getAttribute("role") || ""}` : "";
  }
  function fingerprint(element) {
    return hash(`${element.tagName}|${clean(element.textContent)}|${element.getAttribute("href") || ""}|${element.getAttribute("src") || ""}|${Array.from(element.children).map(child => child.tagName).join(",")}`);
  }
  function stableToken(value) {
    return /^[a-zA-Z_][\w-]{1,79}$/.test(value) && !/(?:\d{5,}|[a-f0-9]{10,}|^css-|^ember\d|^react-|^:r)/i.test(value);
  }
  function elementName(element) {
    if (element.id) return `${element.tagName.toLowerCase()}#${element.id}`;
    const role = element.getAttribute("role");
    const label = element.getAttribute("aria-label") || element.getAttribute("name");
    return `${element.tagName.toLowerCase()}${role ? ` [${role}]` : ""}${label ? ` — ${clean(label).slice(0, 80)}` : ""}`;
  }
  function describe(element) {
    const doc = element.ownerDocument;
    const escape = value => global.CSS.escape(value);
    let selector = "", stable = false;
    const unique = value => { try { const matches = doc.querySelectorAll(value); return matches.length === 1 && matches[0] === element; } catch (_) { return false; } };
    if (element.id && stableToken(element.id) && unique("#" + escape(element.id))) { selector = "#" + escape(element.id); stable = true; }
    if (!selector) {
      const classes = Array.from(element.classList).filter(value => stableToken(value) && /nav|sidebar|header|footer|banner|menu|widget|cookie|notice|alert|breadcrumb/i.test(value)).slice(0, 4);
      for (let length = 1; length <= classes.length; length += 1) {
        const candidate = element.tagName.toLowerCase() + classes.slice(0, length).map(value => "." + escape(value)).join("");
        if (unique(candidate)) { selector = candidate; stable = true; break; }
      }
    }
    if (!selector && /^(MAIN|NAV|ASIDE|HEADER|FOOTER)$/.test(element.tagName) && unique(element.tagName.toLowerCase())) {
      selector = element.tagName.toLowerCase(); stable = true;
    }
    if (!selector) {
      const parts = [];
      for (let current = element; current && current.nodeType === 1; current = current.parentElement) {
        const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(item => item.tagName === current.tagName) : [current];
        parts.unshift(current.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ""));
      }
      selector = parts.join(" > ");
    }
    const labelled = clean(element.getAttribute("aria-label"));
    const heading = element.matches("h1,h2,h3,h4,h5,h6") ? element : element.querySelector("h1,h2,h3,h4,h5,h6,legend,summary");
    const kind = ({ NAV: "Navigation", ASIDE: "Sidebar", HEADER: "Header", FOOTER: "Footer", IMG: "Image", TABLE: "Table", UL: "List", OL: "List", P: "Paragraph", SECTION: "Section", ARTICLE: "Article" })[element.tagName] || "Area";
    const title = labelled || clean(heading && heading.textContent) || clean(element.textContent);
    return { name: (title ? `${kind}: ${title.slice(0, 55)}` : kind), elementName: elementName(element), locator: { selector, tag: element.tagName, elementName: elementName(element),
      role: element.getAttribute("role") || "", landmark: landmark(element), stable, fingerprint: stable ? "" : fingerprint(element) } };
  }
  function match(doc, rule) {
    let matches;
    try { matches = Array.from(doc.querySelectorAll(rule.locator.selector)); } catch (_) { return { status: "changed", elements: [] }; }
    if (!matches.length) return { status: "missing", elements: [] };
    if (matches.length !== 1) return { status: "ambiguous", elements: [] };
    const element = matches[0], locator = rule.locator;
    if (element === doc.body || element === doc.documentElement || element.tagName !== locator.tag ||
        (element.getAttribute("role") || "") !== locator.role || landmark(element) !== locator.landmark ||
        (!locator.stable && fingerprint(element) !== locator.fingerprint)) return { status: "changed", elements: [] };
    return { status: "applied", elements: [element] };
  }
  function matchingAreaIds(doc, rules, locator, url) {
    const selected = match(doc, { locator }).elements[0];
    if (!selected) return [];
    return normalizeRules(rules).filter(rule => applies({ ...rule, enabled: true }, url) && match(doc, rule).elements[0] === selected).map(rule => rule.id);
  }
  function createContext(doc, suppliedRules, url) {
    const rules = applicableRules(suppliedRules, url);
    const roots = [], skippedLinkRoots = [];
    const results = rules.map(rule => {
      const result = match(doc, rule);
      roots.push(...result.elements);
      if (rule.skipLinks) skippedLinkRoots.push(...result.elements);
      return { id: rule.id, name: rule.name, scope: scopeLabel(rule), skipLinks: rule.skipLinks, status: result.status, matchedCount: result.elements.length };
    });
    const excluded = element => Boolean(element && roots.some(root => root === element || root.contains(element)));
    const textCache = new WeakMap();
    function text(element, skipLists = false) {
      if (!element) return "";
      if (!roots.length && !skipLists) return element.textContent || "";
      // Excluded elements can still supply factual context, such as anchor names.
      if (excluded(element)) return element.textContent || "";
      if (!skipLists && textCache.has(element)) return textCache.get(element);
      let output = "";
      function visit(node) {
        if (node.nodeType === 3) { output += node.nodeValue || ""; return; }
        if (node.nodeType !== 1 && node !== element) return;
        if (node !== element && (excluded(node) || (skipLists && /^(UL|OL)$/.test(node.tagName)))) { output += "\n"; return; }
        for (const child of node.childNodes) visit(child);
      }
      visit(element);
      if (!skipLists) textCache.set(element, output);
      return output;
    }
    const linkExcluded = element => skippedLinkRoots.some(root => root === element || root.contains(element));
    return { rules, roots, results, excluded, linkExcluded, text, revision: revision(rules),
      setScope(root, includes) {
        results.forEach((result, index) => {
          if (result.status !== "applied") return;
          const matching = match(doc, rules[index]).elements[0];
          if (matching && !(matching === root || matching.contains(root) || root.contains(matching)) ||
              matching && !matching.contains(root) && !includes(matching) && !Array.from(matching.querySelectorAll("*")).some(includes)) result.status = "outside-scope";
        });
      } };
  }
  function coverage(report) {
    if (report && report.settings && report.settings.includeExcludedAreas) return "Saved excluded areas included in this scan";
    const results = report && report.settings && report.settings.exclusions || [];
    if (!results.length) return "None";
    const labels = { applied: "Excluded", missing: "Area not found; content reviewed", ambiguous: "Multiple matches; content reviewed", changed: "Area changed; content reviewed", "outside-scope": "Already outside review scope" };
    // Reports from the first experiment excluded links and have no skipLinks field.
    return results.map(result => `${result.name}: ${labels[result.status] || "Not applied"}${result.status === "applied" ? result.skipLinks !== false ? "; link checks skipped" : "; links included" : ""} (${result.scope})`).join("; ");
  }
  const api = { MAX_EXCLUSIONS, webUrl, sectionChoices, normalizeRules, applies, applicableRules, revision, scopeLabel, sameArea, findDuplicate, describe, match, matchingAreaIds, createContext, coverage };
  global.BCReviewExclusions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
