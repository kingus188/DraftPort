export const knowledgeBaseTheme = `/* 知识库风格 */
#draftport {
    padding: 5px 24px;
    max-width: 677px;
    margin: 0 auto;
    /* 使用系统无衬线字体，保持干净利落 */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "PingFang SC", sans-serif;
    color: #37352F;
    /* 经典的笔记深灰色 */
    background-color: transparent;
    /* 透明背景，兼容微信深色模式 */
    word-break: break-word;
}

/* 段落 - 紧凑但舒适 */
#draftport p {
    margin-top: 16px;
    margin-bottom: 16px;
    line-height: 1.75;
    letter-spacing: 0.2px;
    text-align: justify;
    color: #37352F;
    font-size: 16px;
}

/*
 * 一级标题 - 页面标题感
 * 就像笔记页面的最顶端标题
 */
#draftport h1 {
    margin-top: 50px;
    margin-bottom: 40px;
    text-align: left;
    border-bottom: 1px solid #E3E2E0;
    /* 极细的分割线 */
    padding-bottom: 20px;
}

#draftport h1 .content {
    font-size: 28px;
    font-weight: 700;
    color: #37352F;
    display: inline-block;
    line-height: 1.2;
}

#draftport h1 .prefix,
#draftport h1 .suffix {
    display: none;
}

/*
 * 二级标题 - 区块分割
 * 带有浅灰色背景条，类似 Notion 的 H1 block
 */
#draftport h2 {
    margin-top: 40px;
    margin-bottom: 20px;
    text-align: left;
}

#draftport h2 .content {
    display: block;
    /* 占满整行 */
    font-size: 22px;
    font-weight: 600;
    color: #37352F;
    padding: 8px 12px;
    background-color: #F7F6F3;
    /* 经典的浅灰底色 */
    border-radius: 4px;
    line-height: 1.3;
}

#draftport h2 .prefix,
#draftport h2 .suffix {
    display: none;
}

/*
 * 三级标题 - 重点标记
 * 像是给文字加了颜色标记
 */
#draftport h3 {
    margin-top: 30px;
    margin-bottom: 12px;
}

#draftport h3 .content {
    font-size: 18px;
    font-weight: 600;
    color: #37352F;
    display: inline-block;
    /* 底部局部高亮 */
    border-bottom: 3px solid #FDECC8;
    /* 奶黄色 */
    padding-bottom: 2px;
}

#draftport h3 .prefix,
#draftport h3 .suffix {
    display: none;
}

/* 四级标题 - 小节 */
#draftport h4 {
    margin-top: 24px;
    margin-bottom: 8px;
    text-align: left;
}

#draftport h4 .content {
    display: inline-block;
    font-size: 16px;
    font-weight: 600;
    color: #EB5757;
    /* 醒目的红色，用于警示或强调 */
    line-height: 1.4;
}

#draftport h4 .prefix,
#draftport h4 .suffix {
    display: none;
}

/*
 * 列表 - 结构化缩进
 */
#draftport ul {
    list-style-type: disc;
    padding-left: 24px;
    margin: 16px 0;
    color: #37352F;
}

#draftport ul li {
    margin-bottom: 8px;
    line-height: 1.7;
}

#draftport li section {
    color: #37352F;
    font-size: 16px;
}

/* 有序列表 */
#draftport ol {
    list-style-type: decimal;
    padding-left: 24px;
    margin: 16px 0;
    color: #37352F;
    font-weight: 600;
}

#draftport ul ul {
    list-style-type: circle;
    margin-top: 6px;
}

#draftport ol ol {
    list-style-type: lower-alpha;
}

#draftport ol li {
    margin-bottom: 8px;
    line-height: 1.7;
}

#draftport ol li section {
    color: #37352F;
    font-weight: normal;
    font-size: 16px;
}

/*
 * 引用 - Callout 提示框风格
 * 这是这款主题的灵魂
 */
#draftport .multiquote-1,
#draftport .multiquote-2,
#draftport .multiquote-3 {
    margin: 24px 0;
    padding: 16px 16px 16px 20px;
    background-color: #F1F1EF;
    /* 默认浅灰背景 */
    border: none;
    /* 无边框 */
    border-radius: 4px;
    border-left: 4px solid #37352F;
    /* 左侧深色强提示 */
    overflow: visible !important;
}

/* 针对不同层级引用，给予不同颜色，模拟 Info/Warning */
#draftport .multiquote-2 {
    background-color: #E7F3F8;
    /* 浅蓝背景 (Info) */
    border-left-color: #2D9CDB;
}

#draftport .multiquote-3 {
    background-color: #FDF5F2;
    /* 浅橙背景 (Warning) */
    border-left-color: #F2994A;
}

#draftport .multiquote-1 p,
#draftport .multiquote-2 p,
#draftport .multiquote-3 p {
    margin: 0;
    color: #37352F;
    font-size: 15px;
    line-height: 1.6;
}

/* 链接 - 简洁下划线 */
#draftport a {
    color: #37352F;
    text-decoration: none;
    border-bottom: 1px solid #999;
    /* 灰色下划线 */
    font-weight: 500;
    transition: border-color 0.2s;
}

/*
 * 加粗 - 黄色高光笔
 * 完全复刻 Notion 的 Highlight 效果
 */
#draftport strong {
    color: #37352F;
    font-weight: 600;
    background-color: #FDECC8;
    /* 高亮黄 */
    padding: 2px 4px;
    margin: 0 2px;
    border-radius: 3px;
}

/* 斜体 */
#draftport em {
    color: #37352F;
    font-style: italic;
    opacity: 0.7;
}

#draftport em strong {
    color: #37352F;
    opacity: 1;
}

/* 高亮 - 黄色标记 */
#draftport mark {
    background: #FDECC8;
    color: #37352F;
    padding: 2px 4px;
    border-radius: 3px;
}

/* 删除线 */
#draftport del {
    text-decoration: line-through;
    color: #999;
}

/* 分隔线 */
#draftport hr {
    margin: 40px auto;
    border: 0;
    height: 1px;
    background-color: #E3E2E0;
    /* 极浅灰 */
    width: 100%;
}

/* 图片 - 干净无阴影 */
#draftport img {
    display: block;
    margin: 30px auto;
    width: 100%;
    border-radius: 4px;
    box-shadow: none;
    /* 笔记风格通常不需要阴影 */
    border: 1px solid #E3E2E0;
    /* 只有一圈细线 */
}

#draftport figcaption {
    margin-top: 8px;
    text-align: center;
    color: #999;
    font-size: 14px;
}

/*
 * 行内代码 - 经典的红字灰底
 */
#draftport p code,
#draftport li code {
    color: #EB5757;
    /* 红色文字 */
    background: rgba(135, 131, 120, 0.15);
    /* 半透明灰底 */
    border: none;
    padding: 3px 6px;
    margin: 0 4px;
    border-radius: 4px;
    font-size: 14px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

/* 代码块 - 极简灰 */
/* 代码块 - 注意：不要设置 color，让语法高亮主题控制文字颜色 */
#draftport pre code.hljs {
    display: block;
    padding: 20px;
    background: #F7F6F3;
    /* color 由 .hljs 语法高亮主题控制 */
    font-size: 13px;
    line-height: 1.6;
    border-radius: 4px;
    font-family: "SFMono-Regular", Consolas, Menlo, monospace;
    overflow-x: auto;
    white-space: pre;
  min-width: max-content;
    border: none;
}

/* 如果没有语法高亮，设置默认深灰色 */
#draftport pre code:not(.hljs) {
    color: #37352F;
    background: #F7F6F3;
}

/* 表格 - 数据库风格 (Database) */
#draftport table {
    width: 100%;
    border-collapse: collapse;
    margin: 30px 0;
    font-size: 14px;
    border: 1px solid #E3E2E0;
    border-radius: 0;
}

#draftport table tr th {
    background: #F7F6F3;
    color: #37352F;
    font-weight: 600;
    border: 1px solid #E3E2E0;
    padding: 10px 12px;
    text-align: left;
}

#draftport table tr td {
    border: 1px solid #E3E2E0;
    padding: 10px 12px;
    color: #37352F;
    background: #fff;
}

/* 脚注 */
#draftport .footnote-word,
#draftport .footnote-ref {
    color: #37352F;
    text-decoration: underline;
}

#draftport .footnotes-sep {
    border-top: 1px solid #E3E2E0;
    padding-top: 20px;
    margin-top: 50px;
    font-size: 12px;
    color: #999;
}

#draftport .footnote-num {
    font-weight: bold;
    color: #37352F;
    margin-right: 4px;
}

#draftport .footnote-item p {
    color: #666;
    font-size: 12px;
    margin: 4px 0;
}

/* 公式 */
#draftport .block-equation svg {
    max-width: 100% !important;
}

#draftport .inline-equation svg {
    max-width: 100%;
    vertical-align: middle;
}


/* 提示块 - 知识库风格 */
#draftport .callout {
    margin: 24px 0;
    padding: 16px 16px 16px 20px;
    border-radius: 4px;
    border-left: 4px solid #37352F;
}

#draftport .callout-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #37352F;
    font-size: 15px;
}

#draftport .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

#draftport .callout-note {
    background: #F1F1EF;
    border-left-color: #37352F;
}

#draftport .callout-tip {
    background: #FDF5F2;
    border-left-color: #F2994A;
}

#draftport .callout-important {
    background: #E7F3F8;
    border-left-color: #2D9CDB;
}

#draftport .callout-warning {
    background: #FFF4E5;
    border-left-color: #FF9800;
}

#draftport .callout-caution {
    background: #FFEBEE;
    border-left-color: #F44336;
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
