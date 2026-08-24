(function (global) {
  "use strict";

  const SOURCES = {
    plain: ["Writing web content", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/writing-web-content"],
    grammar: ["Grammar, spelling and tone", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/grammar-spelling-tone"],
    abbreviations: ["Abbreviations and acronyms", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/abbreviations"],
    capitalization: ["Capitalization and names", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/capitalization"],
    formatting: ["Formatting web content", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/formatting"],
    headings: ["Headings and page titles", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/headings"],
    links: ["Links", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/links"],
    lists: ["Lists", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/lists"],
    numbers: ["Numbers and dates", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/numbers"],
    punctuation: ["Punctuation and symbols", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/punctuation"],
    faq: ["FAQs", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/web-style-guide/writing-guide/faqs"],
    graphics: ["Accessible graphics", "https://www2.gov.bc.ca/gov/content/home/accessible-government/toolkit/accessible-digital-content/graphics"],
    contrast: ["Colour contrast", "https://www2.gov.bc.ca/gov/content/home/accessible-government/toolkit/accessible-digital-content/colour-contrast"],
    tables: ["Tables", "https://www2.gov.bc.ca/gov/content/governments/services-for-government/service-experience-digital-delivery/web-content-development-guides/cms-lite-manual/ui-guidelines/text-editor/tables"]
  };

  const RULES = {
    "page-title-missing": ["Page information", "fix", "Add a page title", "Every page needs a clear, unique title.", "Add a concise, descriptive HTML title.", "headings"],
    "page-title-long": ["Page information", "check", "Shorten the page title", "The guide recommends keeping page titles under 70 characters.", "Keep the title concise while retaining the words people need to identify the page.", "headings"],
    "page-title-punctuation": ["Page information", "fix", "Remove punctuation from the page title", "Page titles should not end in punctuation unless they are questions.", "Remove the ending punctuation.", "headings"],
    "meta-description": ["Page information", "check", "Add a metadata description", "Service pages should include a unique description for search results.", "Add a concise description that distinguishes this page from related pages.", "plain"],
    "document-language": ["Accessibility", "fix", "Identify the page language", "Language markup helps browsers and assistive technology pronounce content correctly.", "Add a valid lang attribute to the html element.", "formatting"],
    "main-landmark": ["Accessibility", "fix", "Add a main content landmark", "A main landmark helps people using assistive technology move directly to the page content.", "Use one main element, or one element with role=\"main\", around the primary content.", "formatting"],
    "skip-link-target": ["Accessibility", "fix", "Fix the skip link", "A skip link must move keyboard focus to a real location on the page.", "Update the skip link so its fragment points to the main content.", "links"],
    "disclosure-state": ["Accessibility", "fix", "Report the open or closed state", "A button that opens and closes content needs to report its current state to assistive technology.", "Add aria-expanded and update it when the controlled content opens or closes.", "formatting"],
    "broken-image": ["Accessibility", "fix", "Fix the image that did not load", "A missing image leaves a gap and can hide useful information.", "Correct the image address or replace the image.", "graphics"],
    "staging-url": ["Links", "fix", "Replace the staging link", "A public page should not depend on a staging website that may be unavailable to the public.", "Change the address to the published destination.", "links"],
    "h1-count": ["Headings", "fix", "Use one H1 page heading", "Every page must have an H1. Multiple H1s can make the page structure unclear.", "Keep one H1 that describes the page.", "headings"],
    "heading-skip": ["Headings", "fix", "Put heading levels in order", "Heading levels must not skip a level.", "Change the heading level so the hierarchy moves one level at a time.", "headings"],
    "heading-deep": ["Headings", "check", "Avoid heading levels 5 and 6", "The guide recommends using H2 to H4 for page sections.", "Simplify the structure or move this heading to H4 or above.", "headings"],
    "heading-empty": ["Headings", "fix", "Add heading text", "Empty headings create confusing navigation for assistive technology.", "Remove the empty heading or give it descriptive text.", "headings"],
    "heading-punctuation": ["Headings", "fix", "Remove punctuation from the heading", "Headings should not end in punctuation unless they are questions.", "Remove the ending punctuation.", "headings"],
    "heading-formatting": ["Headings", "fix", "Remove formatting from the heading", "Heading tags already provide the required emphasis.", "Remove bold, italic or underline formatting inside the heading.", "headings"],
    "heading-title-case": ["Headings", "review", "Check sentence case", "Headings and page titles should use sentence case, with capitals reserved for proper nouns and defined acronyms.", "Confirm each capitalized word is a proper noun or acronym; otherwise use lower case.", "headings"],
    "on-this-page-missing": ["Headings", "review", "Consider an ‘On this page’ section", "Pages with 3 or more H2 headings may be easier to navigate with an ‘On this page’ section.", "Add an H2 called ‘On this page’ with a bulleted list of links to the other H2 headings if it helps people scan.", "headings"],
    "on-this-page-format": ["Headings", "fix", "Fix the ‘On this page’ heading", "‘On this page’ should be an H2 and should not use a colon.", "Use the exact H2 text ‘On this page’.", "headings"],
    "on-this-page-links": ["Headings", "fix", "Match ‘On this page’ links to H2 headings", "The links should match the page’s H2 headings in text and order and should not target H3 or H4 headings.", "Update the link text, target or order to match the H2 headings.", "headings"],
    "paragraph-long": ["Plain language", "check", "Break up the paragraph", "The guide recommends 5 sentences or fewer per paragraph.", "Keep one topic per paragraph and move a new topic into a new paragraph.", "plain"],
    "sentence-long": ["Plain language", "check", "Shorten the sentence", "The guide recommends a maximum of 15 to 20 words per sentence.", "Split the sentence into single-subject sentences.", "plain"],
    "reading-level": ["Plain language", "review", "Review the reading level", "The guide targets Grade 8. The checker raises this review finding at Grade 9 or higher.", "Simplify sentence structure and replace complex words where meaning allows. The displayed grade is an estimate.", "plain"],
    "complex-phrase": ["Plain language", "check", "Consider a simpler phrase", "The guide recommends common, everyday words.", "Use the suggested plain-language wording when it preserves the intended meaning.", "plain"],
    "filler-phrase": ["Plain language", "check", "Cut unnecessary words", "Extra words make content slower to scan.", "Use the shorter wording suggested by the guide.", "plain"],
    "passive-voice": ["Plain language", "review", "Check for passive voice", "Active voice is usually shorter and makes responsibility clearer.", "Name the person or organization doing the action and use subject–verb–object order where appropriate.", "grammar"],
    "negative-contraction": ["Plain language", "check", "Avoid a negative contraction", "Negative contractions can be misread as their opposite.", "Write out the negative form, such as ‘do not’ or ‘cannot’.", "grammar"],
    "undefined-acronym": ["Plain language", "review", "Define the acronym on first use", "Write a term in full the first time, followed by its abbreviation in parentheses, unless the short form is widely better known.", "Define it on first use or confirm it is better known than the long form.", "abbreviations"],
    "bc-abbreviation": ["Capitalization", "check", "Write B.C. with periods", "The province abbreviation uses periods except in brand and company names.", "Change ‘BC’ to ‘B.C.’ unless it is part of a formal brand such as BC Hydro or BC Ferries.", "abbreviations"],
    "latin-abbreviation": ["Plain language", "fix", "Replace the Latin abbreviation", "The guide says not to use ‘e.g.’ or ‘i.e.’.", "Use ‘such as’, ‘like’ or ‘for example’.", "abbreviations"],
    "faq-content": ["Content design", "review", "Restructure FAQ content", "The guide recommends integrating answers under topic-based headings because FAQs are difficult to scan and maintain.", "Group the information by topic and replace question headings with descriptive headings.", "faq"],
    "generic-link": ["Links", "fix", "Write descriptive link text", "Link text needs to make sense without the surrounding sentence.", "Describe the destination or what someone can do there.", "links"],
    "empty-link": ["Links", "fix", "Give the link an accessible name", "A link without a name gives people no information about its destination.", "Add descriptive text or an accessible label.", "links"],
    "url-link-text": ["Links", "check", "Replace the URL with descriptive link text", "People scan links to understand where they lead.", "Use the destination name or the task someone can complete.", "links"],
    "long-link-text": ["Links", "review", "Shorten the link text", "The guide advises against linking long sentences or blocks of text.", "Link only the concise words that describe the destination.", "links"],
    "new-tab": ["Links", "review", "Confirm the link needs a new tab", "Links should open in the same tab by default. A new tab can make sense when preserving an in-progress task or secure session.", "Remove target=\"_blank\" unless opening a new tab supports the user’s task.", "links"],
    "news-release-link": ["Links", "review", "Check the news release link", "News release links can become stale and should generally be replaced after 30 days.", "Link to maintained, static content where possible and confirm this news release remains necessary.", "links"],
    "email-link-text": ["Links", "fix", "Use the email address as link text", "The guide says an email link should display the email address.", "Use the full email address as the linked text.", "links"],
    "phone-unlinked": ["Links", "fix", "Link the phone number", "Phone numbers should be clickable.", "Wrap the number in a tel link using international dialling format.", "links"],
    "phone-link-format": ["Links", "fix", "Fix the phone link", "Telephone links should use international dialling format.", "Use a value such as tel:+1-250-555-0123.", "links"],
    "file-link-label": ["Links", "fix", "Add the file type and size", "Document link text should tell people the file type and size before they open it. A type on its own, such as ‘(PDF)’, is not enough.", "Add a label such as ‘(PDF, 504KB)’ to the linked text.", "links"],
    "file-link-size-spacing": ["Links", "fix", "Remove the space in the file size", "File sizes use no space between the number and unit.", "Remove the space between the number and unit, such as changing ‘271 KB’ to ‘271KB’.", "links"],
    "file-link-type-mismatch": ["Links", "fix", "Correct the file type in the link text", "The file type in the link text does not match the asset returned by the server.", "Update the type in the linked text or correct the asset.", "links"],
    "file-link-size-mismatch": ["Links", "check", "Correct the file size in the link text", "The file size in the link text does not match the size returned by the server.", "Update the displayed file size after confirming the linked asset is the intended file.", "links"],
    "punctuation-only-link": ["Links", "fix", "Remove the punctuation-only link", "A link made only from punctuation has no useful purpose when it is read on its own.", "Move the punctuation outside the link, or include it in the neighbouring descriptive link if both go to the same destination.", "links"],
    "linked-period": ["Links", "check", "Move punctuation outside the link", "Ending punctuation should not be included in linked text.", "End the link before the punctuation mark.", "links"],
    "broken-anchor": ["Links", "fix", "Fix the anchor link", "The link points to a location that does not exist on this page.", "Update the fragment identifier or add the matching target.", "links"],
    "broken-http-link": ["Links", "fix", "Fix the broken link", "The destination returned a 404 or 410 response when the link status was checked.", "Update or remove the link, then run the link-status check again.", "links"],
    "http-link-server-error": ["Links", "review", "Check the unavailable link", "The destination returned a server error when the link status was checked.", "Try the link manually and update or remove it if the destination remains unavailable.", "links"],
    "list-depth": ["Lists", "fix", "Reduce the list depth", "The guide says never to use lists with more than 2 levels.", "Flatten or regroup the list.", "lists"],
    "list-punctuation": ["Lists", "fix", "Remove punctuation from the list item", "List items should not end in punctuation.", "Remove the final punctuation mark.", "lists"],
    "list-lowercase": ["Lists", "check", "Capitalize the list item", "The first word of each list item should be capitalized.", "Capitalize the first word unless the item intentionally demonstrates lower-case wording.", "lists"],
    "list-long": ["Lists", "review", "Consider grouping the list", "Long lists can be hard to follow.", "Group related items under descriptive headings or into shorter lists.", "lists"],
    "list-repetition": ["Lists", "review", "Remove repeated openings", "Repeated words at the start of list items delay the distinguishing information, especially for screen reader users.", "Move the unique information to the beginning of each item.", "lists"],
    "table-headers": ["Tables", "fix", "Add table headers", "Tables need programmatic headers so people can understand the relationships in the data.", "Use th elements for row or column headings.", "tables"],
    "table-caption": ["Tables", "review", "Check the table has a useful caption", "A short caption can make the purpose of tabular data clearer.", "Add a concise caption when the surrounding heading does not already identify the table.", "tables"],
    "table-accordion": ["Tables", "fix", "Move the table out of the accordion", "The guide says never to use tables in accordions.", "Place the table in the main page content.", "tables"],
    "month-abbreviation": ["Numbers and dates", "check", "Write out the month", "Month names should be written in full when space is available.", "Use the full month name in body content.", "numbers"],
    "numeric-date": ["Numbers and dates", "check", "Write out the date", "Numeric dates are reserved for space-limited forms and tables and should use YYYY-MM-DD.", "Use a format such as ‘August 13, 2026’ in body content.", "numbers"],
    "ordinal-date": ["Numbers and dates", "fix", "Remove the ordinal from the date", "Dates should not use ordinals.", "Write ‘January 18, 2003’, not ‘January 18th, 2003’.", "numbers"],
    "time-format": ["Numbers and dates", "check", "Fix the time format", "Whole hours should omit :00, and am and pm use lower case without periods.", "Use ‘9 am’ for a whole hour or ‘9:45 pm’ when minutes are needed.", "numbers"],
    "noon-midnight": ["Numbers and dates", "fix", "Use ‘noon’ or ‘midnight’", "The guide says to write noon and midnight without the number 12.", "Remove ‘12’ from ‘12 noon’ or ‘12 midnight’.", "numbers"],
    "phone-display-format": ["Numbers and dates", "fix", "Use hyphens in the phone number", "Phone numbers use hyphens between digit groups.", "Use a format such as 250-555-0123 or 1-800-555-0123.", "numbers"],
    "imperial-unit": ["Numbers and dates", "review", "Use a metric measurement", "The guide requires metric measurements.", "Convert the measurement to the appropriate metric unit unless the original unit is required for technical context.", "numbers"],
    "metric-spacing": ["Numbers and dates", "fix", "Add a space before the unit", "Measurements use a space between the number and unit, except temperatures.", "Add a space, such as ‘30 km’.", "numbers"],
    "metric-plural": ["Numbers and dates", "fix", "Use the singular unit abbreviation", "Metric unit abbreviations do not take a plural ‘s’.", "Use ‘100 km’, not ‘100 kms’.", "numbers"],
    "celsius-format": ["Numbers and dates", "fix", "Fix the Celsius format", "Temperatures use no space and a capital C: 18°C.", "Remove the space and use the °C symbol.", "numbers"],
    "percent-symbol": ["Numbers and dates", "check", "Spell out ‘percent’ in body text", "The % symbol is intended for financial charts, tables, equations and calculations.", "Use ‘percent’ in a sentence unless the content is a calculation or financial data.", "numbers"],
    "fraction-symbol": ["Numbers and dates", "check", "Write out the fraction", "Fractions without a whole number should usually be written in words.", "Use wording such as ‘half’, ‘a quarter’ or ‘two-thirds’.", "numbers"],
    "ampersand": ["Punctuation", "review", "Check the ampersand", "The guide says to write ‘and’ except in business names and citations.", "Replace & with ‘and’ unless it is part of a formal name or citation.", "punctuation"],
    "semicolon": ["Punctuation", "fix", "Replace the semicolon", "The guide recommends 2 sentences instead of a semicolon.", "Split the sentence at the semicolon.", "punctuation"],
    "exclamation": ["Punctuation", "fix", "Remove the exclamation mark", "Government web content should use a calm, direct tone.", "Use a period or rewrite the sentence.", "punctuation"],
    "em-dash": ["Punctuation", "fix", "Replace the em dash", "The guide recommends shorter sentences instead of em dashes.", "Split the sentence or use commas when appropriate.", "punctuation"],
    "range-dash": ["Punctuation", "check", "Use ‘to’ for the range", "Number, date and time ranges should use the word ‘to’ instead of a dash.", "Replace the dash with ‘to’ unless this is a fiscal year.", "punctuation"],
    "slash": ["Punctuation", "check", "Replace the slash", "Slashes should be limited to URLs because forms such as ‘and/or’ can create ambiguity.", "Write the relationship explicitly.", "punctuation"],
    "double-space": ["Formatting", "fix", "Remove the extra space", "Use one space after a sentence.", "Replace consecutive spaces with one space.", "formatting"],
    "text-alignment": ["Formatting", "check", "Left-align the text", "Centred and right-aligned text is harder to read except in special cases such as table captions.", "Use left alignment for body content.", "formatting"],
    "bold-block": ["Formatting", "fix", "Remove unnecessary bold formatting", "Do not bold headings, links or large blocks of text.", "Use the correct heading style or reserve bold for short, selective emphasis.", "formatting"],
    "bold-link": ["Formatting", "fix", "Remove bold from the link", "The guide says hyperlinks should not be bolded.", "Remove bold formatting and let the link styling provide emphasis.", "formatting"],
    "all-caps": ["Formatting", "fix", "Replace all-capital text", "Text written in all capitals is harder to read and can be interpreted as shouting.", "Use sentence case while preserving established acronyms and official names.", "formatting"],
    "at-symbol": ["Punctuation", "review", "Check the @ symbol", "Use @ for email addresses and established social-media handles.", "Write the relationship in words unless this is an email address or social-media handle.", "punctuation"],
    "italics": ["Formatting", "review", "Check the italic text", "The guide reserves italics for scientific names.", "Remove italics unless this is a scientific name.", "formatting"],
    "strikethrough": ["Formatting", "fix", "Remove strikethrough", "Strikethrough is difficult to read and may not be announced by screen readers.", "Delete outdated wording or rewrite the content.", "formatting"],
    "underline": ["Formatting", "fix", "Remove underlining from non-link text", "Underlining makes text look like a link.", "Remove the underline or make the text a real link when appropriate.", "formatting"],
    "image-alt-missing": ["Accessibility", "fix", "Add alternative text", "Images need an alt attribute so their purpose is available to assistive technology.", "Add concise alt text, or alt=\"\" when the image is purely decorative.", "graphics"],
    "image-alt-empty": ["Accessibility", "review", "Confirm the image is decorative", "An empty alt attribute hides the image from assistive technology.", "Keep alt=\"\" only for a decorative image; otherwise describe its purpose.", "graphics"],
    "linked-image-alt": ["Accessibility", "fix", "Describe the linked image destination", "The alt text of a linked image should say where the link goes or what it does.", "Replace empty or filename-based alt text with the destination or action.", "graphics"],
    "form-label": ["Accessibility", "fix", "Label the form control", "People need a programmatic label to understand a form control.", "Associate a visible label or accessible name with the control.", "formatting"],
    "contrast": ["Accessibility", "check", "Check the colour contrast", "Text needs sufficient contrast against its background.", "Adjust the foreground or background colour. Verify overlays and images with a dedicated contrast tool.", "contrast"]
  };

  const RULE_VERSION = "1.0.0";

  const BUILT_IN_TERMS = [
    "BC Public Service Agency",
    "BC Public Service",
    "BC Regional Information Governance Centre",
    "BC Services Card",
    "BC Demographic Survey",
    "BC Behavioural Insights Group",
    "BC Hydro",
    "BC Ferries",
    "BC Transit",
    "BC Parks",
    "BC Housing",
    "BC Cancer",
    "BC Stats",
    "Service BC",
    "FrontCounter BC",
    "WorkBC",
    "DataBC",
    "HealthLink BC",
    "Destination BC",
    "Creative BC",
    "BCID"
  ].sort((first, second) => second.length - first.length);

  const EXCEPTION_ELIGIBLE_RULES = new Set([
    "bc-abbreviation",
    "undefined-acronym",
    "complex-phrase"
  ]);

  const TEMPLATE_RULES = new Set([
    "document-language",
    "form-label",
    "main-landmark",
    "skip-link-target",
    "disclosure-state"
  ]);

  const CMS_LITE_EXCLUDED_SELECTORS = [
    ".last_Updated_Text",
    "#cmf-ui-supplementary-content",
    "[data-elastic-exclude]",
    "[class*='feedback' i]"
  ].join(",");

  const CMS_LITE_COMPONENT_SELECTORS = [
    ".accordion",
    "[class*='accordion' i]",
    ".panel",
    ".panel-group",
    ".collapse",
    "[class*='collapse' i]",
    "details"
  ].join(",");

  const ASSET_TYPES = {
    pdf: "PDF", doc: "DOC", docx: "DOCX", xls: "XLS", xlsx: "XLSX", csv: "CSV",
    ppt: "PPT", pptx: "PPTX", rtf: "RTF", txt: "TXT", odt: "ODT", ods: "ODS",
    odp: "ODP", zip: "ZIP"
  };

  const WELL_KNOWN_ACRONYMS = new Set([
    "PDF", "DNA", "HTML", "CSS", "URL", "SEO", "SMS", "WCAG", "FAQ", "FAQs", "COVID", "BC",
    "ID", "PO", "VSA", "IDIR", "RCMP", "CRC", "PSA", "PIA", "STRA", "CPPM", "BCID", "SIN", "ESS", "ERA", "ICBC",
    "PST", "GST", "HST", "HRU", "HRUs", "GUID", "GUIDs", "IM", "IT", "MCP", "KB", "MB", "GB"
  ]);

  function isWellKnownAcronym(value) {
    return WELL_KNOWN_ACRONYMS.has(String(value || ""));
  }

  const MANUAL_CHECKS = [
    ["Purpose and audience", "Is it obvious who the page is for, why they need it and what task they can complete?", SOURCES.plain[1]],
    ["Information order", "Does the page start with its purpose and the most important information?", SOURCES.plain[1]],
    ["Accuracy and currency", "Are facts, dates, eligibility details, links and contact information current and supported?", SOURCES.plain[1]],
    ["Necessary content", "Does every section help the audience complete its task, with background and policy detail limited?", SOURCES.grammar[1]],
    ["Descriptive headings", "Do headings accurately describe the information below them using words people are likely to search for?", SOURCES.headings[1]],
    ["Terminology", "Does the page use the same words for the same things, and explain necessary technical terms?", SOURCES.plain[1]],
    ["Links and external sources", "Are external links necessary, trustworthy and maintained? Are news release links still current?", SOURCES.links[1]],
    ["Images and multimedia", "Do alt text, captions and transcripts communicate the same essential information as the media?", SOURCES.graphics[1]],
    ["Mobile use", "Can people scan the content, use forms and download assets comfortably on a phone or tablet?", SOURCES.formatting[1]],
    ["Policy and legal meaning", "Does plain-language wording preserve the policy or legal meaning, with a disclaimer and source legislation where needed?", SOURCES.grammar[1]],
    ["Site-wide uniqueness", "Is the page title and metadata description distinct from other pages on the site?", SOURCES.headings[1]],
    ["User testing", "Has the service or critical task been tested with representative users?", SOURCES.plain[1]]
  ];

  const SIMPLE_PHRASES = [
    ["accommodation", "housing"], ["a number of", "some, many or few"], ["approximately", "about"],
    ["aggregate", "total"], ["amongst", "among"], ["as a consequence of", "because"], ["assist", "help"],
    ["collaborate", "work with"], ["concerning", "about"], ["disburse", "pay"], ["discontinue", "stop"],
    ["dispatch", "send"], ["documentation", "documents"], ["due to the fact", "because"],
    ["give consideration to", "think about or consider"], ["in accordance with", "in line with"],
    ["initiative", "program, project or plan"], ["in the absence of", "without"], ["in the event of", "if or when"],
    ["in relation to", "about"], ["individual", "person"], ["is able to", "can"],
    ["it should be noted", "remember"], ["submit an application", "apply"], ["method", "way"],
    ["obtain", "get"], ["prior to", "before"], ["subsequently", "after"], ["utilize", "use"]
  ];

  const FILLER_PHRASES = [
    ["and also", "and"], ["skills and abilities", "skills"], ["planning for the future", "planning"],
    ["to be able to", "to"], ["all of the required information", "the required information"],
    ["to make updates", "to update"], ["in order to", "to"], ["various options", "options"],
    ["the amount of time that", "how long"], ["provides you with the opportunity to", "lets you"]
  ];

  function normalizeSpace(value) {
    return String(value || "").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/\s+/g, " ").trim();
  }

  function comparisonText(value) {
    return normalizeSpace(String(value || "").replace(/[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, ""));
  }

  function words(value) {
    return normalizeSpace(value).match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g) || [];
  }

  function sentences(value) {
    const clean = normalizeSpace(value);
    if (!clean) return [];
    const placeholder = "\ue000";
    const commonSentenceStarters = new Set([
      "apply", "check", "choose", "contact", "find", "get", "government", "if", "it", "learn", "people", "read", "the", "these", "they", "this", "those", "to", "use", "we", "when", "you"
    ]);
    const protectedText = clean.replace(/\b(?:[A-Za-z]\.){2,}/g, (initialism, offset, source) => {
      const after = source.slice(offset + initialism.length);
      const nextWord = (after.match(/^\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ’'-]*)/) || [])[1] || "";
      const finalPeriodIsBoundary = !nextWord || commonSentenceStarters.has(nextWord.toLowerCase());
      return initialism.replace(/\./g, (period, periodOffset) => {
        const isFinal = periodOffset === initialism.length - 1;
        return isFinal && finalPeriodIsBoundary ? period : placeholder;
      });
    });
    return (protectedText.match(/[^.!?]+(?:[.!?]+|$)/g) || [protectedText])
      .map(sentence => normalizeSpace(sentence.replaceAll(placeholder, ".")))
      .filter(Boolean);
  }

  function syllables(word) {
    let value = String(word).toLowerCase().replace(/[^a-z]/g, "");
    if (!value) return 0;
    if (value.length <= 3) return 1;
    value = value.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    return Math.max(1, (value.match(/[aeiouy]{1,2}/g) || []).length);
  }

  function readingGrade(value) {
    const wordList = words(value);
    const sentenceList = sentences(value);
    if (wordList.length < 30 || sentenceList.length === 0) return null;
    const syllableCount = wordList.reduce((total, word) => total + syllables(word), 0);
    return Math.max(0, 0.39 * (wordList.length / sentenceList.length) + 11.8 * (syllableCount / wordList.length) - 15.59);
  }

  function readingGradeFromBlocks(blocks) {
    const usable = (blocks || []).map(normalizeSpace).filter(value => words(value).length >= 4);
    const wordList = usable.flatMap(words);
    if (wordList.length < 30) return { grade: null, words: wordList.length, sentences: 0 };
    const sentenceCount = usable.reduce((total, block) => {
      const explicit = sentences(block).length;
      return total + Math.max(1, explicit);
    }, 0);
    const syllableCount = wordList.reduce((total, word) => total + syllables(word), 0);
    const grade = Math.max(0, 0.39 * (wordList.length / sentenceCount) + 11.8 * (syllableCount / wordList.length) - 15.59);
    return { grade, words: wordList.length, sentences: sentenceCount };
  }

  function shouldFlagReadingGrade(value) {
    return Number.isFinite(value) && value >= 9;
  }

  function excerpt(value, maximum) {
    const clean = normalizeSpace(value);
    const max = maximum || 180;
    return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function canonicalUrl(value) {
    try {
      const url = new URL(value);
      url.hash = "";
      return url.href;
    } catch (_) {
      return String(value || "").split("#")[0];
    }
  }

  function detectProfile(url, requestedProfile) {
    let hostname = "";
    try { hostname = new URL(url).hostname.toLowerCase(); } catch (_) { hostname = ""; }
    if (requestedProfile && requestedProfile !== "auto") return requestedProfile;
    if (["www2.gov.bc.ca", "www2.qa.gov.bc.ca", "intranet.gov.bc.ca", "intranet.qa.gov.bc.ca"].includes(hostname)) return "cms-lite";
    return "standard";
  }

  function profileLabel(profile) {
    return profile === "cms-lite" ? "CMS Lite" : "Standard website";
  }

  function approvedTermRanges(value) {
    const text = String(value || "");
    const ranges = [];
    BUILT_IN_TERMS.forEach(term => {
      const expression = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])(" + escapeRegExp(term) + ")(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])", "g");
      let match;
      while ((match = expression.exec(text))) {
        const start = match.index + match[1].length;
        ranges.push({ start, end: start + match[2].length, term });
      }
    });
    return ranges;
  }

  function isInsideRange(index, ranges) {
    return ranges.some(range => index >= range.start && index < range.end);
  }

  function tokenSpans(value) {
    const text = String(value || "");
    const expression = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;
    const output = [];
    let match;
    while ((match = expression.exec(text))) output.push({ value: match[0], start: match.index, end: match.index + match[0].length });
    return output;
  }

  function proposeExactPhrase(value, matchStart, token) {
    const text = String(value || "");
    const spans = tokenSpans(text);
    const tokenIndex = spans.findIndex(span => matchStart >= span.start && matchStart < span.end);
    if (tokenIndex < 0) return token || "";
    const connectors = new Set(["and", "of", "the", "for", "in", "on"]);
    const looksLikeName = word => /^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ’'-]*$/.test(word) || /^[A-Z0-9]{2,}$/.test(word);
    let startIndex = tokenIndex;
    let endIndex = tokenIndex;

    for (let index = tokenIndex + 1; index < spans.length && index <= tokenIndex + 6; index += 1) {
      const previousGap = text.slice(spans[index - 1].end, spans[index].start);
      if (/[,.!?;:()\/–—\n\r]/.test(previousGap)) break;
      const word = spans[index].value;
      const lower = word.toLowerCase();
      const nextLooksLikeName = spans[index + 1] && looksLikeName(spans[index + 1].value);
      if (looksLikeName(word) || (connectors.has(lower) && nextLooksLikeName)) endIndex = index;
      else break;
    }

    const proposal = normalizeSpace(text.slice(spans[startIndex].start, spans[endIndex].end));
    return proposal || token || spans[tokenIndex].value;
  }

  function validateExceptionPhrase(phrase, token) {
    const clean = normalizeSpace(phrase);
    const tokenText = normalizeSpace(token);
    const termWords = words(clean);
    if (termWords.length < 1 || termWords.length > 8) return { valid: false, reason: "Choose an exact term containing 1 to 8 words." };
    if (/[*?{}[\]]/.test(clean)) return { valid: false, reason: "Wildcards and patterns are not allowed." };
    if (clean === "BC" && tokenText === "BC") {
      return { valid: false, reason: "Enter the complete formal name. ‘BC’ by itself cannot be allowed." };
    }
    const containsExactToken = clean.includes(tokenText);
    if (!containsExactToken) {
      return { valid: false, reason: "The term must contain the exact flagged text." };
    }
    if (termWords.length === 1) return { valid: true, phrase: clean };
    const otherWords = termWords.filter(word => word !== tokenText);
    if (!otherWords.some(word => /^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ’'-]+$/.test(word) || /^[A-Z0-9]{2,}$/.test(word))) {
      return { valid: false, reason: "Include the formal name around the flagged text." };
    }
    return { valid: true, phrase: clean };
  }

  function exceptionMatches(exception, ruleId, text, hostname) {
    if (!exception || exception.ruleId !== ruleId || !exception.phrase) return false;
    if (exception.ruleId === "bc-abbreviation" && normalizeSpace(exception.phrase) === "BC") return false;
    if (exception.domain && exception.domain !== "*" && exception.domain !== hostname) return false;
    const expression = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])" + escapeRegExp(exception.phrase) + "(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])");
    return expression.test(String(text || ""));
  }

  function exceptionAtIndex(exceptions, ruleId, text, index, hostname) {
    return (exceptions || []).find(exception => {
      if (!exception || exception.ruleId !== ruleId || !exception.phrase) return false;
      if (exception.ruleId === "bc-abbreviation" && normalizeSpace(exception.phrase) === "BC") return false;
      if (exception.domain && exception.domain !== "*" && exception.domain !== hostname) return false;
      const expression = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])(" + escapeRegExp(exception.phrase) + ")(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])", "g");
      let match;
      while ((match = expression.exec(String(text || "")))) {
        const start = match.index + match[1].length;
        if (index >= start && index < start + match[2].length) return true;
      }
      return false;
    }) || null;
  }

  function builtInTermAtIndex(text, index) {
    return BUILT_IN_TERMS.find(term => {
      const expression = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])(" + escapeRegExp(term) + ")(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9’'-])", "g");
      let match;
      while ((match = expression.exec(String(text || "")))) {
        const start = match.index + match[1].length;
        if (index >= start && index < start + match[2].length) return true;
      }
      return false;
    }) || "";
  }

  function findingFingerprint(pageUrl, finding) {
    return "f-" + hashString([
      canonicalUrl(pageUrl),
      finding.ruleId,
      normalizeSpace(finding.evidence),
      finding.selector || "",
      finding.matchIndex === undefined ? "" : finding.matchIndex
    ].join("|"));
  }

  function cssPath(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.id) {
      const escaped = global.CSS && CSS.escape ? CSS.escape(element.id) : element.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      return "#" + escaped;
    }
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && parts.length < 8) {
      let part = current.tagName.toLowerCase();
      const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(item => item.tagName === current.tagName) : [];
      if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
      parts.unshift(part);
      if (current === current.ownerDocument.documentElement) break;
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function locationLabel(element, root) {
    if (!element || element.nodeType !== 1) return "Page";
    if (/^H[1-6]$/.test(element.tagName)) return normalizeSpace(element.textContent) || element.tagName;
    const headings = Array.from((root || element.ownerDocument).querySelectorAll("h1,h2,h3,h4,h5,h6"));
    let nearest = null;
    for (const heading of headings) {
      if (heading === element || heading.contains(element)) { nearest = heading; break; }
      if (heading.compareDocumentPosition(element) & 4) nearest = heading;
      else if (nearest) break;
    }
    if (nearest) return normalizeSpace(nearest.textContent) || nearest.tagName;
    const landmark = element.closest("main,article,section,nav,header,footer");
    if (landmark) return landmark.tagName.toLowerCase();
    return "Page";
  }

  function isVisible(element) {
    if (!element || !element.ownerDocument || !element.isConnected) return false;
    if (element.closest("[hidden],[aria-hidden='true']")) return false;
    let current = element;
    while (current && current.nodeType === 1) {
      const style = element.ownerDocument.defaultView.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      current = current.parentElement;
    }
    return true;
  }

  function contextualPageH1(doc, root) {
    const inside = Array.from(root.querySelectorAll("h1")).filter(isVisible);
    if (inside.length || root === doc.body) return inside[0] || null;
    const candidates = Array.from(doc.querySelectorAll("h1")).filter(heading => {
      if (!isVisible(heading) || root.contains(heading)) return false;
      if (heading.closest("nav,[role='navigation'],footer,aside,dialog,[role='dialog'],[aria-modal='true']")) return false;
      return Boolean(heading.compareDocumentPosition(root) & 4);
    });
    return candidates[candidates.length - 1] || null;
  }

  function scanHeadings(doc, root, include) {
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(include);
    if (!headings.some(heading => heading.tagName === "H1")) {
      const contextual = contextualPageH1(doc, root);
      if (contextual && (!include || isVisible(contextual))) headings.unshift(contextual);
    }
    return headings;
  }

  function textElements(root, include) {
    const allowed = include || isVisible;
    return Array.from(root.querySelectorAll("p, li, dd, dt, figcaption, blockquote")).filter(allowed);
  }

  function textNodes(root, include) {
    const doc = root.ownerDocument || root;
    const allowed = include || isVisible;
    const walker = doc.createTreeWalker(root, 4);
    const output = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !normalizeSpace(node.nodeValue)) continue;
      if (parent.closest("script,style,noscript,svg,code,pre,nav,[hidden],[aria-hidden='true']")) continue;
      if (allowed(parent)) output.push(node);
    }
    return output;
  }

  function parseColour(value) {
    const match = String(value).match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d*\.?\d+))?\)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
  }

  function composite(foreground, background) {
    const alpha = foreground[3];
    return [
      foreground[0] * alpha + background[0] * (1 - alpha),
      foreground[1] * alpha + background[1] * (1 - alpha),
      foreground[2] * alpha + background[2] * (1 - alpha), 1
    ];
  }

  function backgroundColour(element) {
    let current = element;
    let result = [255, 255, 255, 1];
    const layers = [];
    while (current && current.nodeType === 1) {
      const style = current.ownerDocument.defaultView.getComputedStyle(current);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const colour = parseColour(style.backgroundColor);
      if (colour && colour[3] > 0) layers.unshift(colour);
      current = current.parentElement;
    }
    layers.forEach(layer => { result = composite(layer, result); });
    return result;
  }

  function luminance(colour) {
    const values = colour.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  }

  function contrastRatio(first, second) {
    const one = luminance(first);
    const two = luminance(second);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  }

  function accessibleName(element) {
    const aria = element.getAttribute("aria-label");
    if (normalizeSpace(aria)) return normalizeSpace(aria);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map(id => {
        const label = element.ownerDocument.getElementById(id);
        return label ? label.textContent : "";
      }).join(" ");
      if (normalizeSpace(text)) return normalizeSpace(text);
    }
    if (element.id) {
      const label = Array.from(element.ownerDocument.querySelectorAll("label[for]")).find(item => item.htmlFor === element.id);
      if (label && normalizeSpace(label.textContent)) return normalizeSpace(label.textContent);
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel && normalizeSpace(wrappingLabel.textContent)) return normalizeSpace(wrappingLabel.textContent);
    const childImageText = Array.from(element.querySelectorAll ? element.querySelectorAll("img[alt]") : [])
      .map(image => normalizeSpace(image.alt))
      .filter(Boolean)
      .join(" ");
    if (childImageText) return childImageText;
    const type = (element.getAttribute("type") || "").toLowerCase();
    const controlValue = element.tagName === "INPUT" && /^(?:button|submit|reset)$/.test(type) ? element.value : "";
    return normalizeSpace(element.getAttribute("title") || element.getAttribute("alt") || element.textContent || controlValue || "");
  }

  function endsStylePunctuation(value) {
    const text = normalizeSpace(value);
    if (!text || /\?$/.test(text)) return false;
    if (/(?:B\.C\.|N\.[BLS]\.|P\.E\.I\.)$/.test(text)) return false;
    return /[.!:;]$/.test(text);
  }

  function linkPunctuationIssue(value) {
    const text = normalizeSpace(value);
    if (!text) return "none";
    if (/^[\s,.;:!?…–—()[\]{}'"“”‘’]+$/.test(text)) return "punctuation-only";
    return endsStylePunctuation(text) || /,$/.test(text) ? "terminal" : "none";
  }

  function listEndingNeedsRemoval(value) {
    const text = normalizeSpace(value);
    return /[,;!]$/.test(text) || (endsStylePunctuation(text) && /\.$/.test(text));
  }

  function isLikelyTitleCase(value) {
    const tokens = words(value);
    if (tokens.length < 3) return false;
    const allowed = new Set(["B.C", "BC", "Canada", "Canadian", "Indigenous", "First", "Nations", "Métis", "Inuit"]);
    const formalNameWords = new Set(BUILT_IN_TERMS.flatMap(term => words(term)));
    const capitalized = tokens.slice(1).filter(token => /^[A-Z][a-z]{2,}$/.test(token) && !allowed.has(token) && !formalNameWords.has(token));
    return capitalized.length >= 2 && capitalized.length >= Math.ceil((tokens.length - 1) / 2);
  }

  function firstWords(value, count) {
    return words(value).slice(0, count || 2).join(" ").toLowerCase();
  }

  function acronymDefinedInText(value, acronym) {
    const text = normalizeSpace(value);
    if (!text || !acronym) return false;
    const escaped = escapeRegExp(acronym);
    const parenthetical = new RegExp("\\(\\s*" + escaped + "\\s*\\)").exec(text);
    const firstUse = new RegExp("\\b" + escaped + "\\b").exec(text);
    if (!parenthetical || !firstUse) return false;
    const acronymInsideParentheses = parenthetical.index + parenthetical[0].search(new RegExp(escaped));
    if (firstUse.index !== acronymInsideParentheses) return false;
    const before = text.slice(0, parenthetical.index).trim();
    const longForm = before.match(/([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9’'/-]*(?:\s+(?:&|and|of|the|for|to|in|[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9’'/-]*)){1,12})$/i);
    return Boolean(longForm && words(longForm[1]).length >= 2);
  }

  function acronymDefinedAcrossParts(parts, partIndex, matchIndex, acronym) {
    if (!Array.isArray(parts) || partIndex < 0 || partIndex >= parts.length) return false;
    const current = String(parts[partIndex] || "");
    let end = matchIndex + String(acronym || "").length;
    const closingParenthesis = current.slice(end).match(/^\s*\)/);
    if (closingParenthesis) end += closingParenthesis[0].length;
    const prefix = parts.slice(0, partIndex).concat(current.slice(0, end)).join(" ");
    return acronymDefinedInText(prefix.slice(-600), acronym);
  }

  function doubleSpaceDetails(value) {
    const text = String(value || "");
    const lines = text.split(/\r?\n/);
    let offset = 0;
    for (const line of lines) {
      const match = /\S([ \u00a0\u2007\u202f]{2,})\S/.exec(line);
      if (match) {
        const spacesStart = offset + match.index + 1;
        const count = match[1].length;
        const before = normalizeSpace(text.slice(Math.max(0, spacesStart - 70), spacesStart));
        const after = normalizeSpace(text.slice(spacesStart + count, spacesStart + count + 70));
        return {
          index: spacesStart,
          count,
          evidence: `${before} ⟦${count} spaces⟧ ${after}`.trim()
        };
      }
      offset += line.length + 1;
    }
    return null;
  }

  function anchorIdForHeading(heading) {
    if (!heading) return "";
    if (heading.id) return heading.id;
    const child = heading.querySelector("[id],a[name]");
    if (child) return child.id || child.getAttribute("name") || "";
    const previous = heading.previousElementSibling;
    return previous ? (previous.id || (previous.tagName === "A" ? previous.getAttribute("name") : "") || "") : "";
  }

  function fragmentTarget(doc, href) {
    if (!href || href.charAt(0) !== "#" || href.length < 2) return null;
    let value = href.slice(1);
    try { value = decodeURIComponent(value); } catch (_) {}
    const byId = doc.getElementById(value);
    if (byId) return byId;
    return Array.from(doc.querySelectorAll("a[name],[name]")).find(element => element.getAttribute("name") === value) || null;
  }

  function headingForFragmentTarget(target) {
    if (!target) return null;
    if (/^H[1-6]$/.test(target.tagName)) return target;
    const inside = target.querySelector && target.querySelector("h1,h2,h3,h4,h5,h6");
    if (inside) return inside;
    const closest = target.closest && target.closest("h1,h2,h3,h4,h5,h6");
    if (closest) return closest;
    let sibling = target.nextElementSibling;
    while (sibling && !/^H[1-6]$/.test(sibling.tagName)) sibling = sibling.nextElementSibling;
    return sibling || null;
  }

  function ownText(element) {
    return normalizeSpace(Array.from(element.childNodes || []).filter(node => node.nodeType === 3).map(node => node.nodeValue).join(" "));
  }

  function findOnThisPagePattern(root, include) {
    const candidates = Array.from(root.querySelectorAll("h1,h2,h3,h4,p,div,strong,[aria-label]")).filter(include).filter(element => {
      const label = ownText(element) || normalizeSpace(element.getAttribute && element.getAttribute("aria-label")) || (element.children.length === 0 ? normalizeSpace(element.textContent) : "");
      return /^on this page:?$/i.test(label);
    });
    for (const label of candidates) {
      let container = label.nextElementSibling;
      while (container && !/^(UL|OL|NAV|DIV)$/.test(container.tagName)) container = container.nextElementSibling;
      let links = container ? Array.from(container.querySelectorAll("a[href^='#']")).filter(include) : [];
      if (links.length < 2 && label.parentElement) links = Array.from(label.parentElement.querySelectorAll("a[href^='#']")).filter(include);
      if (links.length >= 2) return {
        label,
        links,
        generated: !/^H[1-6]$/.test(label.tagName) && Boolean(label.closest("nav,[role='navigation'],[class*='jump' i],[class*='toc' i],[class*='table-of-contents' i],[class*='on-this-page' i],[data-component],[data-testid]")),
        text: ownText(label) || normalizeSpace(label.textContent)
      };
    }
    return null;
  }

  function anchorTextScore(first, second) {
    const normalizeAnchorWord = word => {
      const value = word.toLowerCase();
      if (/ies$/.test(value) && value.length > 4) return value.slice(0, -3) + "y";
      if (/s$/.test(value) && !/ss$/.test(value) && value.length > 3) return value.slice(0, -1);
      return value;
    };
    const firstWords = words(first).map(normalizeAnchorWord);
    const secondWords = words(second).map(normalizeAnchorWord);
    if (!firstWords.length || !secondWords.length) return 0;
    if (firstWords.join(" ") === secondWords.join(" ")) return 1;
    const firstSet = new Set(firstWords);
    const secondSet = new Set(secondWords);
    const intersection = Array.from(firstSet).filter(word => secondSet.has(word)).length;
    const union = new Set([...firstSet, ...secondSet]).size;
    return union ? intersection / union : 0;
  }

  function suggestedAnchorForText(value, headingElements) {
    const candidates = (headingElements || []).map(heading => ({
      heading,
      text: normalizeSpace(heading.textContent),
      id: anchorIdForHeading(heading),
      score: anchorTextScore(value, heading.textContent)
    })).filter(item => item.id && item.score >= 0.72).sort((first, second) => second.score - first.score);
    if (!candidates.length) return null;
    if (candidates[1] && candidates[0].score - candidates[1].score < 0.15) return null;
    return candidates[0];
  }

  function assetTypeFromUrl(value) {
    try {
      const pathname = new URL(value, "https://example.invalid").pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      return match && ASSET_TYPES[match[1].toLowerCase()] ? ASSET_TYPES[match[1].toLowerCase()] : "";
    } catch (_) { return ""; }
  }

  function assetLabel(value) {
    const text = normalizeSpace(value);
    const full = text.match(/[\[(](PDF|DOCX?|XLSX?|CSV|PPTX?|RTF|TXT|ODT|ODS|ODP|ZIP),\s*(\d+(?:\.\d{1,2})?)(\s*)(KB|MB|GB)[\])]/i);
    if (full) {
      const status = full[3] ? "size-spacing" : "valid";
      return {
        valid: status === "valid",
        status,
        type: full[1].toUpperCase(),
        size: Number(full[2]),
        unit: full[4].toUpperCase(),
        raw: full[0],
        sizeText: `${full[2]}${full[3]}${full[4]}`,
        replacement: `${full[2]}${full[4]}`
      };
    }
    const typeOnly = text.match(/[\[(](PDF|DOCX?|XLSX?|CSV|PPTX?|RTF|TXT|ODT|ODS|ODP|ZIP)(?:[\])]|,)/i);
    return { valid: false, status: typeOnly ? "missing-size" : "missing-label", type: typeOnly ? typeOnly[1].toUpperCase() : "", size: null, unit: "", raw: typeOnly ? typeOnly[0] : "", sizeText: "", replacement: "" };
  }

  function looksLikeAssetLink(link, href, label) {
    if (assetTypeFromUrl(href) || label.type || link.hasAttribute("download")) return true;
    return /(?:download|attachment|asset|document|file)(?:[/?#=&_-]|$)/i.test(href);
  }

  function isCmsLiteComponent(element) {
    return Boolean(element && element.closest && element.closest(CMS_LITE_COMPONENT_SELECTORS));
  }

  function isCmsLiteTemplateImage(image, profile) {
    if (profile !== "cms-lite" || !image) return false;
    const src = String(image.currentSrc || image.src || (image.getAttribute && image.getAttribute("src")) || "");
    const transparentPixel = /^data:image\/gif;base64,R0lGODlhAQABA/i.test(src);
    const tinyEmbeddedImage = /^data:image\//i.test(src)
      && Number(image.naturalWidth || 0) <= 1
      && Number(image.naturalHeight || 0) <= 1;
    const cmsMoreTopicsIcon = /\/icons\/list\.svg(?:[?#]|$)/i.test(src)
      && (!image.hasAttribute || !image.hasAttribute("alt") || image.alt === "");
    return transparentPixel || tinyEmbeddedImage || cmsMoreTopicsIcon;
  }

  function headingHasStableAnchor(heading) {
    if (!heading) return false;
    if (heading.id) return true;
    if (heading.querySelector("[id],a[name]")) return true;
    const previous = heading.previousElementSibling;
    return Boolean(previous && (previous.id || (previous.tagName === "A" && previous.getAttribute("name"))));
  }

  function metadataDetails(doc) {
    const metaValue = (attribute, value) => {
      const item = doc.querySelector(`meta[${attribute}='${value}' i]`);
      return normalizeSpace(item && item.getAttribute("content"));
    };
    const alternates = Array.from(doc.querySelectorAll("link[rel~='alternate'][hreflang]")).slice(0, 30).map(link => ({
      language: normalizeSpace(link.getAttribute("hreflang")), href: link.href || link.getAttribute("href") || ""
    }));
    const custom = Array.from(doc.querySelectorAll("meta[name],meta[property]")).map(meta => ({
      name: normalizeSpace(meta.getAttribute("name") || meta.getAttribute("property")),
      value: normalizeSpace(meta.getAttribute("content"))
    })).filter(item => item.name && item.value && /^(?:keywords|synonyms|robots|author|dcterms\.|dc\.|article:|og:|twitter:)/i.test(item.name)).slice(0, 80);
    return {
      documentTitle: normalizeSpace(doc.title),
      language: normalizeSpace(doc.documentElement && doc.documentElement.getAttribute("lang")),
      description: metaValue("name", "description"),
      keywords: metaValue("name", "keywords"),
      robots: metaValue("name", "robots"),
      canonical: ((doc.querySelector("link[rel~='canonical']") || {}).href || ""),
      alternates,
      custom,
      jsonLdCount: doc.querySelectorAll("script[type='application/ld+json']").length
    };
  }

  function buildPageDetails(doc, detailRoot, profile, suppliedPageOrder) {
    const pageOrder = suppliedPageOrder || new WeakMap();
    if (!suppliedPageOrder) Array.from(doc.querySelectorAll("*")).forEach((element, index) => pageOrder.set(element, index));
    const headings = scanHeadings(doc, detailRoot, isVisible).slice(0, 500).map(heading => ({
      level: Number(heading.tagName.slice(1)),
      text: normalizeSpace(heading.textContent) || "[No heading text]",
      selector: cssPath(heading),
      pageOrder: pageOrder.get(heading),
      component: profile === "cms-lite" && isCmsLiteComponent(heading),
      flags: []
    }));
    const outlineHeadings = profile === "cms-lite" ? headings.filter(heading => !heading.component) : headings;
    const h1Indexes = outlineHeadings.map((heading, index) => heading.level === 1 ? index : -1).filter(index => index >= 0);
    if (h1Indexes.length > 1) h1Indexes.slice(1).forEach(index => outlineHeadings[index].flags.push("Extra H1"));
    let previousLevel = 0;
    outlineHeadings.forEach(heading => {
      if (previousLevel && heading.level > previousLevel + 1) heading.flags.push(`Skipped H${previousLevel + 1}`);
      if (!heading.text || heading.text === "[No heading text]") heading.flags.push("Empty");
      previousLevel = heading.level;
    });
    const images = Array.from(detailRoot.querySelectorAll("img"))
      .filter(image => isVisible(image) && !isCmsLiteTemplateImage(image, profile))
      .slice(0, 300).map(image => ({
      selector: cssPath(image),
      pageOrder: pageOrder.get(image),
      src: image.currentSrc || image.src || "",
      alt: image.hasAttribute("alt") ? image.alt : "",
      altState: !image.hasAttribute("alt") ? "missing" : (image.alt ? "provided" : "empty"),
      linked: Boolean(image.closest("a"))
    }));
    const links = Array.from(detailRoot.querySelectorAll("a[href]")).filter(isVisible).map(link => ({
      selector: cssPath(link),
      pageOrder: pageOrder.get(link),
      text: accessibleName(link) || "[No accessible name]",
      href: link.href || link.getAttribute("href") || "",
      target: link.target || "",
      location: locationLabel(link, detailRoot),
      kind: /^mailto:/i.test(link.getAttribute("href") || "") ? "email" : /^tel:/i.test(link.getAttribute("href") || "") ? "phone" : assetTypeFromUrl(link.href || link.getAttribute("href") || "") ? "asset" : "web"
    }));
    return {
      headings,
      images,
      links,
      metadata: metadataDetails(doc),
      counts: {
        headings: headings.length,
        images: images.length,
        imagesMissingAlt: images.filter(image => image.altState === "missing").length,
        imagesEmptyAlt: images.filter(image => image.altState === "empty").length,
        links: links.length,
        assets: links.filter(link => link.kind === "asset").length,
        lists: detailRoot.querySelectorAll("ul,ol").length,
        tables: detailRoot.querySelectorAll("table").length,
        forms: detailRoot.querySelectorAll("form").length,
        accordions: detailRoot.querySelectorAll("details,.accordion,[class*='accordion' i],.panel-group").length
      }
    };
  }

  function createExternalFinding(ruleId, pageUrl, supplied) {
    const rule = RULES[ruleId];
    if (!rule) return null;
    const data = supplied || {};
    const source = SOURCES[rule[5]];
    const finding = {
      id: data.id || ruleId + "-external",
      ruleId,
      category: rule[0],
      severity: rule[1],
      responsibility: data.responsibility || (rule[1] === "review" ? "Editorial review" : "Content"),
      title: rule[2],
      why: rule[3],
      suggestion: data.suggestion || rule[4],
      evidence: excerpt(data.evidence || ""),
      selector: data.selector || "",
      sourceLabel: source[0],
      sourceUrl: source[1],
      flaggedToken: data.flaggedToken || "",
      matchText: data.matchText || "",
      replacement: data.replacement || "",
      diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
      suggestedTarget: data.suggestedTarget || "",
      proposedPhrase: "",
      exceptionEligible: false,
      exceptionId: "",
      automaticStatus: "open",
      pageOrder: Number.isFinite(data.pageOrder) ? data.pageOrder : Number.MAX_SAFE_INTEGER,
      occurrenceCount: 1
    };
    finding.location = data.location || "Page";
    finding.fingerprint = findingFingerprint(pageUrl, finding);
    return finding;
  }

  function scanPage(doc, suppliedOptions) {
    const options = suppliedOptions || {};
    const pageUrl = doc.location && doc.location.href ? doc.location.href : "";
    const hostname = (() => { try { return new URL(pageUrl).hostname.toLowerCase(); } catch (_) { return ""; } })();
    const scope = options.scope === "whole" ? "whole" : "content";
    const profile = detectProfile(pageUrl, options.profile || "auto");
    let root;
    if (scope === "whole") root = doc.body;
    else if (options.contentRootSelector) {
      try { root = doc.querySelector(options.contentRootSelector); } catch (_) { root = null; }
    }
    if (!root && profile === "cms-lite") root = doc.querySelector(".topicMain__container, .topicContent__main, #body");
    if (!root) root = doc.querySelector("#post-content, .entry-content, main, [role='main'], article") || doc.body;

    let sectionHeading = null;
    let sectionBoundary = null;
    if (options.sectionSelector && scope === "content") {
      try { sectionHeading = doc.querySelector(options.sectionSelector); } catch (_) { sectionHeading = null; }
      if (sectionHeading && !root.contains(sectionHeading)) sectionHeading = null;
      if (sectionHeading && /^H[1-6]$/.test(sectionHeading.tagName)) {
        const sectionLevel = Number(sectionHeading.tagName.slice(1));
        const allHeadings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"));
        const startIndex = allHeadings.indexOf(sectionHeading);
        sectionBoundary = allHeadings.slice(startIndex + 1).find(heading => Number(heading.tagName.slice(1)) <= sectionLevel) || null;
      } else sectionHeading = null;
    }

    const canControlColour = typeof options.canControlColour === "boolean"
      ? options.canControlColour
      : profile !== "cms-lite";
    const savedExceptions = Array.isArray(options.exceptions) ? options.exceptions : [];
    const issues = [];
    const assets = [];
    const totals = {};
    const perRuleLimit = 25;

    function inScanArea(element) {
      if (!isVisible(element)) return false;
      if (scope === "content" && profile === "cms-lite" && element.closest(CMS_LITE_EXCLUDED_SELECTORS)) return false;
      if (!(root === doc.body || element === root || root.contains(element))) return false;
      if (!sectionHeading) return true;
      if (element === sectionHeading || sectionHeading.contains(element)) return true;
      const afterStart = Boolean(sectionHeading.compareDocumentPosition(element) & 4);
      if (!afterStart) return false;
      if (!sectionBoundary) return true;
      return Boolean(element.compareDocumentPosition(sectionBoundary) & 4);
    }

    const documentOrder = new WeakMap();
    Array.from(doc.querySelectorAll("*")).forEach((element, index) => documentOrder.set(element, index));

    function responsibilityFor(ruleId, rule) {
      if (ruleId === "meta-description") return "CMS setting";
      if (profile === "cms-lite" && ruleId === "phone-link-format") return "CMS setting";
      if (profile === "cms-lite" && ruleId === "text-alignment") return "Template/code";
      if (TEMPLATE_RULES.has(ruleId) || (ruleId === "contrast" && !canControlColour)) return "Template/code";
      if (rule[1] === "review") return "Editorial review";
      return "Content";
    }

    function add(ruleId, element, evidence, detail, metadata) {
      const rule = RULES[ruleId];
      if (!rule) return;
      const meta = metadata || {};
      const rawContext = normalizeSpace(meta.contextText || evidence || (element && element.textContent) || "");
      const matchedException = meta.matchedException || (meta.matchIndex === undefined
        ? savedExceptions.find(item => exceptionMatches(item, ruleId, rawContext, hostname))
        : null);
      totals[ruleId] = (totals[ruleId] || 0) + 1;
      if (totals[ruleId] > perRuleLimit) return;
      const source = SOURCES[rule[5]];
      const finding = {
        id: ruleId + "-" + totals[ruleId],
        ruleId,
        category: rule[0],
        severity: rule[1],
        responsibility: responsibilityFor(ruleId, rule),
        title: rule[2],
        why: rule[3],
        suggestion: detail || rule[4],
        evidence: excerpt(evidence || (element && element.textContent) || ""),
        selector: cssPath(element),
        sourceLabel: source[0],
        sourceUrl: source[1],
        flaggedToken: meta.flaggedToken || "",
        matchText: meta.matchText || meta.flaggedToken || "",
        replacement: meta.replacement || "",
        diagnostics: Array.isArray(meta.diagnostics) ? meta.diagnostics : [],
        suggestedTarget: meta.suggestedTarget || "",
        proposedPhrase: meta.proposedPhrase || "",
        matchIndex: meta.matchIndex,
        exceptionEligible: EXCEPTION_ELIGIBLE_RULES.has(ruleId) && Boolean(meta.flaggedToken),
        exceptionId: matchedException ? matchedException.id : "",
        automaticStatus: matchedException ? "ignored" : "open",
        pageOrder: element && documentOrder.has(element) ? documentOrder.get(element) : Number.MAX_SAFE_INTEGER,
        occurrenceCount: 1
      };
      finding.location = meta.location || locationLabel(element, root);
      finding.fingerprint = findingFingerprint(pageUrl, finding);
      const duplicate = issues.find(item => item.ruleId === finding.ruleId && item.selector === finding.selector && item.evidence === finding.evidence && item.automaticStatus === finding.automaticStatus && (item.matchIndex === undefined ? "" : item.matchIndex) === (finding.matchIndex === undefined ? "" : finding.matchIndex));
      if (duplicate) duplicate.occurrenceCount += 1;
      else issues.push(finding);
    }

    const authoredTitleElement = root.querySelector("h1") || contextualPageH1(doc, root) || doc.querySelector("h1");
    const metadataTitle = normalizeSpace((doc.querySelector("meta[name='title']") || {}).content);
    const title = scope === "content"
      ? normalizeSpace(metadataTitle || (authoredTitleElement && authoredTitleElement.textContent) || doc.title)
      : normalizeSpace(doc.title);
    const titleTarget = scope === "content" ? (authoredTitleElement || root) : (doc.querySelector("title") || doc.documentElement);
    if (!sectionHeading) {
      if (!title) add("page-title-missing", titleTarget, "No page title found");
      if (title.length > 70) add("page-title-long", titleTarget, title + " (" + title.length + " characters)");
      if (title && endsStylePunctuation(title)) add("page-title-punctuation", titleTarget, title);
      if (title && isLikelyTitleCase(title)) add("heading-title-case", titleTarget, title);
      if (profile !== "cms-lite" && !doc.querySelector("meta[name='description'][content]:not([content=''])")) add("meta-description", doc.documentElement, "No metadata description found");
      if (scope === "whole" && !normalizeSpace(doc.documentElement.getAttribute("lang"))) add("document-language", doc.documentElement, "The html element has no lang attribute");
    }

    const headings = sectionHeading
      ? Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(inScanArea)
      : scanHeadings(doc, root, inScanArea);
    const h1s = headings.filter(item => item.tagName === "H1");
    if (!sectionHeading) {
      if (h1s.length === 0) add("h1-count", root, "No H1 heading found");
      else if (h1s.length > 1) h1s.slice(1).forEach((heading, index) => add("h1-count", heading, `Extra H1 ${index + 2} of ${h1s.length}: ${normalizeSpace(heading.textContent)}`));
    }
    let previousLevel = 0;
    headings.forEach(heading => {
      const level = Number(heading.tagName.slice(1));
      const text = normalizeSpace(heading.textContent);
      if (!text) add("heading-empty", heading, "Empty " + heading.tagName);
      if (previousLevel && level > previousLevel + 1) add("heading-skip", heading, heading.tagName + ": " + text, "Change this heading so it follows H" + previousLevel + " without skipping a level.");
      if (level >= 5) add("heading-deep", heading, heading.tagName + ": " + text);
      if (text && endsStylePunctuation(text)) add("heading-punctuation", heading, text);
      if (heading.querySelector("strong,b,em,i,u")) add("heading-formatting", heading, text);
      if (isLikelyTitleCase(text)) add("heading-title-case", heading, text);
      previousLevel = level;
    });

    const h2s = headings.filter(item => item.tagName === "H2");
    const conventionalOnThisPage = headings.find(item => normalizeSpace(item.textContent).replace(/:$/, "").toLowerCase() === "on this page");
    const onThisPagePattern = !sectionHeading ? findOnThisPagePattern(root, inScanArea) : null;
    const onThisPage = conventionalOnThisPage || (onThisPagePattern && onThisPagePattern.label);
    const eligibleH2s = h2s.filter(item => item !== conventionalOnThisPage && (!isCmsLiteComponent(item) || profile !== "cms-lite") && (profile !== "cms-lite" || headingHasStableAnchor(item)));
    if (!sectionHeading && eligibleH2s.length >= 3 && !onThisPagePattern && !conventionalOnThisPage) add("on-this-page-missing", root, eligibleH2s.length + " linkable H2 headings found");
    if (!sectionHeading && onThisPage) {
      const otpText = normalizeSpace(onThisPagePattern ? onThisPagePattern.text : onThisPage.textContent);
      if (!onThisPagePattern || !onThisPagePattern.generated) {
        if (onThisPage.tagName !== "H2" || /:$/.test(otpText)) add("on-this-page-format", onThisPage, onThisPage.tagName + ": " + otpText);
      }
      let links = onThisPagePattern ? onThisPagePattern.links : [];
      if (!links.length) {
        let list = onThisPage.nextElementSibling;
        while (list && !/^(UL|OL|H1|H2)$/.test(list.tagName)) list = list.nextElementSibling;
        links = list && /^(UL|OL)$/.test(list.tagName) ? Array.from(list.querySelectorAll("a[href^='#']")) : [];
      }
      const diagnostics = [];
      const comparedLength = Math.max(links.length, eligibleH2s.length);
      for (let index = 0; index < comparedLength; index += 1) {
        const link = links[index];
        const expectedHeading = eligibleH2s[index];
        if (!link && expectedHeading) {
          diagnostics.push(`Missing link for H2 “${normalizeSpace(expectedHeading.textContent)}” (${anchorIdForHeading(expectedHeading) ? `#${anchorIdForHeading(expectedHeading)}` : "no anchor found"}).`);
          continue;
        }
        if (link && !expectedHeading) {
          diagnostics.push(`Extra link “${normalizeSpace(link.textContent)}” points to ${link.getAttribute("href") || "an empty target"}.`);
          continue;
        }
        const href = link.getAttribute("href") || "";
        const target = fragmentTarget(doc, href);
        const targetHeading = headingForFragmentTarget(target);
        const linkText = normalizeSpace(link.textContent);
        const expectedText = normalizeSpace(expectedHeading.textContent);
        if (comparisonText(linkText) !== comparisonText(expectedText)) diagnostics.push(`Link ${index + 1} says “${linkText}”; the matching H2 says “${expectedText}”.`);
        if (targetHeading !== expectedHeading) {
          const actual = targetHeading ? `${targetHeading.tagName} “${normalizeSpace(targetHeading.textContent)}”` : (target ? `${target.tagName} target` : "a missing target");
          const expectedAnchor = anchorIdForHeading(expectedHeading);
          diagnostics.push(`Link ${index + 1} points to ${href || "an empty target"} (${actual}); expected ${expectedAnchor ? `#${expectedAnchor}` : `the H2 “${expectedText}”`}.`);
        }
      }
      if (diagnostics.length) add("on-this-page-links", onThisPage, `${diagnostics.length} mismatch${diagnostics.length === 1 ? "" : "es"} across ${links.length} links and ${eligibleH2s.length} eligible H2 headings`, null, { diagnostics });
    }

    const elementTexts = textElements(root, inScanArea);
    elementTexts.filter(item => item.tagName === "P").forEach(paragraph => {
      const sentenceList = sentences(paragraph.textContent);
      if (sentenceList.length > 5) add("paragraph-long", paragraph, sentenceList.length + " sentences: " + paragraph.textContent);
      sentenceList.forEach(sentence => {
        const count = words(sentence).length;
        if (count > 20) add("sentence-long", paragraph, count + " words: " + sentence);
        if (/\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?[a-z]+(?:ed|en)\b/i.test(sentence)) add("passive-voice", paragraph, sentence);
      });
    });

    const mainText = normalizeSpace(elementTexts.map(element => element.textContent).join(" "));
    const proseBlocks = elementTexts
      .filter(element => {
        if (element.closest("nav,table,figure,address,[class*='contact' i],[class*='breadcrumb' i]")) return false;
        if (element.tagName === "LI" && words(element.textContent).length < 6) return false;
        return words(element.textContent).length >= 4;
      })
      .map(element => element.textContent)
      .map(normalizeSpace);
    const gradeResult = readingGradeFromBlocks(proseBlocks);
    const grade = gradeResult.grade;
    if (shouldFlagReadingGrade(grade)) add("reading-level", root, "Estimated Flesch–Kincaid grade: " + grade.toFixed(1));

    const nodes = textNodes(root, inScanArea);
    const scanPhrases = (phrases, ruleId) => {
      phrases.forEach(pair => {
        const expression = new RegExp("\\b" + pair[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\b", "i");
        nodes.forEach(node => {
          const match = expression.exec(node.nodeValue);
          if (match) add(ruleId, node.parentElement, node.nodeValue, "Consider ‘" + pair[1] + "’ when it preserves the intended meaning.", {
            matchText: match[0],
            replacement: pair[1],
            contextText: node.nodeValue,
            matchIndex: match.index
          });
        });
      });
    };
    scanPhrases(SIMPLE_PHRASES, "complex-phrase");
    scanPhrases(FILLER_PHRASES, "filler-phrase");

    nodes.forEach(node => {
      const value = node.nodeValue;
      const parent = node.parentElement;
      if (/\b(?:shouldn['’]t|can['’]t|don['’]t|doesn['’]t|isn['’]t|aren['’]t|won['’]t|wouldn['’]t|couldn['’]t|mustn['’]t)\b/i.test(value)) add("negative-contraction", parent, value);
      if (/\b(?:e\.g\.|i\.e\.)/i.test(value)) add("latin-abbreviation", parent, value);
      const approvedRanges = approvedTermRanges(value);
      const bcExpression = /\bBC\b/g;
      let bcMatch;
      while ((bcMatch = bcExpression.exec(value))) {
        if (isInsideRange(bcMatch.index, approvedRanges)) continue;
        const proposal = proposeExactPhrase(value, bcMatch.index, bcMatch[0]);
        add("bc-abbreviation", parent, value, null, {
          flaggedToken: bcMatch[0],
          matchText: bcMatch[0],
          replacement: "B.C.",
          proposedPhrase: proposal,
          contextText: value,
          matchIndex: bcMatch.index,
          matchedException: exceptionAtIndex(savedExceptions, "bc-abbreviation", value, bcMatch.index, hostname)
        });
      }
      if (/[!?;]/.test(value)) {
        if (value.includes("!")) add("exclamation", parent, value);
        if (value.includes(";")) add("semicolon", parent, value);
      }
      if (value.includes("—")) add("em-dash", parent, value);
      if (/\b\d+(?:[:.]\d+)?\s*[–—]\s*\d+(?:[:.]\d+)?\b/.test(value) && !/\b\d{4}[–—-]\d{2}\b/.test(value)) add("range-dash", parent, value);
      const doubleSpace = doubleSpaceDetails(value);
      if (doubleSpace) add("double-space", parent, doubleSpace.evidence, null, {
        matchText: `⟦${doubleSpace.count} spaces⟧`,
        matchIndex: doubleSpace.evidence.indexOf("⟦"),
        diagnostics: ["Browsers normally collapse consecutive spaces on screen; this marker reports the spacing in the published source."]
      });
      if (/\b(?:and\/or|he\/she|she\/he|s\/he|\w+\/\w+)\b/i.test(value) && !/https?:\/\//i.test(value)) add("slash", parent, value);
      if (value.includes("&") && !parent.closest("code,pre")) add("ampersand", parent, value);
      const nonEmailAtText = value
        .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, "")
        .replace(/(^|\s)@[A-Za-z0-9_]{2,}\b/g, "$1");
      if (nonEmailAtText.includes("@")) add("at-symbol", parent, value, null, { matchText: "@", matchIndex: value.indexOf("@") });
      const capitals = /\b(?:[A-Z][A-Z’'\-]{1,}\s+){1,}[A-Z][A-Z’'\-]{1,}\b/.exec(value);
      if (capitals && words(capitals[0]).some(word => !isWellKnownAcronym(word))) add("all-caps", parent, value, null, {
        matchText: capitals[0],
        matchIndex: capitals.index
      });
      if (/\b(?:Jan|Feb|Aug|Sept?|Oct|Nov|Dec)\.?\s+\d{1,2}\b/i.test(value) && !parent.closest("table,form")) add("month-abbreviation", parent, value);
      if (/\b(?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01])[\/.-](?:\d{2}|\d{4})\b/.test(value) && !parent.closest("table,form")) add("numeric-date", parent, value);
      if (/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)\b/i.test(value)) add("ordinal-date", parent, value);
      if (/\b(?:1[0-2]|0?[1-9]):00\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(value) || /\b\d{1,2}(?::\d{2})?\s*(?:A\.?M\.?|P\.?M\.?)\b/.test(value) || /\b\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.)\b/i.test(value)) add("time-format", parent, value);
      if (/\b12\s+(?:noon|midnight)\b/i.test(value)) add("noon-midnight", parent, value);
      if (/\b\d+(?:\.\d+)?\s*(?:inches?|feet|foot|yards?|miles?|pounds?|ounces?|fahrenheit|°F)\b/i.test(value)) add("imperial-unit", parent, value);
      if (/\b\d+(?:\.\d+)?(?:km|kg|mL|mm|cm)\b/.test(value)) add("metric-spacing", parent, value);
      if (/\b\d+(?:\.\d+)?\s+(?:kms|kgs|cms|mms)\b/i.test(value)) add("metric-plural", parent, value);
      if (/\b\d+(?:\.\d+)?\s+°[cC]\b/.test(value) || /\b\d+(?:\.\d+)?°c\b/.test(value)) add("celsius-format", parent, value);
      if (/\b\d+(?:\.\d+)?%/.test(value) && !parent.closest("table,figure")) add("percent-symbol", parent, value);
      if (/[¼½¾⅓⅔⅛⅜⅝⅞]/.test(value)) add("fraction-symbol", parent, value);
    });

    const firstAcronymOccurrences = new Map();
    const acronymTextParts = nodes.map(node => node.nodeValue || "");
    nodes.forEach((node, nodeIndex) => {
      const expression = /\b[A-Z][A-Z0-9]{1,5}s?\b/g;
      let match;
      while ((match = expression.exec(node.nodeValue))) {
        if (!firstAcronymOccurrences.has(match[0])) firstAcronymOccurrences.set(match[0], { node, nodeIndex, index: match.index });
      }
    });
    firstAcronymOccurrences.forEach((occurrence, acronym) => {
      if (isWellKnownAcronym(acronym)) return;
      if (/^[A-Z]\d[A-Z]$/.test(acronym)) return;
      const parent = occurrence.node.parentElement;
      const element = parent.closest("h1,h2,h3,h4,h5,h6,p,li,dd,dt,figcaption,blockquote") || parent;
      const elementText = normalizeSpace(element.textContent || occurrence.node.nodeValue || acronym);
      if (acronymDefinedInText(elementText, acronym) || acronymDefinedAcrossParts(acronymTextParts, occurrence.nodeIndex, occurrence.index, acronym)) return;
      const termIndex = Math.max(0, elementText.indexOf(acronym));
      add("undefined-acronym", element || root, `First use: ${elementText}`, null, {
        flaggedToken: acronym,
        matchText: acronym,
        proposedPhrase: proposeExactPhrase(elementText, termIndex, acronym),
        contextText: elementText,
        matchIndex: termIndex,
        diagnostics: [`No earlier definition in the form “full term (${acronym})” was found in the scanned content.`],
        matchedException: exceptionAtIndex(savedExceptions, "undefined-acronym", elementText, termIndex, hostname)
      });
    });

    headings.forEach(heading => {
      if (/\b(?:frequently asked questions|FAQs?)\b/i.test(heading.textContent) || /\?$/.test(normalizeSpace(heading.textContent))) add("faq-content", heading, heading.textContent);
    });

    const links = Array.from(root.querySelectorAll("a[href]")).filter(inScanArea);
    links.forEach(link => {
      const linkText = accessibleName(link);
      const href = link.getAttribute("href") || "";
      const absoluteHref = link.href || href;
      if (!linkText && !link.querySelector("img")) add("empty-link", link, href);
      if (/^(?:click here|here|read more|learn more|more|this link|link)$/i.test(linkText)) add("generic-link", link, linkText);
      if (/^(?:https?:\/\/|www\.)\S+$/i.test(linkText)) add("url-link-text", link, linkText);
      if (words(linkText).length > 15) add("long-link-text", link, linkText);
      if (link.target && link.target.toLowerCase() === "_blank") add("new-tab", link, linkText || href);
      if (/news\.gov\.bc\.ca|\/news-releases?\//i.test(href)) add("news-release-link", link, linkText || href);
      if (/^mailto:/i.test(href)) {
        const address = decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0]);
        if (linkText.toLowerCase() !== address.toLowerCase()) add("email-link-text", link, linkText + " → " + address);
      }
      if (/^tel:/i.test(href) && !/^tel:\+1-\d{3}-\d{3}-\d{4}$/i.test(href)) add("phone-link-format", link, href);
      const label = assetLabel(linkText);
      const expectedType = assetTypeFromUrl(absoluteHref);
      if (looksLikeAssetLink(link, absoluteHref, label)) {
        assets.push({
          href: absoluteHref,
          text: linkText,
          selector: cssPath(link),
          expectedType,
          declaredType: label.type,
          declaredSize: label.size,
          declaredUnit: label.unit,
          validLabel: label.valid,
          labelStatus: label.status,
          verificationStatus: "not-checked"
        });
        if (label.status === "size-spacing") add("file-link-size-spacing", link, linkText || href, null, {
          flaggedToken: label.sizeText,
          matchText: label.sizeText,
          replacement: label.replacement,
          matchIndex: Math.max(0, (linkText || "").indexOf(label.sizeText))
        });
        else if ((expectedType || label.type || link.hasAttribute("download")) && !label.valid) add("file-link-label", link, linkText || href);
      }
      const punctuationIssue = linkPunctuationIssue(linkText);
      if (punctuationIssue === "punctuation-only") add("punctuation-only-link", link, linkText);
      else if (punctuationIssue === "terminal") add("linked-period", link, linkText);
      if (href.startsWith("#") && href.length > 1) {
        const target = fragmentTarget(doc, href);
        if (!target) {
          const suggestion = suggestedAnchorForText(linkText, headings);
          add("broken-anchor", link, linkText + " → " + href,
            suggestion ? `Change the target to #${suggestion.id}, which is attached to the heading “${suggestion.text}”.` : null,
            suggestion ? { suggestedTarget: `#${suggestion.id}`, diagnostics: [`Matching heading found: “${suggestion.text}”.`] } : null);
        }
      }
    });

    textNodes(root, inScanArea).forEach(node => {
      const phoneMatches = node.nodeValue.match(/(?:\+?1[-. (]*)?\d{3}[-. )]+\d{3}[-. ]+\d{4}/g) || [];
      phoneMatches.forEach(phone => {
        if (!node.parentElement.closest("a[href^='tel:']")) add("phone-unlinked", node.parentElement, phone);
        const display = normalizeSpace(phone).replace(/^\+1-/, "1-");
        if (!/^(?:1-)?\d{3}-\d{3}-\d{4}$/.test(display)) add("phone-display-format", node.parentElement, phone);
      });
    });

    const lists = Array.from(root.querySelectorAll("ul,ol")).filter(inScanArea);
    lists.forEach(list => {
      let depth = 1;
      let ancestor = list.parentElement && list.parentElement.closest("ul,ol");
      while (ancestor) { depth += 1; ancestor = ancestor.parentElement && ancestor.parentElement.closest("ul,ol"); }
      if (depth > 2) add("list-depth", list, "List depth: " + depth);
      const items = Array.from(list.children).filter(item => item.tagName === "LI");
      if (items.length > 7) add("list-long", list, items.length + " items");
      items.forEach(item => {
        const ownText = normalizeSpace(Array.from(item.childNodes).filter(node => node.nodeType === 3 || !/^(UL|OL)$/.test(node.tagName || "")).map(node => node.textContent).join(" "));
        if (listEndingNeedsRemoval(ownText)) add("list-punctuation", item, ownText);
        if (/^[a-zà-öø-ÿ]/.test(ownText)) add("list-lowercase", item, ownText);
      });
      const linkDirectory = items.length > 0 && items.every(item => {
        const itemLinks = item.querySelectorAll("a");
        return itemLinks.length === 1 && normalizeSpace(item.textContent) === normalizeSpace(itemLinks[0].textContent);
      });
      if (!linkDirectory) {
        const openings = items.map(item => firstWords(item.textContent, 2)).filter(Boolean);
        const repeated = openings.find((opening, index) => openings.indexOf(opening) !== index);
        if (repeated && items.length >= 2) add("list-repetition", list, "Repeated opening: ‘" + repeated + "’");
      }
    });

    Array.from(root.querySelectorAll("table")).filter(inScanArea).forEach(table => {
      if (!table.querySelector("th")) add("table-headers", table, excerpt(table.textContent));
      if (!table.querySelector("caption")) add("table-caption", table, excerpt(table.textContent));
      if (table.closest("details,[class*='accordion' i],[class*='collapse' i]")) add("table-accordion", table, excerpt(table.textContent));
    });

    Array.from(root.querySelectorAll("strong,b")).filter(inScanArea).forEach(element => {
      if (element.parentElement && element.parentElement.closest("strong,b")) return;
      if (element.closest("figure,figcaption,[class*='chart' i],[role='img']")) return;
      if (element.closest("a")) { add("bold-link", element, element.textContent); return; }
      let nearby = element.parentElement;
      let levels = 0;
      while (nearby && levels < 4 && !nearby.querySelector("figure")) { nearby = nearby.parentElement; levels += 1; }
      if (nearby && levels < 4 && nearby.querySelector("figure")) return;
      if (element.closest("h1,h2,h3,h4,h5,h6") || words(element.textContent).length > 12) add("bold-block", element, element.textContent);
    });
    Array.from(root.querySelectorAll("em,i")).filter(inScanArea).forEach(element => add("italics", element, element.textContent));
    Array.from(root.querySelectorAll("s,strike,del")).filter(inScanArea).forEach(element => add("strikethrough", element, element.textContent));
    Array.from(root.querySelectorAll("u")).filter(inScanArea).forEach(element => {
      if (!element.closest("a")) add("underline", element, element.textContent);
    });

    const aligned = new Set();
    if (scope === "whole" || profile !== "cms-lite") {
      Array.from(root.querySelectorAll("p,li,h1,h2,h3,h4,blockquote")).filter(inScanArea).forEach(element => {
        const alignment = doc.defaultView.getComputedStyle(element).textAlign;
        if ((alignment === "center" || alignment === "right") && !element.closest("th,td,caption")) {
          const key = alignment + ":" + normalizeSpace(element.textContent).slice(0, 30);
          if (!aligned.has(key)) { aligned.add(key); add("text-alignment", element, alignment + " aligned: " + element.textContent); }
        }
      });
    }

    Array.from(root.querySelectorAll("img")).filter(inScanArea).filter(image => !isCmsLiteTemplateImage(image, profile)).forEach(image => {
      if (!image.hasAttribute("alt")) add("image-alt-missing", image, image.currentSrc || image.src || "Image");
      else if (image.alt === "") add("image-alt-empty", image, image.currentSrc || image.src || "Image with empty alt text");
      if (image.complete && image.naturalWidth === 0 && (image.currentSrc || image.src)) add("broken-image", image, image.currentSrc || image.src);
      const imageLink = image.closest("a");
      if (imageLink && !accessibleName(imageLink)) add("linked-image-alt", image, image.alt || image.currentSrc || image.src);
    });

    Array.from(root.querySelectorAll("a[href],img[src],source[src]")).filter(inScanArea).forEach(element => {
      const value = element.href || element.currentSrc || element.src || element.getAttribute("href") || element.getAttribute("src") || "";
      let host = "";
      try { host = new URL(value, pageUrl).hostname.toLowerCase(); } catch (_) {}
      if (/^(?:staging|stage|dev)\./.test(host) || /\.staging\./.test(host)) add("staging-url", element, value);
    });

    if (scope === "whole") {
      const mains = Array.from(doc.querySelectorAll("main,[role='main']")).filter(isVisible);
      if (mains.length === 0) add("main-landmark", doc.body, "No main content landmark found");
      const skipLinks = Array.from(doc.querySelectorAll("a[href^='#']")).filter(isVisible).filter(link => /skip/i.test(accessibleName(link))).slice(0, 5);
      skipLinks.forEach(link => {
        if (!fragmentTarget(doc, link.getAttribute("href") || "")) add("skip-link-target", link, `${accessibleName(link)} → ${link.getAttribute("href") || "empty target"}`);
      });
      Array.from(doc.querySelectorAll("button[aria-controls]")).filter(isVisible).forEach(button => {
        if (!/^(true|false)$/.test(button.getAttribute("aria-expanded") || "")) add("disclosure-state", button, accessibleName(button) || excerpt(button.outerHTML, 120));
      });
    }

    if (scope === "whole" || profile !== "cms-lite") {
      Array.from(root.querySelectorAll("input:not([type='hidden']),select,textarea,button")).filter(inScanArea).forEach(control => {
        if (!accessibleName(control)) add("form-label", control, control.outerHTML.slice(0, 180));
      });
    }

    const contrastSeen = new Set();
    if (scope === "whole" || canControlColour) {
      Array.from(root.querySelectorAll("p,li,a,button,label,h1,h2,h3,h4,th,td,figcaption")).filter(inScanArea).slice(0, 500).forEach(element => {
        if (!normalizeSpace(element.textContent)) return;
        const style = doc.defaultView.getComputedStyle(element);
        const foreground = parseColour(style.color);
        const background = backgroundColour(element);
        if (!foreground || !background || foreground[3] === 0) return;
        const effectiveForeground = composite(foreground, background);
        const ratio = contrastRatio(effectiveForeground, background);
        const size = parseFloat(style.fontSize) || 16;
        const weight = Number(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400);
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const required = large ? 3 : 4.5;
        const key = style.color + "/" + background.slice(0, 3).map(Math.round).join(",") + "/" + required;
        if (ratio + 0.02 < required && !contrastSeen.has(key)) {
          contrastSeen.add(key);
          add("contrast", element, "Estimated contrast " + ratio.toFixed(2) + ":1 (minimum " + required.toFixed(1) + ":1): " + element.textContent);
        }
      });
    }

    const severityOrder = { fix: 0, check: 1, review: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    const severityCounts = { fix: 0, check: 0, review: 0 };
    issues.filter(issue => issue.automaticStatus === "open").forEach(issue => {
      severityCounts[issue.severity] += issue.occurrenceCount || 1;
    });
    const pageDetails = buildPageDetails(doc, root, profile, documentOrder);

    return {
      ruleVersion: RULE_VERSION,
      scannedAt: new Date().toISOString(),
      page: { title: title || "Untitled page", url: pageUrl, hostname },
      settings: {
        scope,
        profile,
        profileLabel: profileLabel(profile),
        canControlColour,
        rootSelector: cssPath(root),
        sectionSelector: sectionHeading ? cssPath(sectionHeading) : "",
        sectionLabel: sectionHeading ? normalizeSpace(sectionHeading.textContent) : ""
      },
      stats: {
        words: words(mainText).length,
        sentences: gradeResult.sentences,
        readingWords: gradeResult.words,
        readingGrade: grade === null ? null : Number(grade.toFixed(1)),
        headings: headings.length,
        links: links.length,
        images: Array.from(root.querySelectorAll("img")).filter(inScanArea).filter(image => !isCmsLiteTemplateImage(image, profile)).length,
        root: root === doc.body ? "body" : root.tagName.toLowerCase()
      },
      severityCounts,
      issues,
      assets,
      pageDetails,
      totals,
      manualChecks: MANUAL_CHECKS.map((item, index) => ({ id: "manual-" + index, title: item[0], question: item[1], sourceUrl: item[2] })),
      notes: Object.values(totals).some(value => value > perRuleLimit) ? "Repeated findings are capped at 25 examples per rule." : ""
    };
  }

  global.BCWebStyleGuideChecker = {
    scanPage,
    createExternalFinding,
    ruleVersion: RULE_VERSION,
    builtInTerms: BUILT_IN_TERMS.slice(),
    exceptionEligibleRules: Array.from(EXCEPTION_ELIGIBLE_RULES),
    helpers: {
      normalizeSpace,
      comparisonText,
      words,
      sentences,
      syllables,
      readingGrade,
      readingGradeFromBlocks,
      shouldFlagReadingGrade,
      assetLabel,
      assetTypeFromUrl,
      endsStylePunctuation,
      linkPunctuationIssue,
      listEndingNeedsRemoval,
      acronymDefinedInText,
      acronymDefinedAcrossParts,
      isWellKnownAcronym,
      doubleSpaceDetails,
      anchorTextScore,
      contrastRatio,
      isLikelyTitleCase,
      approvedTermRanges,
      proposeExactPhrase,
      validateExceptionPhrase,
      exceptionMatches,
      exceptionAtIndex,
      builtInTermAtIndex,
      isCmsLiteTemplateImage,
      findingFingerprint,
      canonicalUrl,
      detectProfile,
      hashString
    }
  };
})(globalThis);
