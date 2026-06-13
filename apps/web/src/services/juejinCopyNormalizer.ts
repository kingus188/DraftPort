/**
 * Owns the Juejin rich-text paste HTML boundary.
 * The output keeps semantic article HTML, converts formulas into Juejin equation
 * image URLs, and avoids editor-only markup that tends to paste poorly.
 */

const SUPPORTED_TAGS = new Set([
  "A",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "FIGURE",
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
  "SPAN",
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
const JUEJIN_EQUATION_ENDPOINT = "https://juejin.im/equation?tex=";

/** Converts WeMD heading decoration spans into plain heading content. */
const unwrapHeadingDecoration = (body: HTMLElement): void => {
  body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const content = heading.querySelector(":scope > span.content");
    if (content) {
      heading.replaceChildren(...Array.from(content.childNodes));
    }
  });
};

/** Removes a single DraftPort root wrapper so copied HTML starts with article blocks. */
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

/** Replaces checkbox inputs with text markers that survive platform paste sanitization. */
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

/** Creates the equation image shape used by Juejin's editor. */
const createEquationImage = (
  document: Document,
  latex: string,
): HTMLImageElement => {
  const image = document.createElement("img");
  image.setAttribute("class", "equation");
  image.setAttribute(
    "src",
    `${JUEJIN_EQUATION_ENDPOINT}${encodeURIComponent(latex)}`,
  );
  image.setAttribute("alt", "");
  return image;
};

/** Converts KaTeX wrappers into Juejin equation image URLs. */
const normalizeJuejinEquations = (body: HTMLElement): void => {
  body
    .querySelectorAll<HTMLElement>(
      ".inline-equation[data-latex], .block-equation[data-latex]",
    )
    .forEach((equation) => {
      const latex = equation.getAttribute("data-latex")?.trim();
      if (!latex) return;

      const image = createEquationImage(equation.ownerDocument, latex);
      if (equation.classList.contains("block-equation")) {
        const figure = equation.ownerDocument.createElement("figure");
        figure.appendChild(image);
        equation.replaceWith(figure);
        return;
      }

      const wrapper = equation.ownerDocument.createElement("span");
      image.setAttribute("style", "display: inline");
      wrapper.appendChild(image);
      equation.replaceWith(wrapper);
    });
};

/** Converts highlighted code markup into plain source text while preserving explicit line breaks. */
const flattenCodeBlocks = (body: HTMLElement): void => {
  body.querySelectorAll("pre").forEach((pre) => {
    const source = pre.querySelector(":scope > code") ?? pre;
    const code = pre.ownerDocument.createElement("code");
    code.textContent = Array.from(source.childNodes)
      .map((node) => (node.nodeName === "BR" ? "\n" : (node.textContent ?? "")))
      .join("")
      .replace(/\u00a0/g, " ");
    pre.replaceChildren(code);
  });
};

/** Keeps public images and downgrades local clipboard-only images into visible text. */
const normalizeImages = (body: HTMLElement): void => {
  body.querySelectorAll("img").forEach((image) => {
    if (image.classList.contains("equation")) {
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
      const src = element.getAttribute("src")?.trim() ?? "";
      const alt = element.getAttribute("alt") ?? "";
      const isEquation = element.classList.contains("equation");
      const rawStyle = element.getAttribute("style")?.toLowerCase() ?? "";
      const style =
        isEquation && rawStyle.includes("display") ? "display: inline" : "";
      element
        .getAttributeNames()
        .forEach((name) => element.removeAttribute(name));
      if (isEquation) {
        element.setAttribute("class", "equation");
      }
      if (src) {
        element.setAttribute("src", src);
      }
      element.setAttribute("alt", alt);
      if (style) {
        element.setAttribute("style", style);
      }
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

/**
 * Normalizes rendered Markdown HTML for Juejin's rich-text paste surface.
 * The returned fragment is safe to place directly on the HTML clipboard.
 */
export function normalizeJuejinHtml(html: string): string {
  const document = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  const { body } = document;

  unwrapDraftPortRoot(body);
  unwrapHeadingDecoration(body);
  unwrapListItemSections(body);
  replaceCheckboxes(body);
  normalizeJuejinEquations(body);
  flattenCodeBlocks(body);
  normalizeImages(body);
  unwrapUnsupportedElements(body);
  stripAttributes(body);

  return body.innerHTML;
}
