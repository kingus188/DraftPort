import type { DesignerVariables } from "../types";

export function generateGlobal(v: DesignerVariables): string {
  return `#draftport figcaption {
  color: var(--draftport-image-caption-color);
  font-size: var(--draftport-image-caption-font-size);
  text-align: var(--draftport-image-caption-align);
  margin-top: 8px;
  line-height: var(--draftport-line-height);
}

#draftport strong {
  font-weight: bold;
  ${
    v.strongColor && v.strongColor !== "inherit"
      ? `color: ${v.strongColor};`
      : v.strongStyle === "none"
        ? "color: inherit;"
        : "color: var(--draftport-primary-color);"
  }
  ${v.strongStyle === "highlighter" ? "background: var(--draftport-primary-color-20); padding: 0 2px; border-radius: 2px;" : ""}
  ${v.strongStyle === "highlighter-bottom" ? "background: linear-gradient(to bottom, transparent 60%, var(--draftport-primary-color-30) 60%); padding: 0 2px;" : ""}
  ${v.strongStyle === "underline" ? "border-bottom: 2px solid var(--draftport-primary-color); padding-bottom: 1px;" : ""}
  ${v.strongStyle === "dot" ? `-webkit-text-emphasis: dot; -webkit-text-emphasis-position: under; text-emphasis: dot; text-emphasis-position: under;` : ""}
}`;
}
