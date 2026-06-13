export const codeGithubTheme = `/*
github.com style (c) Vasily Polovnyov <vast@whiteants.net>
*/

/* 代码块样式 - 需要添加 #draftport 前缀以匹配包装后的 HTML */
#draftport .hljs {
  display: block;
  overflow-x: auto;
  padding: 16px;
  color: #333;
  background: #f8f8f8;
}

#draftport .hljs-comment,
#draftport .hljs-quote {
  color: #998;
  font-style: italic;
}

#draftport .hljs-keyword,
#draftport .hljs-selector-tag,
#draftport .hljs-subst {
  color: #333;
  font-weight: bold;
}

#draftport .hljs-number,
#draftport .hljs-literal,
#draftport .hljs-variable,
#draftport .hljs-template-variable,
#draftport .hljs-tag .hljs-attr {
  color: #008080;
}

#draftport .hljs-string,
#draftport .hljs-doctag {
  color: #d14;
}

#draftport .hljs-title,
#draftport .hljs-section,
#draftport .hljs-selector-id {
  color: #900;
  font-weight: bold;
}

#draftport .hljs-subst {
  font-weight: normal;
}

#draftport .hljs-type,
#draftport .hljs-class .hljs-title {
  color: #458;
  font-weight: bold;
}

#draftport .hljs-tag,
#draftport .hljs-name,
#draftport .hljs-attribute {
  color: #000080;
  font-weight: normal;
}

#draftport .hljs-regexp,
#draftport .hljs-link {
  color: #009926;
}

#draftport .hljs-symbol,
#draftport .hljs-bullet {
  color: #990073;
}

#draftport .hljs-built_in,
#draftport .hljs-builtin-name {
  color: #0086b3;
}

#draftport .hljs-meta {
  color: #999;
  font-weight: bold;
}

#draftport .hljs-deletion {
  background: #fdd;
}

#draftport .hljs-addition {
  background: #dfd;
}

#draftport .hljs-emphasis {
  font-style: italic;
}

#draftport .hljs-strong {
  font-weight: bold;
}

/* Imageflow CSS */
#draftport .imageflow-layer1 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  /* white-space: normal; */
  border: 0px none;
  padding: 0px;
  overflow: hidden;
}

#draftport .imageflow-layer2 {
  white-space: nowrap;
  width: 100%;
  overflow-x: scroll;
}

#draftport .imageflow-layer3 {
  display: inline-block;
  word-wrap: break-word;
  white-space: normal;
  vertical-align: top;
  width: 80%;
  margin-right: 10px;
  flex-shrink: 0;
}

#draftport .imageflow-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
}

#draftport .imageflow-caption {
  text-align: center;
  margin-top: 0px;
  padding-top: 0px;
  color: #888;
}
`;
