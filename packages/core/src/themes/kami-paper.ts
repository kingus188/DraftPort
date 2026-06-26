/**
 * Extracts Kami's paper-first visual system into a DraftPort Markdown theme.
 * The CSS stays scoped to #draftport so it can be injected into preview and copy surfaces without touching the app chrome.
 */
export const kamiPaperTheme = `/* Kami 纸感主题
 * Source: https://github.com/tw93/Kami
 * License: MIT License Copyright (c) 2026 Tw93
 * Extracted for DraftPort as scoped Markdown CSS only; fonts and Kami runtime templates are not bundled.
 */
#draftport {
  --kami-parchment: #f5f4ed;
  --kami-ivory: #faf9f5;
  --kami-warm-sand: #e8e6dc;
  --kami-brand: #1B365D;
  --kami-brand-light: #2D5A8A;
  --kami-near-black: #141413;
  --kami-dark-warm: #3d3d3a;
  --kami-olive: #504e49;
  --kami-stone: #6b6a64;
  --kami-border: #e8e6dc;
  --kami-border-soft: #e5e3d8;
  --kami-highlight-bg: #eee6d4;
  --kami-highlight-border: #dfd3bd;
  --kami-serif: Charter, Georgia, "TsangerJinKai02", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", Palatino, serif;
  --kami-mono: "JetBrains Mono", "SF Mono", "Fira Code", Consolas, Monaco, "Source Han Serif SC", monospace;

  max-width: 720px;
  margin: 0 auto;
  padding: 32px 28px;
  color: var(--kami-near-black);
  background: var(--kami-parchment);
  font-family: var(--kami-serif);
  font-size: 16px;
  line-height: 1.55;
  letter-spacing: 0.2px;
  word-break: break-word;
}

#draftport p {
  margin: 14px 0;
  color: var(--kami-near-black);
  font-size: 16px;
  line-height: 1.62;
  text-align: justify;
}

#draftport h1,
#draftport h2,
#draftport h3,
#draftport h4,
#draftport h5,
#draftport h6 {
  color: var(--kami-near-black);
  font-family: var(--kami-serif);
  font-weight: 500;
  letter-spacing: 0;
}

#draftport h1 {
  margin: 44px 0 28px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--kami-border);
}

#draftport h1 .content {
  display: inline-block;
  color: var(--kami-near-black);
  font-size: 30px;
  font-weight: 500;
  line-height: 1.18;
}

#draftport h2 {
  margin: 36px 0 16px;
  padding-left: 12px;
  border-left: 4px solid var(--kami-brand);
}

#draftport h2 .content {
  display: inline-block;
  color: var(--kami-near-black);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.25;
}

#draftport h3 {
  margin: 28px 0 12px;
}

#draftport h3 .content {
  display: inline-block;
  color: var(--kami-dark-warm);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.3;
}

#draftport h4,
#draftport h5,
#draftport h6 {
  margin: 22px 0 10px;
}

#draftport h4 .content,
#draftport h5 .content,
#draftport h6 .content {
  display: inline-block;
  color: var(--kami-dark-warm);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.35;
}

#draftport h1 .prefix,
#draftport h1 .suffix,
#draftport h2 .prefix,
#draftport h2 .suffix,
#draftport h3 .prefix,
#draftport h3 .suffix,
#draftport h4 .prefix,
#draftport h4 .suffix,
#draftport h5 .prefix,
#draftport h5 .suffix,
#draftport h6 .prefix,
#draftport h6 .suffix {
  display: none;
}

#draftport a {
  color: var(--kami-brand);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid var(--kami-brand);
}

#draftport strong {
  color: var(--kami-near-black);
  font-weight: 500;
}

#draftport em {
  color: var(--kami-olive);
  font-style: normal;
}

#draftport mark {
  padding: 2px 5px;
  color: var(--kami-near-black);
  background: var(--kami-highlight-bg);
  border-radius: 3px;
}

#draftport ul,
#draftport ol {
  margin: 14px 0;
  padding-left: 24px;
  color: var(--kami-near-black);
  line-height: 1.58;
}

#draftport li {
  margin: 6px 0;
}

#draftport li::marker {
  color: var(--kami-brand);
  font-weight: 500;
}

#draftport li section {
  color: var(--kami-near-black);
  font-weight: 400;
  line-height: 1.58;
}

#draftport .multiquote-1,
#draftport .multiquote-2,
#draftport .multiquote-3 {
  margin: 20px 0;
  padding: 8px 0 8px 16px;
  color: var(--kami-olive);
  background: transparent;
  border-left: 3px solid var(--kami-brand);
  border-radius: 0;
}

#draftport .multiquote-1 p,
#draftport .multiquote-2 p,
#draftport .multiquote-3 p {
  margin: 0;
  color: var(--kami-olive);
  line-height: 1.55;
}

#draftport hr {
  height: 1px;
  margin: 30px 0;
  border: none;
  background: var(--kami-border);
}

#draftport pre {
  margin: 18px 0;
  border-radius: 8px;
  background: var(--kami-ivory);
  border: 1px solid var(--kami-border);
  overflow: hidden;
}

#draftport pre.custom {
  border-radius: 8px;
  background: var(--kami-ivory);
  border: 1px solid var(--kami-border);
}

#draftport pre code,
#draftport pre code.hljs,
#draftport pre code:not(.hljs) {
  display: block;
  padding: 14px 16px;
  color: var(--kami-near-black);
  background: var(--kami-ivory);
  font-family: var(--kami-mono);
  font-size: 13px;
  line-height: 1.55;
}

#draftport code:not(pre code) {
  padding: 2px 5px;
  color: var(--kami-dark-warm);
  background: var(--kami-highlight-bg);
  border: 1px solid var(--kami-highlight-border);
  border-radius: 4px;
  font-family: var(--kami-mono);
  font-size: 0.9em;
}

#draftport table {
  width: 100%;
  margin: 18px 0;
  border-collapse: collapse;
  color: var(--kami-near-black);
  font-size: 14px;
  line-height: 1.45;
}

#draftport table tr {
  border: none;
}

#draftport table tr:nth-child(2n) {
  background: var(--kami-ivory);
}

#draftport table tr th,
#draftport table tr td {
  padding: 9px 10px;
  border: none;
  border-bottom: 1px solid var(--kami-border-soft);
  vertical-align: top;
}

#draftport table tr th {
  color: var(--kami-dark-warm);
  background: transparent;
  border-bottom: 1px solid var(--kami-border);
  font-weight: 500;
  text-align: left;
}

#draftport img {
  display: block;
  max-width: 100%;
  margin: 22px auto 8px;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(20, 19, 19, 0.06);
}

#draftport figcaption {
  margin-top: 8px;
  color: var(--kami-stone);
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
}
`;
