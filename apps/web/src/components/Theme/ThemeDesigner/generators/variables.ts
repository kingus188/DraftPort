import type { DesignerVariables } from "../types";

const toAlphaColor = (color: string, alpha: number): string => {
  const trimmed = color.trim();
  if (!trimmed) return color;

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const normalize = (value: string) =>
      value.length === 1 ? value + value : value;
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(normalize(hex[0]), 16);
      const g = parseInt(normalize(hex[1]), 16);
      const b = parseInt(normalize(hex[2]), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const rgbMatch =
    trimmed.match(/^rgb\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i) ||
    trimmed.match(
      /^rgba\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i,
    );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const hslMatch =
    trimmed.match(/^hsl\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i) ||
    trimmed.match(
      /^hsla\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i,
    );
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}, ${l}, ${alpha})`;
  }

  return color;
};

export function generateVariables(
  v: DesignerVariables,
  safeFontFamily: string,
): string {
  const primaryColor20 = toAlphaColor(v.primaryColor, 0.12);
  const primaryColor30 = toAlphaColor(v.primaryColor, 0.18);
  const primaryColor50 = toAlphaColor(v.primaryColor, 0.5);
  const underlineStyle = v.underlineStyle || "solid";
  const underlineColor = v.underlineColor || "currentColor";
  return `#draftport {
  /* CSS 变量 - 可在 CSS 编辑模式下覆盖 */
  /* 全局 */
  --draftport-page-padding: ${v.pagePadding ?? 8}px;
  --draftport-font-size: ${v.fontSize};
  --draftport-line-height: ${v.lineHeight};
  --draftport-paragraph-margin: ${v.paragraphMargin}px;
  --draftport-paragraph-padding: ${v.paragraphPadding ?? 0}px;
  --draftport-text-color: ${v.paragraphColor};
  --draftport-primary-color: ${v.primaryColor};
  --draftport-primary-color-20: ${primaryColor20};
  --draftport-primary-color-30: ${primaryColor30};
  --draftport-primary-color-50: ${primaryColor50};
  --draftport-letter-spacing: ${v.baseLetterSpacing || 0}px;
  --draftport-underline-style: ${underlineStyle};
  --draftport-underline-color: ${underlineColor};

  /* 标题 */
  --draftport-h1-font-size: ${v.h1.fontSize}px;
  --draftport-h1-color: ${v.h1.color};
  --draftport-h1-margin-top: ${v.h1.marginTop}px;
  --draftport-h1-margin-bottom: ${v.h1.marginBottom}px;
  --draftport-h2-font-size: ${v.h2.fontSize}px;
  --draftport-h2-color: ${v.h2.color};
  --draftport-h2-margin-top: ${v.h2.marginTop}px;
  --draftport-h2-margin-bottom: ${v.h2.marginBottom}px;
  --draftport-h3-font-size: ${v.h3.fontSize}px;
  --draftport-h3-color: ${v.h3.color};
  --draftport-h3-margin-top: ${v.h3.marginTop}px;
  --draftport-h3-margin-bottom: ${v.h3.marginBottom}px;
  --draftport-h4-font-size: ${v.h4.fontSize}px;
  --draftport-h4-color: ${v.h4.color};
  --draftport-h4-margin-top: ${v.h4.marginTop}px;
  --draftport-h4-margin-bottom: ${v.h4.marginBottom}px;

  /* 代码 */
  --draftport-code-background: ${v.codeBackground};
  --draftport-code-font-size: ${v.codeFontSize}px;
  --draftport-inline-code-color: ${v.inlineCodeColor};
  --draftport-inline-code-background: ${v.inlineCodeBackground};

  /* 引用 */
  --draftport-quote-background: ${v.quoteBackground};
  --draftport-quote-border-color: ${v.quoteBorderColor};
  --draftport-quote-border-width: ${v.quoteBorderWidth}px;
  --draftport-quote-border-style: ${v.quoteBorderStyle};
  --draftport-quote-text-color: ${v.quoteTextColor};
  --draftport-quote-font-size: ${v.quoteFontSize}px;
  --draftport-quote-line-height: ${v.quoteLineHeight};
  --draftport-quote-padding-x: ${v.quotePaddingX}px;
  --draftport-quote-padding-y: ${v.quotePaddingY}px;

  /* 图片 */
  --draftport-image-margin: ${v.imageMargin}px;
  --draftport-image-border-radius: ${v.imageBorderRadius}px;
  --draftport-image-shadow: ${v.imageShadow ? "0 4px 12px rgba(0, 0, 0, 0.12)" : "none"};
  --draftport-image-caption-color: ${v.imageCaptionColor};
  --draftport-image-caption-font-size: ${v.imageCaptionFontSize}px;
  --draftport-image-caption-align: ${v.imageCaptionTextAlign};

  /* 链接与文本 */
  --draftport-link-color: ${v.linkColor || v.primaryColor};
  --draftport-italic-color: ${v.italicColor};
  --draftport-del-color: ${v.delColor};
  --draftport-mark-background: ${v.markBackground};
  --draftport-mark-color: ${v.markColor};

  /* 表格 */
  --draftport-table-header-background: ${v.tableHeaderBackground};
  --draftport-table-header-color: ${v.tableHeaderColor};
  --draftport-table-border-color: ${v.tableBorderColor};

  /* 分割线 */
  --draftport-hr-color: ${v.hrColor};
  --draftport-hr-height: ${v.hrHeight}px;
  --draftport-hr-margin: ${v.hrMargin}px;

  /* 列表 */
  --draftport-list-spacing: ${v.listSpacing}px;
  --draftport-list-marker-color: ${v.listMarkerColor};
  --draftport-list-marker-color-l2: ${v.listMarkerColorL2};

  font-family: ${safeFontFamily};
  padding: 0 var(--draftport-page-padding);
  color: var(--draftport-text-color);
  overflow-wrap: break-word;
}`;
}
