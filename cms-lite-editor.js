(function (global) {
  "use strict";

  function normalizeSpace(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function directChild(container, predicate) {
    if (!container) return null;
    return Array.from(container.children || []).find(predicate) || null;
  }

  function sourceTextareaForFrame(frame, fallbackIndex = -1) {
    if (!frame || !frame.ownerDocument) return null;
    const doc = frame.ownerDocument;
    const editorContainer = frame.closest(".cke") || frame.closest(".cke_chrome") || frame.closest("[id^='cke_']");

    if (editorContainer && /^cke_/.test(editorContainer.id || "")) {
      const sourceId = editorContainer.id.slice(4);
      const byId = doc.getElementById(sourceId);
      if (byId && byId.matches("textarea.wysiwygInput,textarea[data-field-name]")) return byId;
    }

    let sibling = editorContainer ? editorContainer.previousElementSibling : null;
    while (sibling) {
      if (sibling.matches && sibling.matches("textarea.wysiwygInput,textarea[data-field-name]")) return sibling;
      if (sibling.querySelector) {
        const nested = sibling.querySelector("textarea.wysiwygInput,textarea[data-field-name]");
        if (nested) return nested;
      }
      sibling = sibling.previousElementSibling;
    }

    if (fallbackIndex >= 0) {
      return Array.from(doc.querySelectorAll("textarea.wysiwygInput,textarea[data-field-name]"))[fallbackIndex] || null;
    }
    return null;
  }

  function tabNameFor(tabPane) {
    if (!tabPane) return "";
    const doc = tabPane.ownerDocument;
    const tabId = tabPane.id || "";
    if (tabId) {
      const link = Array.from(doc.querySelectorAll("a[data-toggle='tab'],a[data-bs-toggle='tab']"))
        .find(item => item.getAttribute("href") === `#${tabId}`);
      const label = normalizeSpace(link && link.textContent);
      if (label) return label;
    }

    const directName = directChild(tabPane, child => {
      const name = child && child.getAttribute ? child.getAttribute("name") || "" : "";
      return child.tagName === "INPUT" && /^pageTabs\[\d+\]\.name$/.test(name);
    });
    return normalizeSpace(directName && directName.value);
  }

  function fieldNameFor(textarea) {
    if (!textarea) return "";
    const fromData = normalizeSpace(textarea.dataset && textarea.dataset.fieldName);
    if (fromData) return fromData;

    const field = textarea.closest(".field");
    if (!field) return "";
    const nameInput = Array.from(field.querySelectorAll("input[name$='.name']"))
      .find(input => /\.fields\[\d+\]\.name$/.test(input.getAttribute("name") || ""));
    if (nameInput && normalizeSpace(nameInput.value)) return normalizeSpace(nameInput.value);

    const label = field.querySelector("label");
    return normalizeSpace(label && label.textContent).replace(/^[*]\s*/, "").replace(/:$/, "");
  }

  function replicantAncestors(textarea, tabPane) {
    const ancestors = [];
    let current = textarea && textarea.parentElement;
    while (current && current !== tabPane) {
      if (current.classList && current.classList.contains("replicant")) ancestors.push(current);
      current = current.parentElement;
    }
    return ancestors.reverse();
  }

  function ownReplicantItems(replicant) {
    if (!replicant) return [];
    return Array.from(replicant.querySelectorAll(".replicant-data"))
      .filter(item => item.closest(".replicant") === replicant);
  }

  function componentDescriptor(replicant, textarea) {
    const name = normalizeSpace(replicant && replicant.dataset && replicant.dataset.name);
    const items = ownReplicantItems(replicant);
    const activeItem = items.find(item => item.contains(textarea)) || null;
    const index = activeItem ? items.indexOf(activeItem) + 1 : 0;
    const max = Number(replicant && replicant.dataset && replicant.dataset.max) || 0;
    const repeatable = max > 1 || items.length > 1;
    const internal = /^REPLICANT(?:[_\s-]|$)/i.test(name);
    const label = !name || internal ? "" : repeatable && index ? `${name} ${index}` : name;

    return {
      name,
      label,
      index,
      repeatable,
      replicantId: (replicant && (replicant.dataset.replicantId || replicant.id)) || "",
      replicantDataId: (activeItem && (activeItem.dataset.replicantDataId || activeItem.dataset.id || activeItem.id)) || ""
    };
  }

  function describeEditorFrame(frame, fallbackIndex = -1) {
    if (!frame || !frame.ownerDocument) return null;
    const textarea = sourceTextareaForFrame(frame, fallbackIndex);
    const tabPane = textarea ? textarea.closest(".tab-pane") : null;
    const tabId = (tabPane && tabPane.id) || "";
    const tabName = tabNameFor(tabPane);
    const fieldName = fieldNameFor(textarea);
    const components = textarea
      ? replicantAncestors(textarea, tabPane).map(replicant => componentDescriptor(replicant, textarea))
      : [];
    const parts = [tabName, ...components.map(component => component.label), fieldName].filter(Boolean);
    const deduped = parts.filter((part, index) =>
      index === 0 || part.toLowerCase() !== parts[index - 1].toLowerCase()
    );
    const textareaId = (textarea && textarea.id) || "";

    return {
      textareaId,
      editorKey: textareaId || (frame.id || "") || (fallbackIndex >= 0 ? `region:${fallbackIndex + 1}` : ""),
      tabId,
      tabName,
      fieldName,
      components,
      location: deduped.join(" → ")
    };
  }

  function editorKey(item) {
    const source = item && item.editorSource;
    return normalizeSpace(source && (source.editorKey || source.textareaId)) ||
      (Number(item && item.editorRegion) ? `region:${Number(item.editorRegion)}` : "");
  }

  function locationFor(source, nestedLocation) {
    const base = normalizeSpace(source && source.location);
    const nested = normalizeSpace(nestedLocation);
    if (!base) return nested || "Page";
    if (!nested || nested === "Page" || nested === "Page content") return base;
    if (nested === base || nested.startsWith(`${base} · `)) return nested;
    return `${base} · ${nested}`;
  }

  function findEditorFrame(doc, source, editorRegion = null) {
    const frames = Array.from(doc.querySelectorAll("iframe.cke_wysiwyg_frame"));
    let textarea = null;
    let frame = null;
    const textareaId = normalizeSpace(source && source.textareaId);

    if (textareaId) {
      textarea = doc.getElementById(textareaId);
      const editorContainer = doc.getElementById(`cke_${textareaId}`);
      if (editorContainer) frame = editorContainer.querySelector("iframe.cke_wysiwyg_frame");

      if (!frame && textarea) {
        let sibling = textarea.nextElementSibling;
        while (sibling) {
          if (sibling.matches && sibling.matches("iframe.cke_wysiwyg_frame")) {
            frame = sibling;
            break;
          }
          if (sibling.querySelector) {
            frame = sibling.querySelector("iframe.cke_wysiwyg_frame");
            if (frame) break;
          }
          sibling = sibling.nextElementSibling;
        }
      }
    }

    if (!frame && Number(editorRegion) > 0) frame = frames[Number(editorRegion) - 1] || null;
    if (!textarea && frame) textarea = sourceTextareaForFrame(frame, frames.indexOf(frame));
    return { frame, textarea, frames };
  }

  function isHidden(element) {
    if (!element) return true;
    if (element.hidden) return true;
    const view = element.ownerDocument && element.ownerDocument.defaultView;
    if (!view || !view.getComputedStyle) return false;
    const style = view.getComputedStyle(element);
    return style.display === "none" || style.visibility === "hidden";
  }

  function tabLinkFor(doc, tabId) {
    if (!tabId) return null;
    return Array.from(doc.querySelectorAll("a[data-toggle='tab'],a[data-bs-toggle='tab']"))
      .find(item => item.getAttribute("href") === `#${tabId}`) || null;
  }

  function portletBody(container) {
    return directChild(container, child =>
      child.classList &&
      (child.classList.contains("portlet-body") || child.classList.contains("portlet-container-body"))
    );
  }

  function portletTrigger(container) {
    const title = directChild(container, child =>
      child.classList && child.classList.contains("portlet-title")
    );
    if (!title) return null;
    return title.querySelector(
      ".header-icon-down,.toggle-portlet,.toggle-all,[data-toggle='collapse'],[data-bs-toggle='collapse']"
    ) || title;
  }

  async function activateEditor(doc, source, editorRegion = null) {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    let resolved = findEditorFrame(doc, source, editorRegion);
    const textarea = resolved.textarea;

    if (textarea) {
      const tabPane = textarea.closest(".tab-pane");
      if (tabPane) {
        const tabId = tabPane.id || normalizeSpace(source && source.tabId);
        const tabLink = tabLinkFor(doc, tabId);

        if (!tabPane.classList.contains("active") || isHidden(tabPane)) {
          if (tabLink) {
            try { tabLink.click(); } catch (_) {}
            await wait(80);
          }

          if (!tabPane.classList.contains("active") || isHidden(tabPane)) {
            const tabContent = tabPane.parentElement;
            if (tabContent) {
              Array.from(tabContent.children || [])
                .filter(child => child !== tabPane && child.classList && child.classList.contains("tab-pane"))
                .forEach(child => child.classList.remove("active"));
            }
            tabPane.classList.add("active");
            tabPane.hidden = false;
            if (tabPane.style.display === "none") tabPane.style.display = "";

            if (tabLink) {
              const item = tabLink.closest("li");
              const list = item && item.parentElement;
              if (list) Array.from(list.children || []).forEach(child => child.classList && child.classList.remove("active"));
              if (item) item.classList.add("active");
              tabLink.setAttribute("aria-expanded", "true");
            }
          }
        }
      }

      const containers = [];
      let current = textarea.parentElement;
      const stop = textarea.closest(".tab-pane");
      while (current && current !== stop) {
        if (
          current.classList &&
          (
            current.classList.contains("replicant") ||
            current.classList.contains("replicant-data") ||
            current.classList.contains("portlet") ||
            current.classList.contains("portlet-container")
          )
        ) {
          containers.push(current);
        }
        current = current.parentElement;
      }

      containers.reverse();
      for (const container of containers) {
        const body = portletBody(container);
        if (!body || !isHidden(body)) continue;
        const trigger = portletTrigger(container);
        if (trigger) {
          try { trigger.click(); } catch (_) {}
          await wait(60);
        }
        if (isHidden(body)) {
          body.hidden = false;
          body.style.display = "block";
        }
      }
    }

    resolved = findEditorFrame(doc, source, editorRegion);
    return resolved;
  }

  global.BCWebStyleGuideCmsLite = {
    normalizeSpace,
    sourceTextareaForFrame,
    describeEditorFrame,
    editorKey,
    locationFor,
    findEditorFrame,
    activateEditor
  };
})(globalThis);
