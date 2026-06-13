/**
 * Owns the Zhihu rich-text paste HTML boundary.
 * The output intentionally favors semantic HTML over WeMD theme fidelity because
 * Zhihu's editor accepts pasted structure more reliably than platform-specific styling.
 */

const SUPPORTED_TAGS = new Set([
  "A",
  "BLOCKQUOTE",
  "BR",
  "CENTER",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "IMG",
  "LI",
  "OL",
  "P",
  "PRE",
  "S",
  "STRONG",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
]);

const SAFE_STYLE_PROPERTIES = [
  "color",
  "background-color",
  "text-align",
  "font-size",
  "line-height",
  "font-weight",
  "font-style",
  "text-decoration",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-collapse",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "vertical-align",
];

const STYLE_PROPERTY_ALIASES = new Map([["background", "background-color"]]);

/** Converts WeMD heading decoration spans into plain heading content. */
const unwrapHeadingDecoration = (body: HTMLElement): void => {
  body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const content = heading.querySelector(":scope > span.content");
    if (content) {
      heading.replaceChildren(...Array.from(content.childNodes));
    }
  });
};

/** Removes empty center elements because they become visible blank blocks after paste. */
const removeEmptyCenters = (body: HTMLElement): void => {
  body.querySelectorAll("center").forEach((center) => {
    if (!center.textContent?.trim() && center.children.length === 0) {
      center.remove();
    }
  });
};

/** Unwraps list item section wrappers emitted by WeMD's WeChat-oriented renderer. */
const unwrapListItemSections = (body: HTMLElement): void => {
  body.querySelectorAll("li").forEach((listItem) => {
    if (
      listItem.children.length === 1 &&
      listItem.children[0] instanceof HTMLElement &&
      listItem.children[0].tagName === "SECTION"
    ) {
      const section = listItem.children[0];
      listItem.replaceChildren(...Array.from(section.childNodes));
    }
  });
};

/** Replaces checkbox inputs with text markers that survive Zhihu paste sanitization. */
const replaceCheckboxes = (body: HTMLElement): void => {
  body.querySelectorAll("input").forEach((input) => {
    if (input.getAttribute("type")?.toLowerCase() !== "checkbox") {
      input.remove();
      return;
    }
    const marker = input.hasAttribute("checked") ? "✅ " : "☐ ";
    input.replaceWith(input.ownerDocument.createTextNode(marker));
  });
};

/** Converts KaTeX wrappers into Zhihu's formula image placeholder format. */
const normalizeZhihuEquations = (body: HTMLElement): void => {
  body
    .querySelectorAll<HTMLElement>(
      ".inline-equation[data-latex], .block-equation[data-latex]",
    )
    .forEach((equation) => {
      const latex = equation.getAttribute("data-latex")?.trim();
      if (!latex) return;

      const formula = equation.ownerDocument.createElement("img");
      const isBlockEquation = equation.classList.contains("block-equation");
      const alt =
        isBlockEquation && !latex.includes("\\tag") ? `${latex}\\\\` : latex;
      formula.setAttribute("class", "Formula-image");
      formula.setAttribute("data-eeimg", "true");
      formula.setAttribute("src", "");
      formula.setAttribute("alt", alt);
      equation.replaceWith(formula);
    });
};

/** Keeps public images and downgrades local clipboard-only images into visible text. */
const normalizeImages = (body: HTMLElement): void => {
  body.querySelectorAll("img").forEach((image) => {
    if (
      image.classList.contains("Formula-image") &&
      image.getAttribute("data-eeimg") === "true"
    ) {
      const alt = image.getAttribute("alt") ?? "";
      image.getAttributeNames().forEach((name) => image.removeAttribute(name));
      image.setAttribute("class", "Formula-image");
      image.setAttribute("data-eeimg", "true");
      image.setAttribute("src", "");
      image.setAttribute("alt", alt);
      return;
    }

    const src = image.getAttribute("src")?.trim() ?? "";
    const alt = image.getAttribute("alt")?.trim() ?? "";
    if (!/^https?:\/\//i.test(src)) {
      const label = alt ? `[图片: ${alt}]` : "[图片]";
      image.replaceWith(image.ownerDocument.createTextNode(label));
      return;
    }
    image.getAttributeNames().forEach((name) => image.removeAttribute(name));
    image.setAttribute("src", src);
    if (alt) {
      image.setAttribute("alt", alt);
    }
  });
};

/** Rejects CSS values that can reference external resources or script-like legacy syntax. */
const isSafeStyleValue = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    !normalized.includes("url(") &&
    !normalized.includes("expression(") &&
    !normalized.includes("javascript:") &&
    !normalized.includes("behavior:")
  );
};

/** Builds a compact style attribute from raw declarations that usually survive rich-text paste. */
const getSafeStyle = (element: HTMLElement): string => {
  if (element.tagName === "PRE" || element.closest("pre")) {
    return "";
  }

  const rawStyle = element.getAttribute("style");
  if (!rawStyle) return "";

  const declarations = rawStyle
    .split(";")
    .map((declaration) => declaration.trim())
    .flatMap((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex <= 0) return [];

      const rawProperty = declaration.slice(0, separatorIndex).trim();
      const value = declaration.slice(separatorIndex + 1).trim();
      const property = rawProperty.toLowerCase();
      const safeProperty = STYLE_PROPERTY_ALIASES.get(property) ?? property;

      if (!SAFE_STYLE_PROPERTIES.includes(safeProperty) || !value) return [];
      if (!isSafeStyleValue(value)) return [];

      if (property === "background") {
        const backgroundColor = element.style
          .getPropertyValue("background-color")
          .trim();
        return backgroundColor ? [`${safeProperty}: ${backgroundColor}`] : [];
      }

      return [`${safeProperty}: ${value}`];
    });

  return declarations.join("; ");
};

/** Flattens highlighted code spans so Zhihu receives source text, not theme markup. */
const flattenCodeBlocks = (body: HTMLElement): void => {
  body.querySelectorAll("pre").forEach((pre) => {
    let code = pre.querySelector(":scope > code");
    if (!code) {
      code = pre.ownerDocument.createElement("code");
      code.textContent = pre.textContent ?? "";
    } else {
      code.textContent = code.textContent ?? "";
    }
    pre.replaceChildren(code);
  });
};

/** Removes nonessential attributes while preserving safe link, image, and lightweight style data. */
const stripAttributes = (body: HTMLElement): void => {
  body.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const safeStyle = getSafeStyle(element);

    if (element.tagName === "A") {
      const href = element.getAttribute("href")?.trim() ?? "";
      element
        .getAttributeNames()
        .forEach((name) => element.removeAttribute(name));
      if (/^https?:\/\//i.test(href)) {
        element.setAttribute("href", href);
      }
      if (safeStyle) {
        element.setAttribute("style", safeStyle);
      }
      return;
    }

    if (element.tagName === "IMG") {
      return;
    }

    element
      .getAttributeNames()
      .forEach((name) => element.removeAttribute(name));
    if (safeStyle) {
      element.setAttribute("style", safeStyle);
    }
  });
};

/** Replaces unsupported elements with their children to avoid leaking editor-only wrappers. */
const unwrapUnsupportedElements = (body: HTMLElement): void => {
  Array.from(body.querySelectorAll<HTMLElement>("*"))
    .reverse()
    .forEach((element) => {
      if (SUPPORTED_TAGS.has(element.tagName)) return;
      element.replaceWith(...Array.from(element.childNodes));
    });
};

/** Removes a single DraftPort root wrapper so the pasted article starts with content blocks. */
const unwrapDraftPortRoot = (body: HTMLElement): void => {
  const root = body.firstElementChild;
  if (
    root instanceof HTMLElement &&
    root.id === "draftport" &&
    body.childElementCount === 1
  ) {
    body.replaceChildren(...Array.from(root.childNodes));
  }
};

/**
 * Normalizes rendered Markdown HTML for Zhihu's rich-text paste surface.
 * The returned fragment is safe to place directly on the HTML clipboard.
 */
export function normalizeZhihuHtml(html: string): string {
  const document = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  const { body } = document;

  unwrapDraftPortRoot(body);
  unwrapHeadingDecoration(body);
  unwrapListItemSections(body);
  removeEmptyCenters(body);
  replaceCheckboxes(body);
  normalizeZhihuEquations(body);
  flattenCodeBlocks(body);
  normalizeImages(body);
  unwrapUnsupportedElements(body);
  stripAttributes(body);

  return body.innerHTML;
}
