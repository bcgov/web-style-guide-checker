
(() => {
  "use strict";

  // Check whether we're inside Word for the web
  function isWordOnlineEditor(doc = document) {
    return doc.location?.hostname === "cac-word-edit.officeapps.live.com";
  }

  // Extract Word content and convert it to standard HTML
  function extractWordContent(sourceDoc = document) {
    if (!isWordOnlineEditor(sourceDoc)) {
      return null;
    }

    const paragraphs = [
      ...sourceDoc.querySelectorAll("p.ParagraphTextContent")
    ];

    if (!paragraphs.length) {
      return null;
    }

    const normalizedDoc =
      sourceDoc.implementation.createHTMLDocument("Word document");

    const main = normalizedDoc.createElement("main");

    paragraphs.forEach(original => {
      const level = Number(original.getAttribute("aria-level"));

      const isHeading =
        original.getAttribute("role") === "heading" &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= 6;

      const element = normalizedDoc.createElement(
        isHeading ? `h${level}` : "p"
      );

      // Preserve text and hyperlinks
      original.childNodes.forEach(node => {
        element.appendChild(
          normalizedDoc.importNode(node, true)
        );
      });

      main.appendChild(element);
    });

    normalizedDoc.body.appendChild(main);

    return {
      document: normalizedDoc,
      paragraphCount: paragraphs.length,
      headingCount: main.querySelectorAll(
        "h1,h2,h3,h4,h5,h6"
      ).length,
      linkCount: main.querySelectorAll("a[href]").length
    };
  }
  
  // Run the existing checker against normalized Word content
  function scanWordContent(options = {}) {
    const extracted = extractWordContent();

    if (!extracted) {
      return { error: "No Word document content found." };
    }

    const checker = globalThis.BCWebStyleGuideChecker;

    if (!checker?.scanPage) {
      return { error: "Style checker is not loaded." };
    }

    // The checker needs an attached document with a window
    const frame = document.createElement("iframe");
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;" +
      "width:800px;height:600px;border:0;";

    document.body.appendChild(frame);

    try {
      const scanDoc = frame.contentDocument;

      if (!scanDoc) {
        return { error: "Could not create the scan document." };
      }

      const content = scanDoc.importNode(
        extracted.document.querySelector("main"),
        true
      );

      scanDoc.body.appendChild(content);

      
      const report = checker.scanPage(scanDoc, {
        ...options,
        scope: "content"
      });

      // Exclude checks that only apply to published webpages
      const excludedRules = new Set([
        "meta-description",
        "document-language",
        "main-landmark",
        "skip-link-target",
        "on-this-page-missing",
        "on-this-page-links",
        "broken-anchor"
      ]);

      report.issues = (report.issues || []).filter(
        issue => !excludedRules.has(issue.ruleId)
      );

      return report;

    } finally {
      frame.remove();
    }
  }

  // Make these functions available to the extension
  globalThis.BCWordOnlineAdapter = {
    isWordOnlineEditor,
    extractWordContent,
    scanWordContent
  };
})();

