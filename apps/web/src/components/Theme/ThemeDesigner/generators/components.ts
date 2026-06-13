import type { DesignerVariables } from "../types";
import { getCodeThemeCSS } from "./codeTheme";

interface ComponentPresets {
  quotePreset: { base: string; extra: string };
}

export function generateComponents(
  v: DesignerVariables,
  presets: ComponentPresets,
): string {
  const { quotePreset } = presets;
  const underlineStyle = "var(--draftport-underline-style)";
  const underlineColor = "var(--draftport-underline-color)";
  const hrColor = "var(--draftport-hr-color)";
  const hrHeight = "var(--draftport-hr-height)";

  return `#draftport blockquote,
#draftport .multiquote-1,
#draftport .multiquote-2,
#draftport .multiquote-3 {
  margin: var(--draftport-paragraph-margin) 0 !important;
  padding: var(--draftport-quote-padding-y) var(--draftport-quote-padding-x);
  ${quotePreset.base}
}
#draftport blockquote p,
#draftport .multiquote-1 p,
#draftport .multiquote-2 p,
#draftport .multiquote-3 p {
  color: var(--draftport-quote-text-color);
  margin: 0 !important;
  font-size: var(--draftport-quote-font-size);
  line-height: var(--draftport-quote-line-height);
  ${v.quoteTextCentered ? "text-align: center !important;" : ""}
}

#draftport pre {
  margin: var(--draftport-paragraph-margin) 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

#draftport pre code {
  display: block;
  background: transparent;
  font-size: var(--draftport-code-font-size);
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  border-radius: 0;
  word-wrap: normal;
  word-break: keep-all;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
  min-width: max-content;
}

#draftport pre.custom {
  position: relative;
  margin: var(--draftport-paragraph-margin) 0;
  background: var(--draftport-code-background);
  border-radius: 8px;
  overflow: hidden;
}

#draftport pre.custom > .mac-sign {
  display: ${v.showMacBar ? "block" : "none"};
  line-height: 0;
}

${getCodeThemeCSS(v.codeTheme)}

#draftport code {
  color: var(--draftport-inline-code-color);
  background: var(--draftport-inline-code-background);
  padding: 2px 4px;
  border-radius: ${v.inlineCodeStyle === "rounded" ? "12px" : v.inlineCodeStyle === "github" ? "4px" : "2px"};
  font-size: 0.9em;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  white-space: normal;
  letter-spacing: 0;
  ${v.inlineCodeStyle === "github" ? "border: 1px solid rgba(0,0,0,0.06);" : ""}
  ${v.inlineCodeStyle === "color-text" ? `background: transparent; font-weight: bold; border-bottom: 2px solid var(--draftport-primary-color-50);` : ""}
}

/* 代码块样式需要更高优先级覆盖行内代码样式 */
#draftport pre code,
#draftport pre code.hljs {
  white-space: pre;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
}

#draftport a {
  color: var(--draftport-link-color);
  text-decoration: none;
  border-bottom: ${v.linkUnderline ? `1px solid var(--draftport-link-color)` : "none"};
  word-break: break-all;
}

#draftport em {
  font-style: italic;
  color: var(--draftport-italic-color);
}

#draftport del {
  text-decoration: line-through;
  color: var(--draftport-del-color);
}

#draftport u {
  text-decoration-line: underline;
  text-decoration-style: ${underlineStyle};
  text-underline-offset: 0.18em;
  text-decoration-thickness: 1px;
  text-decoration-color: ${underlineColor};
}

#draftport mark {
  background: var(--draftport-mark-background);
  color: var(--draftport-mark-color);
  padding: 0 2px;
  border-radius: 2px;
}

#draftport hr {
  margin: var(--draftport-hr-margin) 0;
  border: 0;
  ${(() => {
    const style = v.hrStyle || "solid";
    const color = hrColor;
    const height = hrHeight;

    if (style === "pill") {
      return `
    height: ${height};
    background: ${color};
    width: 20%;
    margin-left: auto;
    margin-right: auto;
    border-radius: 8px;
      `;
    }

    return `
    border-top: ${height} ${style} ${color};
    `;
  })()}
}
#draftport table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--draftport-paragraph-margin) 0;
}

#draftport th {
  background: var(--draftport-table-header-background);
  color: var(--draftport-table-header-color);
  font-weight: bold;
}

#draftport th, #draftport td {
  border: 1px solid var(--draftport-table-border-color);
  padding: 8px 12px;
  text-align: left;
}

${
  v.tableZebra
    ? `
#draftport tr:nth-child(even) {
  background: #fcfcfc;
}`
    : ""
}

#draftport img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--draftport-image-margin) auto;
  border-radius: var(--draftport-image-border-radius);
  box-shadow: var(--draftport-image-shadow);
}`;
}
