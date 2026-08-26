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
    "heading-dash": ["Headings", "check", "Rewrite the heading without a dash", "The guide says not to use hyphens, en dashes or em dashes to separate ideas in headings and page titles.", "Rewrite the heading as one clear phrase. Keep hyphens that form compound words, such as ‘long-term’.", "headings"],
    "heading-parentheses": ["Headings", "check", "Check the parentheses in the heading", "Parentheses in headings and page titles are reserved for acronyms.", "Remove the parentheses or confirm they contain an acronym that helps the audience.", "headings"],
    "heading-colon-case": ["Headings", "check", "Capitalize after the colon", "When a heading uses a colon, the first word after it starts with a capital letter and the rest stays in sentence case.", "Capitalize the first word after the colon and review the rest of the heading for sentence case.", "headings"],
    "heading-formatting": ["Headings", "fix", "Remove formatting from the heading", "Heading tags already provide the required emphasis.", "Remove bold, italic or underline formatting inside the heading.", "headings"],
    "heading-title-case": ["Headings", "review", "Check sentence case", "Headings and page titles should use sentence case, with capitals reserved for proper nouns and defined acronyms.", "Confirm each capitalized word is a proper noun or acronym; otherwise use lower case.", "headings"],
    "acronym-in-heading": ["Headings", "review", "Check the acronym in the heading", "Acronyms in headings and ‘On this page’ navigation should be familiar to the audience. Public-facing headings need the clearest wording.", "Use the full term when the acronym may be unclear to the intended audience.", "abbreviations"],
    "on-this-page-missing": ["Headings", "review", "Consider an ‘On this page’ section", "Pages with 3 or more H2 headings may be easier to navigate with an ‘On this page’ section.", "Add an H2 called ‘On this page’ with a bulleted list of links to the other H2 headings if it helps people scan.", "headings"],
    "on-this-page-format": ["Headings", "fix", "Fix the ‘On this page’ heading", "‘On this page’ should be an H2 and should not use a colon.", "Use the exact H2 text ‘On this page’.", "headings"],
    "on-this-page-links": ["Headings", "fix", "Match ‘On this page’ links to H2 headings", "The links should match the page’s H2 headings in text and order and should not target H3 or H4 headings.", "Update the link text, target or order to match the H2 headings.", "headings"],
    "paragraph-long": ["Plain language", "check", "Break up the paragraph", "The guide recommends 5 sentences or fewer per paragraph.", "Keep one topic per paragraph and move a new topic into a new paragraph.", "plain"],
    "sentence-long": ["Plain language", "check", "Shorten the sentence", "The guide recommends a maximum of 15 to 20 words per sentence.", "Split the sentence into single-subject sentences.", "plain"],
    "reading-level": ["Plain language", "review", "Review the reading level", "The guide targets Grade 8. The checker raises this review finding at Grade 9 or higher.", "Simplify sentence structure and replace complex words where meaning allows. The displayed grade is an estimate.", "plain"],
    "complex-phrase": ["Plain language", "check", "Consider a simpler phrase", "The guide recommends common, everyday words.", "Use the suggested plain-language wording when it preserves the intended meaning.", "plain"],
    "filler-phrase": ["Plain language", "check", "Cut unnecessary words", "Extra words make content slower to scan.", "Use the shorter wording suggested by the guide.", "plain"],
    "passive-voice": ["Plain language", "review", "Check for passive voice", "Passive wording can make it unclear who is responsible. The highlighted words may be only one passive part of an otherwise clear sentence.", "Name the person or organization doing the action when that improves clarity. For example, change ‘Applications can be sent by email’ to ‘Send applications by email.’", "grammar"],
    "negative-contraction": ["Plain language", "check", "Avoid a negative contraction", "Negative contractions can be misread as their opposite.", "Write out the negative form, such as ‘do not’ or ‘cannot’.", "grammar"],
    "undefined-acronym": ["Plain language", "review", "Define the acronym on first use", "Write a term in full the first time, followed by its abbreviation in parentheses, unless the short form is widely better known.", "Define it on first use or confirm it is better known than the long form.", "abbreviations"],
    "bc-abbreviation": ["Capitalization", "check", "Write B.C. with periods", "The province abbreviation uses periods except in brand and company names.", "Change ‘BC’ to ‘B.C.’ unless it is part of a formal brand such as BC Hydro or BC Ferries.", "abbreviations"],
    "province-abbreviation": ["Capitalization", "check", "Check the province or territory abbreviation", "N.B., N.L., N.S., N.T. and P.E.I. use periods in B.C. government content.", "Add the required periods when this abbreviation names a province or territory.", "abbreviations"],
    "government-capitalization": ["Capitalization", "check", "Use lower case for ‘government’", "Use lower case for government in general or descriptive references. Capitalize it only as part of a full formal name.", "Use ‘government’ unless the complete phrase is an official name, such as ‘Government of British Columbia’.", "capitalization"],
    "government-generic-term": ["Capitalization", "check", "Check the government term’s capitalization", "Generic references such as ‘the ministry’, ‘the cabinet’ and ‘the B.C. legislature’ use lower case.", "Use lower case unless the wording is part of a full formal name.", "capitalization"],
    "parliament-buildings": ["Capitalization", "check", "Capitalize ‘Parliament Buildings’", "Parliament Buildings is capitalized when it refers to the provincial or federal buildings.", "Write ‘Parliament Buildings’ when this phrase names the official buildings.", "capitalization"],
    "crown-capitalization": ["Capitalization", "check", "Capitalize ‘Crown’", "Capitalize Crown in terms such as Crown land, Crown counsel and Crown corporation.", "Capitalize ‘Crown’ when the phrase refers to the state.", "capitalization"],
    "latin-abbreviation": ["Plain language", "fix", "Replace the Latin abbreviation", "The guide says not to use ‘e.g.’ or ‘i.e.’.", "Use ‘such as’, ‘like’ or ‘for example’.", "abbreviations"],
    "canadian-spelling": ["Plain language", "check", "Use Canadian spelling", "B.C. government content uses Canadian spelling.", "Use the suggested Canadian spelling unless the wording is part of an official name or quotation.", "grammar"],
    "canadian-spelling-context": ["Plain language", "review", "Check the Canadian spelling", "In Canadian usage, ‘licence’ is the noun and ‘license’ is the verb; ‘practice’ is the noun and ‘practise’ is the verb.", "Confirm the word's role in the sentence, then use the Canadian noun or verb form.", "grammar"],
    "formal-sentence-starter": ["Plain language", "check", "Use a simpler sentence opening", "Formal transitions such as ‘furthermore’, ‘therefore’ and ‘heretofore’ can make web content harder to scan.", "Start the sentence directly or use a simpler connection.", "grammar"],
    "academic-degree-case": ["Capitalization", "review", "Check the academic degree capitalization", "Academic titles and degree types use lower case in running text, while proper nouns within the name stay capitalized.", "Use lower case for the degree type unless this is an official title that must keep its capitalization.", "capitalization"],
    "academic-title": ["Capitalization", "review", "Confirm the academic title", "The guide reserves ‘Dr.’ for medical doctors. The checker cannot determine a person’s profession from the page.", "Keep ‘Dr.’ only for a medical doctor or where an official name or quotation must be preserved.", "capitalization"],
    "grade-capitalization": ["Capitalization", "review", "Capitalize ‘Grade’ in education content", "Capitalize Grade when it comes before a number or letter in education-related content.", "Use ‘Grade’ when this refers to a school grade. Leave other meanings, such as a product grade or road slope, unchanged.", "capitalization"],
    "faq-content": ["Content design", "review", "Restructure FAQ content", "The guide recommends integrating answers under topic-based headings because FAQs are difficult to scan and maintain.", "Group the information by topic and replace question headings with descriptive headings.", "faq"],
    "generic-link": ["Links", "fix", "Write descriptive link text", "Link text needs to make sense without the surrounding sentence.", "Name the destination or task. For example, replace ‘Click here’ with ‘Apply for a fishing licence.’", "links"],
    "empty-link": ["Links", "fix", "Give the link an accessible name", "A link without a name gives people no information about its destination.", "Add descriptive text or an accessible label.", "links"],
    "url-link-text": ["Links", "check", "Replace the URL with descriptive link text", "People scan links to understand where they lead.", "Use the destination name or the task someone can complete.", "links"],
    "long-link-text": ["Links", "review", "Shorten the link text", "The guide advises against linking long sentences or blocks of text.", "Link only the concise words that describe the destination.", "links"],
    "new-tab": ["Links", "review", "Confirm the link needs a new tab", "Links should open in the same tab by default. A new tab can make sense when preserving an in-progress task or secure session.", "Change the link setting so it opens in the same tab, unless a new tab helps someone keep an in-progress form or secure session open.", "links"],
    "news-release-link": ["Links", "review", "Check the news release link", "News release links can become stale and should generally be replaced after 30 days.", "Link to maintained, static content where possible and confirm this news release remains necessary.", "links"],
    "email-link-text": ["Links", "fix", "Use the email address as link text", "The guide says an email link should display the email address.", "Use the full email address as the linked text.", "links"],
    "phone-unlinked": ["Links", "fix", "Link the phone number", "Phone numbers should be clickable.", "Wrap the number in a tel link using international dialling format.", "links"],
    "phone-link-format": ["Links", "fix", "Fix the phone link", "Telephone links should use international dialling format.", "Use a value such as tel:+1-250-555-0123.", "links"],
    "file-link-label": ["Links", "fix", "Add the file type and size", "Document link text should tell people the file type and size before they open it. A type on its own, such as ‘(PDF)’, is not enough.", "Add a label such as ‘(PDF, 504KB)’ to the linked text.", "links"],
    "file-link-label-format": ["Links", "fix", "Fix the file type and size label", "A document label needs a comma after the file type and no space between the size and unit.", "Use the format ‘(PDF, 159KB)’ or the equivalent for this file.", "links"],
    "file-link-size-spacing": ["Links", "fix", "Remove the space in the file size", "File sizes use no space between the number and unit.", "Remove the space between the number and unit, such as changing ‘271 KB’ to ‘271KB’.", "links"],
    "link-trailing-space": ["Links", "fix", "Remove the trailing space from the link", "A space at the end of linked text creates an unnecessarily large link area and can make editing less predictable.", "Remove the space at the end of the linked text.", "formatting"],
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
    "list-long": ["Lists", "review", "Consider grouping the list", "A list with more than 7 items can be harder to scan and remember.", "Group related items under clear headings or split the list into shorter lists when that helps people find what they need.", "lists"],
    "list-introduction": ["Lists", "check", "Introduce the list with a colon", "The guide says to introduce a list with a colon.", "Add a colon when the preceding sentence introduces this list, or confirm that the paragraph and list are separate.", "lists"],
    "list-multiple-sentences": ["Lists", "check", "Shorten the list item", "List items are easiest to scan when they contain one sentence. A second sentence may be necessary in some cases.", "Keep one main idea in the item, or confirm that the additional sentence is necessary.", "lists"],
    "list-repetition": ["Lists", "review", "Remove repeated openings", "Repeated words at the start of list items delay the distinguishing information, especially for screen reader users.", "Move the unique information to the beginning of each item.", "lists"],
    "table-headers": ["Tables", "fix", "Add table headers", "Tables need programmatic headers so people can understand the relationships in the data.", "Use th elements for row or column headings.", "tables"],
    "table-caption": ["Tables", "review", "Check the table has a useful caption", "A short caption can make the purpose of tabular data clearer.", "Add a concise caption when the surrounding heading does not already identify the table.", "tables"],
    "table-accordion": ["Tables", "fix", "Move the table out of the accordion", "The guide says never to use tables in accordions.", "Place the table in the main page content.", "formatting"],
    "month-abbreviation": ["Numbers and dates", "check", "Write out the month", "Month names should be written in full when space is available.", "Use the full month name in body content.", "numbers"],
    "numeric-date": ["Numbers and dates", "check", "Write out the date", "Numeric dates are reserved for space-limited forms and tables and should use YYYY-MM-DD.", "Use a format such as ‘August 13, 2026’ in body content.", "numbers"],
    "ordinal-date": ["Numbers and dates", "fix", "Remove the ordinal from the date", "Dates should not use ordinals.", "Write ‘January 18, 2003’, not ‘January 18th, 2003’.", "numbers"],
    "ordinal-word": ["Numbers and dates", "check", "Write out the ordinal", "Ordinal numbers under 10 are written as words in body content.", "Write ‘first’ to ‘ninth’ unless space is limited or the number appears in a chart, table or form.", "numbers"],
    "time-format": ["Numbers and dates", "check", "Fix the time format", "Whole hours should omit :00, and am and pm use lower case without periods.", "Use ‘9 am’ for a whole hour or ‘9:45 pm’ when minutes are needed.", "numbers"],
    "time-zone": ["Numbers and dates", "check", "Use the general time zone", "Do not use standard or daylight time in web content. Use a general zone name or abbreviation instead.", "Use wording such as ‘Pacific time’ or an abbreviation such as ‘PT’ after a clock time.", "numbers"],
    "noon-midnight": ["Numbers and dates", "fix", "Use ‘noon’ or ‘midnight’", "The guide says to write noon and midnight without the number 12.", "Remove ‘12’ from ‘12 noon’ or ‘12 midnight’.", "numbers"],
    "phone-display-format": ["Numbers and dates", "fix", "Use hyphens in the phone number", "Phone numbers use hyphens between digit groups.", "Use a format such as 250-555-0123 or 1-800-555-0123.", "numbers"],
    "imperial-unit": ["Numbers and dates", "review", "Use a metric measurement", "The guide requires metric measurements.", "Convert the measurement to the appropriate metric unit unless the original unit is required for technical context.", "numbers"],
    "metric-spacing": ["Numbers and dates", "fix", "Add a space before the unit", "Measurements use a space between the number and unit, except temperatures.", "Add a space, such as ‘30 km’.", "numbers"],
    "metric-plural": ["Numbers and dates", "fix", "Use the singular unit abbreviation", "Metric unit abbreviations do not take a plural ‘s’.", "Use ‘100 km’, not ‘100 kms’.", "numbers"],
    "celsius-format": ["Numbers and dates", "fix", "Fix the Celsius format", "Temperatures use no space and a capital C: 18°C.", "Remove the space and use the °C symbol.", "numbers"],
    "percent-symbol": ["Numbers and dates", "check", "Spell out ‘percent’ in body text", "The % symbol is intended for financial charts, tables, equations and calculations.", "Use ‘percent’ in a sentence unless the content is a calculation or financial data.", "numbers"],
    "fraction-symbol": ["Numbers and dates", "check", "Write out the fraction", "Fractions without a whole number should usually be written in words.", "Use wording such as ‘half’, ‘a quarter’ or ‘two-thirds’.", "numbers"],
    "currency-cents": ["Numbers and dates", "fix", "Write the amount in cents", "Amounts under one dollar are written as cents rather than as a decimal dollar amount.", "Write the amount as cents, such as ‘75 cents’.", "numbers"],
    "currency-trailing-zeros": ["Numbers and dates", "check", "Remove unnecessary decimal zeros", "Only include decimals in a monetary amount when precision is required.", "Remove ‘.00’ unless the content needs that precision.", "numbers"],
    "currency-comma": ["Numbers and dates", "fix", "Add a comma to the monetary amount", "Use commas in monetary amounts over $999.", "Add the thousands separator, such as ‘$15,000’.", "numbers"],
    "currency-range": ["Numbers and dates", "fix", "Use ‘to’ for the monetary range", "Monetary ranges use the word ‘to’ rather than a hyphen or dash.", "Write the range using ‘to’, such as ‘$200 to $400’.", "numbers"],
    "ampersand": ["Punctuation", "review", "Check the ampersand", "The guide says to write ‘and’ except in business names and citations.", "Replace & with ‘and’ unless it is part of a formal name or citation.", "punctuation"],
    "missing-space-after-ampersand": ["Punctuation", "fix", "Add the missing space", "A word that follows an ampersand needs a separating space.", "Add a space after the ampersand, then replace the ampersand with ‘and’ unless it is part of a formal name or citation.", "punctuation"],
    "semicolon": ["Punctuation", "fix", "Replace the semicolon", "The guide recommends 2 sentences instead of a semicolon.", "Split the sentence at the semicolon.", "punctuation"],
    "exclamation": ["Punctuation", "fix", "Remove the exclamation mark", "Government web content should use a calm, direct tone.", "Use a period or rewrite the sentence.", "punctuation"],
    "em-dash": ["Punctuation", "fix", "Replace the em dash", "The guide recommends shorter sentences instead of em dashes.", "Split the sentence or use commas when appropriate.", "punctuation"],
    "range-dash": ["Punctuation", "check", "Use ‘to’ for the range", "Number, date and time ranges should use the word ‘to’ instead of a dash.", "Replace the dash with ‘to’, such as ‘May 15 to July 31’, unless this is a fiscal year.", "punctuation"],
    "slash": ["Punctuation", "check", "Replace the slash", "Slashes should be limited to URLs because forms such as ‘and/or’ can create ambiguity.", "Write the relationship explicitly.", "punctuation"],
    "apostrophe-plural": ["Punctuation", "review", "Check the apostrophe in the plural", "Apostrophes do not normally form plurals. They may instead show possession or omitted digits.", "Remove the apostrophe when this is a plural. Keep it when it correctly shows possession or omitted digits.", "punctuation"],
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
    "image-alt-length": ["Accessibility", "review", "Review the alternative text length", "The guide recommends concise alternative text and suggests staying under 15 words.", "Shorten the alternative text when the same purpose or information can be communicated more clearly.", "graphics"],
    "image-alt-prefix": ["Accessibility", "check", "Remove the redundant alt text opening", "Screen readers already announce an image, so alternative text does not need to begin with ‘image of’ or ‘photo of’.", "Start with the information or purpose communicated by the image.", "graphics"],
    "linked-image-alt": ["Accessibility", "fix", "Describe the linked image destination", "The alt text of a linked image should say where the link goes or what it does.", "Replace empty or filename-based alt text with the destination or action.", "graphics"],
    "form-label": ["Accessibility", "fix", "Label the form control", "People need a programmatic label to understand a form control.", "Associate a visible label or accessible name with the control.", "formatting"],
    "contrast": ["Accessibility", "check", "Check the colour contrast", "Text needs sufficient contrast against its background.", "Adjust the foreground or background colour. Verify overlays and images with a dedicated contrast tool.", "contrast"]
  };

  const RULE_VERSION = "1.2.0";

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
    "BCID",
    "Government Communications and Public Engagement",
    "Government Agents",
    "Government House"
  ].sort((first, second) => second.length - first.length);

  const EXCEPTION_ELIGIBLE_RULES = new Set([
    "bc-abbreviation",
    "undefined-acronym",
    "complex-phrase",
    "province-abbreviation",
    "government-capitalization",
    "government-generic-term",
    "canadian-spelling",
    "canadian-spelling-context",
    "academic-degree-case",
    "academic-title",
    "acronym-in-heading"
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
    "[data-elastic-exclude]",
    "[class*='feedback' i]",
    "nav",
    "footer",
    "[role='navigation']",
    "[class*='breadcrumb' i]",
    "[class*='more-topics' i]"
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
    "PST", "GST", "HST", "HR", "HRU", "HRUs", "GUID", "GUIDs", "IM", "IT", "MCP", "KB", "MB", "GB",
    "NB", "NL", "NS", "NT", "PEI", "AB", "MB", "NU", "ON", "QC", "SK", "YT",
    ...Object.values(ASSET_TYPES)
  ]);

  const COMMON_ROMAN_NUMERALS = new Set([
    "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"
  ]);

  const POSTAL_ACRONYMS = new Set(["STN", "PROV", "GOVT"]);

  const INTRANET_HEADING_ACRONYMS = new Set(["PSA", "BCGEU"]);

  const PROVINCE_ABBREVIATIONS = {
    NB: "N.B.", NL: "N.L.", NS: "N.S.", NT: "N.T.", PEI: "P.E.I."
  };

  const CANADIAN_SPELLINGS = {
    advisor: "adviser", defense: "defence", fulfill: "fulfil", offense: "offence"
  };

  const TIME_ZONE_REPLACEMENTS = {
    PST: "PT", PDT: "PT", MST: "MT", MDT: "MT", CST: "CT", CDT: "CT",
    EST: "ET", EDT: "ET", AST: "AT", ADT: "AT", NST: "NT", NDT: "NT"
  };

  const IRREGULAR_PARTICIPLES = new Set([
    "made", "sent", "built", "held", "paid", "put", "set", "told", "kept", "sold", "found",
    "brought", "lost", "left", "meant", "dealt", "felt", "read", "shown", "drawn", "known", "given", "taken", "written"
  ]);

  const ADJECTIVAL_PARTICIPLES = new Set([
    "based", "located", "committed", "limited", "interested", "involved", "related"
  ]);

  function isWellKnownAcronym(value) {
    return WELL_KNOWN_ACRONYMS.has(String(value || ""));
  }

  function isCommonRomanNumeral(value) {
    return COMMON_ROMAN_NUMERALS.has(String(value || ""));
  }

  function isPostalAcronymContext(value, context, element) {
    if (!POSTAL_ACRONYMS.has(String(value || ""))) return false;
    if (element && element.closest && element.closest("address")) return true;
    const text = normalizeSpace(context).toUpperCase();
    return /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/.test(text)
      || /\b(?:PO|P\.O\.)\s+BOX\s+\d+\b/.test(text)
      || /\bSTN\s+PROV\s+GOVT\b/.test(text);
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
    ["a number of", "some, many or few"], ["approximately", "about"],
    ["aggregate", "total"], ["amongst", "among"], ["as a consequence of", "because"], ["assist", "help"],
    ["collaborate", "work with"], ["concerning", "about"], ["disburse", "pay"], ["discontinue", "stop"],
    ["dispatch", "send"], ["documentation", "documents"], ["due to the fact", "because"],
    ["give consideration to", "think about or consider"], ["in accordance with", "in line with"],
    ["initiative", "program, project or plan"], ["in the absence of", "without"], ["in the event of", "if or when"],
    ["in relation to", "about"], ["is able to", "can"],
    ["it should be noted", "remember"], ["submit an application", "apply"], ["method", "way"],
    ["obtain", "get"], ["prior to", "before"], ["subsequently", "after"], ["utilize", "use"],
    ["establish", "create, set up or form"], ["identify", "decide on or know"],
    ["require", "need or must"], ["result in", "cause, make or lead to"], ["upon", "on"]
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
      "apply", "check", "choose", "contact", "find", "get", "government", "however", "if", "it", "learn", "next", "people", "read", "the", "these", "they", "this", "those", "to", "use", "we", "when", "you"
    ]);
    const protectPeriods = value => value.replace(/\./g, placeholder);
    let protectedText = clean
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, protectPeriods)
      .replace(/\b(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+/gi, match => {
        const trailing = (match.match(/[.!?]+$/) || [""])[0];
        const address = trailing ? match.slice(0, -trailing.length) : match;
        return protectPeriods(address) + trailing;
      })
      .replace(/\b\d+\.\d+\b/g, protectPeriods)
      .replace(/\b(?:Mr|Mrs|Ms|Dr|St|Mt|No)\./g, match => match.replace(".", placeholder));
    protectedText = protectedText.replace(/\b(?:[A-Za-z]\.){2,}/g, (initialism, offset, source) => {
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

  function isEnglishLanguage(value) {
    const language = normalizeSpace(value).toLowerCase();
    return !language || language === "en" || language.startsWith("en-");
  }

  function passiveVoiceParticiple(value) {
    const expression = /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?([a-z]+)\b/gi;
    let match;
    while ((match = expression.exec(String(value || "")))) {
      const participle = match[1].toLowerCase();
      if (ADJECTIVAL_PARTICIPLES.has(participle)) continue;
      if (IRREGULAR_PARTICIPLES.has(participle) || /(?:ed|en)$/.test(participle)) return { text: match[0], index: match.index, participle };
    }
    return null;
  }

  function isSentenceInitial(value, index) {
    const before = String(value || "").slice(0, index);
    return !normalizeSpace(before) || /[.!?]\s*[“”‘’'"(\[]*\s*$/.test(before);
  }

  function headingStructureDetails(value) {
    const text = normalizeSpace(value);
    const parentheses = [...text.matchAll(/\(([^()]*)\)/g)].find(match => !/^[A-Z][A-Z0-9.-]{1,9}s?$/.test(normalizeSpace(match[1])));
    const dash = /[–—]|\s-\s/.exec(text);
    const colon = /:\s*([a-zà-öø-ÿ])/.exec(text);
    return { dash, parentheses, colon };
  }

  function measurementDetails(value) {
    const text = String(value || "");
    const plural = /\b(\d+(?:\.\d+)?)\s*(kms|kgs|mLs|Ls|mms|cms|hs|ts)\b/g.exec(text);
    if (plural) {
      const base = plural[2].slice(0, -1);
      return { ruleId: "metric-plural", text: plural[0], index: plural.index, replacement: `${plural[1]} ${base}` };
    }
    const spacing = /\b(\d+(?:\.\d+)?)(km|kg|mL|L|mm|cm|h|t)\b/g.exec(text);
    if (spacing) return { ruleId: "metric-spacing", text: spacing[0], index: spacing.index, replacement: `${spacing[1]} ${spacing[2]}` };
    return null;
  }

  function educationContext(value) {
    return /\b(?:student|school|class(?:room)?|curricul\w*|educat\w*|teacher|learning|course|university|college|kindergarten|enrol\w*|graduate|academic)\b/i.test(String(value || ""));
  }

  function academicDegreeDetails(value) {
    const match = /\b(Master|Bachelor|Doctorate)(?=\s+of\b)/g.exec(String(value || ""));
    if (!match) return null;
    return {
      text: match[1],
      index: match.index,
      replacement: match[1].toLowerCase()
    };
  }

  function canadianSpellingContextDetails(value) {
    const text = String(value || "");
    const expression = /\b(?:license|practice)\b/gi;
    let match;
    while ((match = expression.exec(text))) {
      const lower = match[0].toLowerCase();
      const before = text.slice(Math.max(0, match.index - 50), match.index);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
      if (lower === "license") {
        const likelyVerb = /\b(?:to|can|could|may|might|must|shall|should|will|would|we|you|they|people|government|ministry)\s+$/i.test(before);
        const likelyNoun = /\b(?:a|an|the|your|their|driver|business|fishing|hunting|liquor|marriage|vehicle|professional|occupational|software)\s+$/i.test(before)
          || /^\s+(?:application|fee|holder|number|renewal|requirement)\b/i.test(after);
        if (likelyNoun && !likelyVerb) return { text: match[0], index: match.index, replacement: "licence", role: "likely noun" };
      } else {
        const likelyVerb = isSentenceInitial(text, match.index)
          || /\b(?:to|can|could|may|might|must|shall|should|will|would|we|you|they|people|applicants|students)\s+$/i.test(before);
        if (likelyVerb) return { text: match[0], index: match.index, replacement: "practise", role: "likely verb" };
      }
    }
    return null;
  }

  function isLikelyStreetAbbreviation(value, titleIndex, parent) {
    if (parent && parent.closest && parent.closest("address,[class*='address' i]")) return true;
    const before = String(value || "").slice(0, titleIndex);
    return /\b\d+[A-Za-z]?(?:[-–]\d+[A-Za-z]?)?\s+(?:[NSEW]\.?\s+)?(?:[A-ZÀ-ÖØ-Þ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9’'.-]*\s+){1,5}$/u.test(before);
  }

  function formattedCurrency(value) {
    return Number(value).toLocaleString("en-CA", { maximumFractionDigits: 0, useGrouping: true });
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
      if (parent.closest("script,style,noscript,svg,code,pre,nav")) continue;
      if (parent.closest("[hidden],[aria-hidden='true']") && !allowed(parent)) continue;
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
    if (/(?:B\.C\.|N\.[BLST]\.|P\.E\.I\.)$/.test(text)) return false;
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
    if (tokens.length < 2) return false;
    const allowed = new Set(["B.C", "BC", "British", "Columbia", "Canada", "Canadian", "Indigenous", "First", "Nations", "Métis", "Inuit"]);
    const formalNameWords = new Set(BUILT_IN_TERMS.flatMap(term => words(term)));
    const capitalized = tokens.slice(1).filter(token => /^[A-Z][a-z]{2,}$/.test(token) && !allowed.has(token) && !formalNameWords.has(token));
    return capitalized.length >= 1 && capitalized.length >= Math.ceil((tokens.length - 1) / 2);
  }

  function firstWords(value, count) {
    return words(value).slice(0, count || 2).join(" ").toLowerCase();
  }

  function acronymBase(value) {
    const text = String(value || "");
    return /[A-Z0-9]s$/.test(text) ? text.slice(0, -1) : text;
  }

  function exactTokenIndex(value, token) {
    const text = String(value || "");
    const expression = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9])(" + escapeRegExp(token) + ")(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9])");
    const match = expression.exec(text);
    return match ? match.index + match[1].length : -1;
  }

  function acronymDefinedInText(value, acronym) {
    const text = normalizeSpace(value);
    if (!text || !acronym) return false;
    const base = acronymBase(acronym);
    const escaped = escapeRegExp(base);
    const plural = String(acronym || "").endsWith("s") ? "s?" : "";
    const parenthetical = new RegExp("\\(\\s*" + escaped + plural + "\\s*\\)").exec(text);
    const firstUse = new RegExp("(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9])(" + escaped + plural + ")(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ0-9])").exec(text);
    if (!parenthetical || !firstUse) return false;
    const acronymInsideParentheses = parenthetical.index + parenthetical[0].search(new RegExp(escaped));
    if (firstUse.index + firstUse[1].length !== acronymInsideParentheses) return false;
    const before = text.slice(0, parenthetical.index).trim();
    const longForm = before.match(/([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9.’'/-]*(?:\s+(?:&|and|of|the|for|to|in|[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9.’'/-]*)){1,12})$/i);
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
    const malformed = text.match(/([\[(])(PDF|DOCX?|XLSX?|CSV|PPTX?|RTF|TXT|ODT|ODS|ODP|ZIP)\s+(\d+(?:\.\d{1,2})?)\s*(KB|MB|GB)([\])])/i);
    if (malformed) {
      return {
        valid: false,
        status: "label-format",
        type: malformed[2].toUpperCase(),
        size: Number(malformed[3]),
        unit: malformed[4].toUpperCase(),
        raw: malformed[0],
        sizeText: `${malformed[3]}${malformed[4]}`,
        replacement: `${malformed[1]}${malformed[2].toUpperCase()}, ${malformed[3]}${malformed[4].toUpperCase()}${malformed[5]}`
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

  function cmsLiteComponentLabel(element) {
    const component = element && element.closest && element.closest(CMS_LITE_COMPONENT_SELECTORS);
    if (!component) return "";
    const label = component.querySelector("summary,h2,h3,h4,[aria-controls],[class*='title' i],[class*='heading' i]");
    return normalizeSpace(label && label.textContent);
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
    const includeDetail = element => {
      if (profile === "cms-lite" && element.closest && element.closest(CMS_LITE_EXCLUDED_SELECTORS)) return false;
      return isVisible(element) || (profile === "cms-lite" && isCmsLiteComponent(element));
    };
    const headings = scanHeadings(doc, detailRoot, includeDetail).slice(0, 500).map(heading => ({
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
      .filter(image => includeDetail(image) && !isCmsLiteTemplateImage(image, profile))
      .slice(0, 300).map(image => ({
      selector: cssPath(image),
      pageOrder: pageOrder.get(image),
      src: image.currentSrc || image.src || "",
      alt: image.hasAttribute("alt") ? image.alt : "",
      altState: !image.hasAttribute("alt") ? "missing" : (image.alt ? "provided" : "empty"),
      linked: Boolean(image.closest("a"))
    }));
    const links = Array.from(detailRoot.querySelectorAll("a[href]")).filter(includeDetail).map(link => ({
      selector: cssPath(link),
      pageOrder: pageOrder.get(link),
      text: accessibleName(link) || "[No accessible name]",
      href: link.href || link.getAttribute("href") || "",
      target: link.target || "",
      location: (profile === "cms-lite" ? cmsLiteComponentLabel(link) : "") || locationLabel(link, detailRoot),
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
    const documentLanguage = normalizeSpace(doc.documentElement && doc.documentElement.getAttribute("lang"));
    const englishLanguage = isEnglishLanguage(documentLanguage);
    const intranetProfile = ["intranet.gov.bc.ca", "intranet.qa.gov.bc.ca"].includes(hostname);
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
      const collapsedCmsLiteContent = scope === "content" && profile === "cms-lite" && isCmsLiteComponent(element);
      if (!isVisible(element) && !collapsedCmsLiteContent) return false;
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
      finding.location = meta.location || (profile === "cms-lite" ? cmsLiteComponentLabel(element) : "") || locationLabel(element, root);
      finding.fingerprint = findingFingerprint(pageUrl, finding);
      const duplicate = issues.find(item => item.ruleId === finding.ruleId && item.selector === finding.selector && item.evidence === finding.evidence && item.automaticStatus === finding.automaticStatus && (item.matchIndex === undefined ? "" : item.matchIndex) === (finding.matchIndex === undefined ? "" : finding.matchIndex));
      if (duplicate) duplicate.occurrenceCount += 1;
      else issues.push(finding);
    }

    function inspectHeadingText(element, text) {
      if (!englishLanguage || !text) return;
      const structure = headingStructureDetails(text);
      if (structure.dash) add("heading-dash", element, text, null, {
        matchText: structure.dash[0].trim(),
        matchIndex: structure.dash.index
      });
      if (structure.parentheses) add("heading-parentheses", element, text, null, {
        matchText: structure.parentheses[0],
        matchIndex: structure.parentheses.index
      });
      if (structure.colon) add("heading-colon-case", element, text, null, {
        matchText: structure.colon[0],
        replacement: structure.colon[0].replace(structure.colon[1], structure.colon[1].toUpperCase()),
        matchIndex: structure.colon.index
      });

      const headingAcronyms = [...text.matchAll(/\b[A-Z][A-Z0-9]{1,5}\b/g)]
        .filter(match => !isWellKnownAcronym(match[0]))
        .filter(match => !(intranetProfile && INTRANET_HEADING_ACRONYMS.has(match[0])))
        .filter(match => !/^[A-Z]\d[A-Z]$/.test(match[0]));
      headingAcronyms.forEach(match => add("acronym-in-heading", element, text, null, {
        flaggedToken: match[0],
        matchText: match[0],
        proposedPhrase: proposeExactPhrase(text, match.index, match[0]),
        contextText: text,
        matchIndex: match.index,
        matchedException: exceptionAtIndex(savedExceptions, "acronym-in-heading", text, match.index, hostname)
      }));
    }

    const authoredTitleElement = root.querySelector("h1") || contextualPageH1(doc, root) || doc.querySelector("h1");
    const metadataTitle = normalizeSpace((doc.querySelector("meta[name='title']") || {}).content);
    const title = scope === "content"
      ? normalizeSpace(metadataTitle || (authoredTitleElement && authoredTitleElement.textContent) || doc.title)
      : normalizeSpace(doc.title);
    const titleTarget = scope === "content" ? (authoredTitleElement || root) : (doc.querySelector("title") || doc.documentElement);
    const titleIsAuthoredH1 = Boolean(authoredTitleElement && titleTarget === authoredTitleElement);
    if (!sectionHeading) {
      if (!title) add("page-title-missing", titleTarget, "No page title found");
      if (title.length >= 70) add("page-title-long", titleTarget, title + " (" + title.length + " characters)");
      if (englishLanguage && title && endsStylePunctuation(title)) add("page-title-punctuation", titleTarget, title);
      if (englishLanguage && title && isLikelyTitleCase(title)) add("heading-title-case", titleTarget, title);
      inspectHeadingText(titleTarget, title);
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
      if (englishLanguage && text && endsStylePunctuation(text)) add("heading-punctuation", heading, text);
      const nestedFormatting = Array.from(heading.querySelectorAll("strong,b,em,i,u")).map(item => {
        if (/^(STRONG|B)$/.test(item.tagName)) return "bold";
        if (/^(EM|I)$/.test(item.tagName)) return "italic";
        return "underline";
      });
      const formattingTypes = Array.from(new Set(nestedFormatting));
      if (formattingTypes.length) add("heading-formatting", heading, text, null, {
        diagnostics: [`Formatting found inside this heading: ${formattingTypes.join(", ")}.`]
      });
      if (englishLanguage && isLikelyTitleCase(text) && !(titleIsAuthoredH1 && heading === titleTarget)) add("heading-title-case", heading, text);
      inspectHeadingText(heading, text);
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
      const linkedH2s = new Set();
      links.forEach((link, index) => {
        const href = link.getAttribute("href") || "";
        const target = fragmentTarget(doc, href);
        const targetHeading = headingForFragmentTarget(target);
        const linkText = normalizeSpace(link.textContent);
        if (!targetHeading) {
          diagnostics.push(`Link ${index + 1}, “${linkText}”, points to ${href || "an empty target"}, but no heading exists there.`);
          return;
        }
        const targetText = normalizeSpace(targetHeading.textContent);
        if (targetHeading.tagName !== "H2") {
          diagnostics.push(`Link ${index + 1}, “${linkText}”, points to ${targetHeading.tagName} “${targetText}”. ‘On this page’ links should point to H2 headings.`);
          return;
        }
        if (!eligibleH2s.includes(targetHeading)) {
          diagnostics.push(`Link ${index + 1}, “${linkText}”, points to H2 “${targetText}”, which is not an eligible authored section heading.`);
          return;
        }
        if (linkedH2s.has(targetHeading)) diagnostics.push(`Link ${index + 1} repeats the link to H2 “${targetText}”.`);
        linkedH2s.add(targetHeading);
        const expectedPosition = eligibleH2s.indexOf(targetHeading);
        if (expectedPosition !== index) diagnostics.push(`Link ${index + 1}, “${linkText}”, points to H2 “${targetText}”, which is section ${expectedPosition + 1} in page order.`);
        if (comparisonText(linkText) !== comparisonText(targetText)) diagnostics.push(`Link ${index + 1} says “${linkText}”; its H2 says “${targetText}”.`);
      });
      eligibleH2s.forEach(heading => {
        if (!linkedH2s.has(heading)) diagnostics.push(`Missing link for H2 “${normalizeSpace(heading.textContent)}” (${anchorIdForHeading(heading) ? `#${anchorIdForHeading(heading)}` : "no anchor found"}).`);
      });
      if (diagnostics.length) add("on-this-page-links", onThisPage, `${diagnostics.length} mismatch${diagnostics.length === 1 ? "" : "es"} across ${links.length} links and ${eligibleH2s.length} eligible H2 headings`, null, { diagnostics });
    }

    const elementTexts = textElements(root, inScanArea);
    elementTexts.filter(item => item.tagName === "P").forEach(paragraph => {
      if (!englishLanguage) return;
      const sentenceList = sentences(paragraph.textContent);
      if (sentenceList.length > 5) add("paragraph-long", paragraph, sentenceList.length + " sentences: " + paragraph.textContent);
      sentenceList.forEach(sentence => {
        const count = words(sentence).length;
        if (count > 20) add("sentence-long", paragraph, count + " words: " + sentence);
        const passive = passiveVoiceParticiple(sentence);
        if (passive) add("passive-voice", paragraph, sentence, null, {
          matchText: passive.text,
          matchIndex: passive.index
        });
        const formalOpening = /^[\s“”‘’'"(\[]*(furthermore|therefore|heretofore)\b/i.exec(sentence);
        if (formalOpening) add("formal-sentence-starter", paragraph, sentence, null, {
          matchText: formalOpening[1],
          matchIndex: formalOpening.index
        });
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
    const gradeResult = englishLanguage ? readingGradeFromBlocks(proseBlocks) : { grade: null, words: 0, sentences: 0 };
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
    if (englishLanguage) {
      scanPhrases(SIMPLE_PHRASES, "complex-phrase");
      scanPhrases(FILLER_PHRASES, "filler-phrase");
    }

    nodes.forEach(node => {
      const value = node.nodeValue;
      const parent = node.parentElement;
      if (!englishLanguage) return;
      if (/\b(?:ain|aren|can|couldn|daren|didn|doesn|don|hadn|hasn|haven|isn|mightn|mustn|needn|shan|shouldn|wasn|weren|won|wouldn)['’]t\b/i.test(value)) add("negative-contraction", parent, value);
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

      const provinceExpression = /\b(?:NB|NL|NS|NT|PEI)\b/g;
      let provinceMatch;
      while ((provinceMatch = provinceExpression.exec(value))) {
        const precedingProvinceContext = value.slice(Math.max(0, provinceMatch.index - 20), provinceMatch.index);
        if (provinceMatch[0] === "NT" && /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*$/i.test(precedingProvinceContext)) continue;
        const replacement = PROVINCE_ABBREVIATIONS[provinceMatch[0]];
        add("province-abbreviation", parent, value, null, {
          flaggedToken: provinceMatch[0],
          matchText: provinceMatch[0],
          replacement,
          proposedPhrase: proposeExactPhrase(value, provinceMatch.index, provinceMatch[0]),
          contextText: value,
          matchIndex: provinceMatch.index,
          matchedException: exceptionAtIndex(savedExceptions, "province-abbreviation", value, provinceMatch.index, hostname)
        });
      }

      const approvedGovernmentRanges = approvedTermRanges(value);
      const bcGovernmentExpression = /\bB\.C\.\s+Government\b(?!\s+of\b)/g;
      let bcGovernmentMatch;
      while ((bcGovernmentMatch = bcGovernmentExpression.exec(value))) {
        const governmentIndex = bcGovernmentMatch.index + bcGovernmentMatch[0].lastIndexOf("Government");
        add("government-capitalization", parent, value, null, {
          flaggedToken: "Government",
          matchText: "Government",
          replacement: "government",
          proposedPhrase: "B.C. Government",
          contextText: value,
          matchIndex: governmentIndex,
          diagnostics: ["‘B.C. government’ is a descriptive reference, not the full formal name ‘Government of British Columbia’."],
          matchedException: exceptionAtIndex(savedExceptions, "government-capitalization", value, governmentIndex, hostname)
        });
      }
      const governmentExpression = /\bGovernment\b/g;
      let governmentMatch;
      while ((governmentMatch = governmentExpression.exec(value))) {
        if (/B\.C\.\s+$/.test(value.slice(Math.max(0, governmentMatch.index - 8), governmentMatch.index))) continue;
        if (isSentenceInitial(value, governmentMatch.index)) continue;
        if (isInsideRange(governmentMatch.index, approvedGovernmentRanges)) continue;
        const after = value.slice(governmentMatch.index + governmentMatch[0].length);
        if (/^\s+of\s+(?:the\s+)?[A-ZÀ-ÖØ-Þ]/.test(after)) continue;
        if (/^\s+(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Way)\b/.test(after)) continue;
        add("government-capitalization", parent, value, null, {
          flaggedToken: governmentMatch[0],
          matchText: governmentMatch[0],
          replacement: "government",
          proposedPhrase: proposeExactPhrase(value, governmentMatch.index, governmentMatch[0]),
          contextText: value,
          matchIndex: governmentMatch.index,
          matchedException: exceptionAtIndex(savedExceptions, "government-capitalization", value, governmentMatch.index, hostname)
        });
      }

      const genericGovernmentPatterns = [
        /\b(?:[Tt]he|[Aa])\s+(Cabinet|B\.C\. Legislature|Provincial Parliament|Ministry)\b/g,
        /\b(Ministry [Dd]epartments?)\b/g,
        /\b(?:[Aa]\s+)?(Speech from the [Tt]hrone|Throne [Ss]peech)\b/g
      ];
      genericGovernmentPatterns.forEach(expression => {
        let match;
        while ((match = expression.exec(value))) {
          const term = match[1];
          if (/^Ministry$/.test(term) && /^\s+of\s+[A-ZÀ-ÖØ-Þ]/.test(value.slice(match.index + match[0].length))) continue;
          const termIndex = match.index + match[0].indexOf(term);
          add("government-generic-term", parent, value, null, {
            flaggedToken: term,
            matchText: term,
            replacement: term.toLowerCase(),
            proposedPhrase: proposeExactPhrase(value, termIndex, term),
            contextText: value,
            matchIndex: termIndex,
            matchedException: exceptionAtIndex(savedExceptions, "government-generic-term", value, termIndex, hostname)
          });
        }
      });

      const parliamentBuildings = /\b[Pp]arliament buildings\b/g.exec(value);
      if (parliamentBuildings) add("parliament-buildings", parent, value, null, {
        matchText: parliamentBuildings[0], replacement: "Parliament Buildings", matchIndex: parliamentBuildings.index
      });
      const crownTerm = /\bcrown\s+(?:land|counsel|corporation)\b/g.exec(value);
      if (crownTerm) add("crown-capitalization", parent, value, null, {
        matchText: crownTerm[0], replacement: crownTerm[0].replace(/^crown/, "Crown"), matchIndex: crownTerm.index
      });

      const canadianExpression = /\b(?:advisor|defense|fulfill|offense)\b/gi;
      let canadianMatch;
      while ((canadianMatch = canadianExpression.exec(value))) {
        const replacementBase = CANADIAN_SPELLINGS[canadianMatch[0].toLowerCase()];
        const replacement = /^[A-Z]/.test(canadianMatch[0]) ? replacementBase[0].toUpperCase() + replacementBase.slice(1) : replacementBase;
        add("canadian-spelling", parent, value, null, {
          flaggedToken: canadianMatch[0],
          matchText: canadianMatch[0],
          replacement,
          proposedPhrase: proposeExactPhrase(value, canadianMatch.index, canadianMatch[0]),
          contextText: value,
          matchIndex: canadianMatch.index,
          matchedException: exceptionAtIndex(savedExceptions, "canadian-spelling", value, canadianMatch.index, hostname)
        });
      }

      const contextualCanadianMatch = canadianSpellingContextDetails(value);
      if (contextualCanadianMatch) {
        add("canadian-spelling-context", parent, value, null, {
          flaggedToken: contextualCanadianMatch.text,
          matchText: contextualCanadianMatch.text,
          replacement: contextualCanadianMatch.replacement,
          diagnostics: [`This use appears to be a ${contextualCanadianMatch.role}; confirm it from the full sentence.`],
          proposedPhrase: proposeExactPhrase(value, contextualCanadianMatch.index, contextualCanadianMatch.text),
          contextText: value,
          matchIndex: contextualCanadianMatch.index,
          matchedException: exceptionAtIndex(savedExceptions, "canadian-spelling-context", value, contextualCanadianMatch.index, hostname)
        });
      }

      const gradeMatch = /\bgrade\s+(?:\d+|[A-K])\b/g.exec(value);
      if (gradeMatch && educationContext(parent.textContent || value)) add("grade-capitalization", parent, value, null, {
        matchText: gradeMatch[0], replacement: gradeMatch[0].replace(/^grade/, "Grade"), matchIndex: gradeMatch.index
      });
      const degreeMatch = academicDegreeDetails(value);
      if (degreeMatch && parent.closest("p,li,dd,dt,blockquote")) add("academic-degree-case", parent, value, null, {
        flaggedToken: degreeMatch.text,
        matchText: degreeMatch.text,
        replacement: degreeMatch.replacement,
        proposedPhrase: degreeMatch.text,
        contextText: value,
        matchIndex: degreeMatch.index,
        matchedException: exceptionAtIndex(savedExceptions, "academic-degree-case", value, degreeMatch.index, hostname)
      });
      const doctorMatch = /\bDr\.\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ’'-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ’'-]+){0,2}/g.exec(value);
      if (doctorMatch && !isLikelyStreetAbbreviation(value, doctorMatch.index, parent)) add("academic-title", parent, value, null, {
        flaggedToken: doctorMatch[0],
        matchText: doctorMatch[0],
        proposedPhrase: doctorMatch[0],
        contextText: value,
        matchIndex: doctorMatch.index,
        matchedException: exceptionAtIndex(savedExceptions, "academic-title", value, doctorMatch.index, hostname)
      });
      if (/[!?;]/.test(value)) {
        if (value.includes("!")) add("exclamation", parent, value);
        if (value.includes(";")) {
          const semanticContainer = parent.closest("li,h1,h2,h3,h4,h5,h6");
          const terminalSemicolonHandledElsewhere = semanticContainer && /;\s*$/.test(normalizeSpace(semanticContainer.textContent));
          if (!terminalSemicolonHandledElsewhere) add("semicolon", parent, value);
        }
      }
      if (value.includes("—") && !parent.closest("h1,h2,h3,h4,h5,h6")) add("em-dash", parent, value);
      const numericRange = /\b\d+(?:[:.]\d+)?\s*[–—]\s*\d+(?:[:.]\d+)?\b/.test(value);
      const monthRange = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[–—-]\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{1,2}\b/i.test(value);
      const fiscalYear = /\b\d{4}[–—-]\d{2}\b/.test(value);
      const currencyRangePresent = /(?:US)?\$\d[\d,.]*\s*[-–—]\s*(?:US)?\$?\d/.test(value);
      if ((numericRange || monthRange) && !fiscalYear && !currencyRangePresent) add("range-dash", parent, value);
      const doubleSpace = doubleSpaceDetails(value);
      if (doubleSpace) add("double-space", parent, doubleSpace.evidence, null, {
        matchText: `⟦${doubleSpace.count} spaces⟧`,
        matchIndex: doubleSpace.evidence.indexOf("⟦"),
        diagnostics: ["Browsers normally collapse consecutive spaces on screen; this marker reports the spacing in the published source."]
      });
      const slashMatch = /\b(?:and\/or|he\/she|she\/he|his\/her|her\/his|he\/him|she\/her|s\/he)\b/i.exec(value);
      if (slashMatch) add("slash", parent, value, null, { matchText: slashMatch[0], matchIndex: slashMatch.index });
      const joinedAmpersand = /&([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,})/.exec(value);
      if (joinedAmpersand && !parent.closest("code,pre")) add("missing-space-after-ampersand", parent, value, null, {
        matchText: joinedAmpersand[0], replacement: `& ${joinedAmpersand[1]}`, matchIndex: joinedAmpersand.index
      });
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
      const septemberAbbreviation = /\bSept\.?\s+\d{1,2}\b/i.test(value);
      const otherMonthAbbreviation = /\b(?:Jan|Feb|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}\b/i.test(value);
      if (septemberAbbreviation || (otherMonthAbbreviation && !parent.closest("table,form"))) add("month-abbreviation", parent, value);
      const ambiguousNumericDate = /\b(?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01])[\/.-](?:\d{2}|\d{4})\b/.test(value)
        || /\b(?:1[3-9]|2\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:\d{2}|\d{4})\b/.test(value);
      const isoDate = /\b\d{4}-\d{2}-\d{2}\b/.test(value);
      if ((ambiguousNumericDate || isoDate) && !parent.closest("table,form")) add("numeric-date", parent, value);
      if (/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)\b/i.test(value)) add("ordinal-date", parent, value);
      const ordinalWord = /\b[1-9](?:st|nd|rd|th)\b/i.exec(value);
      const ordinalIsDate = ordinalWord && /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*$/i.test(value.slice(Math.max(0, ordinalWord.index - 14), ordinalWord.index));
      if (ordinalWord && !ordinalIsDate && !parent.closest("table,form")) add("ordinal-word", parent, value, null, {
        matchText: ordinalWord[0], matchIndex: ordinalWord.index
      });
      if (/\b(?:1[0-2]|0?[1-9]):00\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(value)
        || /\b\d{1,2}(?::\d{2})?\s*(?:A\.?M\.?|P\.?M\.?)\b/.test(value)
        || /\b\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.)\b/i.test(value)
        || /\b\d{1,2}(?::\d{2})?(?:am|pm)\b/i.test(value)) add("time-format", parent, value);
      const clockZone = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(PST|PDT|MST|MDT|CST|CDT|EST|EDT|AST|ADT|NST|NDT)\b/i.exec(value);
      const writtenZone = /\b(?:(?:Pacific|mountain|central|eastern|Atlantic|Newfoundland)\s+)?(?:standard|daylight)\s+time\b/i.exec(value);
      if (clockZone) add("time-zone", parent, value, null, {
        matchText: clockZone[1], replacement: TIME_ZONE_REPLACEMENTS[clockZone[1].toUpperCase()] || "general time zone", matchIndex: clockZone.index + clockZone[0].lastIndexOf(clockZone[1])
      });
      else if (writtenZone) add("time-zone", parent, value, null, { matchText: writtenZone[0], matchIndex: writtenZone.index });
      if (/\b12\s+(?:noon|midnight)\b/i.test(value)) add("noon-midnight", parent, value);
      if (/\b\d+(?:\.\d+)?\s*(?:inches?|feet|foot|yards?|miles?|pounds?|ounces?|fahrenheit|°F)\b/i.test(value)) add("imperial-unit", parent, value);
      const measurement = measurementDetails(value);
      if (measurement) add(measurement.ruleId, parent, value, null, {
        matchText: measurement.text, replacement: measurement.replacement, matchIndex: measurement.index
      });
      if (/\b\d+(?:\.\d+)?\s+°[cC]\b/.test(value) || /\b\d+(?:\.\d+)?°c\b/.test(value)) add("celsius-format", parent, value);
      if (/\b\d+(?:\.\d+)?%/.test(value) && !parent.closest("table,figure")) add("percent-symbol", parent, value);
      if (/[¼½¾⅓⅔⅛⅜⅝⅞]/.test(value)) add("fraction-symbol", parent, value);

      const cents = /\$(0\.\d{2})\b/.exec(value);
      if (cents) add("currency-cents", parent, value, null, {
        matchText: `$${cents[1]}`, replacement: `${Math.round(Number(cents[1]) * 100)} cents`, matchIndex: cents.index
      });
      const trailingZeros = /(?:US)?\$([1-9]\d*)\.00\b/.exec(value);
      if (trailingZeros) add("currency-trailing-zeros", parent, value, null, {
        matchText: trailingZeros[0], replacement: trailingZeros[0].replace(/\.00$/, ""), matchIndex: trailingZeros.index
      });
      const missingCurrencyComma = /((?:US)?\$)(\d{4,})(\.\d+)?(?![\d,])/.exec(value);
      if (missingCurrencyComma) add("currency-comma", parent, value, null, {
        matchText: missingCurrencyComma[0], replacement: `${missingCurrencyComma[1]}${formattedCurrency(missingCurrencyComma[2])}${missingCurrencyComma[3] || ""}`, matchIndex: missingCurrencyComma.index
      });
      const currencyRange = /(?:US)?\$\d[\d,.]*\s*[-–—]\s*(?:US)?\$?\d[\d,.]*/.exec(value);
      if (currencyRange) add("currency-range", parent, value, null, {
        matchText: currencyRange[0], replacement: currencyRange[0].replace(/\s*[-–—]\s*/, " to "), matchIndex: currencyRange.index
      });

      const apostrophePlural = /\b(?:\d{3,4}|[A-Z]{2,6})['’]s\b/.exec(value);
      if (apostrophePlural) add("apostrophe-plural", parent, value, null, {
        matchText: apostrophePlural[0], matchIndex: apostrophePlural.index
      });
    });

    const firstAcronymOccurrences = new Map();
    const acronymTextParts = nodes.map(node => node.nodeValue || "");
    nodes.forEach((node, nodeIndex) => {
      const expression = /\b[A-Z][A-Z0-9]{1,5}s?\b/g;
      let match;
      while ((match = expression.exec(node.nodeValue))) {
        const base = acronymBase(match[0]);
        if (!firstAcronymOccurrences.has(base)) firstAcronymOccurrences.set(base, { node, nodeIndex, index: match.index, token: match[0] });
      }
    });
    firstAcronymOccurrences.forEach((occurrence, acronym) => {
      const displayedAcronym = occurrence.token || acronym;
      if (!englishLanguage) return;
      if (isWellKnownAcronym(acronym) || isWellKnownAcronym(displayedAcronym)) return;
      if (isCommonRomanNumeral(acronym)) return;
      if (/^[A-Z]\d[A-Z]$/.test(acronym)) return;
      const parent = occurrence.node.parentElement;
      const element = parent.closest("h1,h2,h3,h4,h5,h6,p,li,dd,dt,figcaption,blockquote") || parent;
      const elementText = normalizeSpace(element.textContent || occurrence.node.nodeValue || displayedAcronym);
      if (isPostalAcronymContext(acronym, elementText, element)) return;
      if (acronymDefinedInText(elementText, displayedAcronym) || acronymDefinedAcrossParts(acronymTextParts, occurrence.nodeIndex, occurrence.index, displayedAcronym)) return;
      const termIndex = Math.max(0, exactTokenIndex(elementText, displayedAcronym));
      add("undefined-acronym", element || root, `First use: ${elementText}`, null, {
        flaggedToken: displayedAcronym,
        matchText: displayedAcronym,
        proposedPhrase: proposeExactPhrase(elementText, termIndex, displayedAcronym),
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
      const finalTextNode = link.lastChild && link.lastChild.nodeType === 3 ? link.lastChild : null;
      if (finalTextNode && /[\t \u00a0\u2007\u202f]+$/.test(finalTextNode.nodeValue || "")) add("link-trailing-space", link, `${linkText} ⟦trailing space⟧`, null, {
        matchText: "⟦trailing space⟧",
        diagnostics: ["The extra space is inside the link and may not be visible on the published page."]
      });
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
        else if (label.status === "label-format") add("file-link-label-format", link, linkText || href, null, {
          flaggedToken: label.raw,
          matchText: label.raw,
          replacement: label.replacement,
          matchIndex: Math.max(0, (linkText || "").indexOf(label.raw))
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
      const navigationalList = Boolean(list.closest("nav,[role='navigation']"));
      let depth = 1;
      let ancestor = list.parentElement && list.parentElement.closest("ul,ol");
      while (ancestor) { depth += 1; ancestor = ancestor.parentElement && ancestor.parentElement.closest("ul,ol"); }
      if (depth > 2 && !navigationalList) add("list-depth", list, "List depth: " + depth);
      const items = Array.from(list.children).filter(item => item.tagName === "LI");
      if (items.length > 7 && !navigationalList) add("list-long", list, items.length + " items");
      const precedingParagraph = list.previousElementSibling && list.previousElementSibling.tagName === "P" ? list.previousElementSibling : null;
      const precedingText = precedingParagraph ? normalizeSpace(precedingParagraph.textContent) : "";
      const onThisPageList = /^on this page:?$/i.test(precedingText) || Boolean(list.closest("[class*='jump' i],[class*='on-this-page' i]"));
      if (englishLanguage && !navigationalList && !onThisPageList && precedingParagraph && precedingText && !/:$/.test(precedingText)) {
        add("list-introduction", precedingParagraph, precedingText);
      }
      items.forEach(item => {
        const ownText = normalizeSpace(Array.from(item.childNodes).filter(node => node.nodeType === 3 || !/^(UL|OL)$/.test(node.tagName || "")).map(node => node.textContent).join(" "));
        if (!englishLanguage || navigationalList) return;
        if (listEndingNeedsRemoval(ownText)) add("list-punctuation", item, ownText, null,
          /;$/.test(ownText) ? { diagnostics: ["The final semicolon is also unnecessary sentence punctuation."] } : null);
        if (/^[a-zà-öø-ÿ]/.test(ownText)) add("list-lowercase", item, ownText);
        const itemSentences = sentences(ownText);
        if (itemSentences.length > 1) add("list-multiple-sentences", item, `${itemSentences.length} sentences: ${ownText}`);
      });
      const linkDirectory = items.length > 0 && items.every(item => {
        const itemLinks = item.querySelectorAll("a");
        return itemLinks.length === 1 && normalizeSpace(item.textContent) === normalizeSpace(itemLinks[0].textContent);
      });
      if (englishLanguage && !navigationalList && !linkDirectory) {
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
      if (element.closest("h1,h2,h3,h4,h5,h6")) return;
      if (element.closest("figure,figcaption,[class*='chart' i],[role='img']")) return;
      if (element.closest("a")) {
        add("bold-link", element, element.textContent, null,
          element.closest("h1,h2,h3,h4,h5,h6") ? { diagnostics: ["The bold link is also inside a heading. Removing the bold resolves both formatting concerns."] } : null);
        return;
      }
      let nearby = element.parentElement;
      let levels = 0;
      while (nearby && levels < 4 && !nearby.querySelector("figure")) { nearby = nearby.parentElement; levels += 1; }
      if (nearby && levels < 4 && nearby.querySelector("figure")) return;
      if (element.closest("h1,h2,h3,h4,h5,h6") || words(element.textContent).length > 12) add("bold-block", element, element.textContent);
    });
    Array.from(root.querySelectorAll("em,i")).filter(inScanArea).filter(element => !element.closest("h1,h2,h3,h4,h5,h6")).forEach(element => add("italics", element, element.textContent));
    Array.from(root.querySelectorAll("s,strike,del")).filter(inScanArea).forEach(element => add("strikethrough", element, element.textContent));
    Array.from(root.querySelectorAll("u")).filter(inScanArea).forEach(element => {
      if (!element.closest("a,h1,h2,h3,h4,h5,h6")) add("underline", element, element.textContent);
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
      else {
        if (englishLanguage && /^\s*(?:image|photo)\s+of\b/i.test(image.alt)) add("image-alt-prefix", image, image.alt, null, {
          matchText: image.alt.match(/^\s*(?:image|photo)\s+of\b/i)[0].trim(),
          matchIndex: 0
        });
        if (words(image.alt).length > 15) add("image-alt-length", image, `${words(image.alt).length} words: ${image.alt}`);
      }
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
      page: {
        title: title || "Untitled page",
        url: pageUrl,
        hostname,
        instanceId: doc.defaultView && doc.defaultView.performance ? String(doc.defaultView.performance.timeOrigin || "") : "",
        contentSignature: hashString(`${mainText}|${headings.map(heading => normalizeSpace(heading.textContent)).join("|")}|${links.length}`)
      },
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
      isEnglishLanguage,
      passiveVoiceParticiple,
      headingStructureDetails,
      measurementDetails,
      educationContext,
      academicDegreeDetails,
      canadianSpellingContextDetails,
      assetLabel,
      assetTypeFromUrl,
      endsStylePunctuation,
      linkPunctuationIssue,
      listEndingNeedsRemoval,
      acronymDefinedInText,
      acronymDefinedAcrossParts,
      acronymBase,
      exactTokenIndex,
      isWellKnownAcronym,
      isCommonRomanNumeral,
      isPostalAcronymContext,
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
