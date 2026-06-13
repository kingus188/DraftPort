/**
 * 获取代码主题 CSS
 */
export function getCodeThemeCSS(themeId: string): string {
  const themes: Record<string, string> = {
    github: `
            #draftport .hljs-comment, #draftport .hljs-quote { color: #998; font-style: italic; }
            #draftport .hljs-keyword, #draftport .hljs-selector-tag, #draftport .hljs-subst { color: #333; font-weight: bold; }
            #draftport .hljs-string, #draftport .hljs-doctag { color: #d14; }
            #draftport .hljs-title, #draftport .hljs-section, #draftport .hljs-selector-id { color: #900; font-weight: bold; }
            #draftport .hljs-type, #draftport .hljs-class .hljs-title { color: #458; font-weight: bold; }
            #draftport .hljs-variable, #draftport .hljs-template-variable { color: #008080; }
            #draftport .hljs-attr { color: #000080; }
        `,
    monokai: `
            #draftport .hljs { color: #f8f8f2; }
            #draftport .hljs-comment, #draftport .hljs-quote { color: #75715e; }
            #draftport .hljs-keyword, #draftport .hljs-selector-tag, #draftport .hljs-literal { color: #f92672; }
            #draftport .hljs-string, #draftport .hljs-attr { color: #e6db74; }
            #draftport .hljs-title, #draftport .hljs-section { color: #a6e22e; }
            #draftport .hljs-type, #draftport .hljs-class .hljs-title { color: #66d9ef; font-style: italic; }
            #draftport .hljs-built_in, #draftport .hljs-selector-attr { color: #ae81ff; }
        `,
    vscode: `
            #draftport .hljs { color: #d4d4d4; }
            #draftport .hljs-comment { color: #6a9955; }
            #draftport .hljs-keyword { color: #569cd6; }
            #draftport .hljs-string { color: #ce9178; }
            #draftport .hljs-literal { color: #569cd6; }
            #draftport .hljs-number { color: #b5cea8; }
            #draftport .hljs-function { color: #dcdcaa; }
            #draftport .hljs-class { color: #4ec9b0; }
            #draftport .hljs-attr { color: #9cdcfe; }
        `,
    "night-owl": `
            #draftport .hljs { color: #d6deeb; }
            #draftport .hljs-comment { color: #637777; font-style: italic; }
            #draftport .hljs-keyword { color: #c792ea; }
            #draftport .hljs-selector-tag { color: #ff5874; }
            #draftport .hljs-string { color: #ecc48d; }
            #draftport .hljs-variable { color: #addb67; }
            #draftport .hljs-number { color: #f78c6c; }
            #draftport .hljs-function { color: #82aaff; }
            #draftport .hljs-attr { color: #7fdbca; }
        `,
    dracula: `
            #draftport .hljs { color: #f8f8f2; }
            #draftport .hljs-comment { color: #6272a4; }
            #draftport .hljs-keyword { color: #ff79c6; }
            #draftport .hljs-selector-tag { color: #ff79c6; }
            #draftport .hljs-literal { color: #bd93f9; }
            #draftport .hljs-string { color: #f1fa8c; }
            #draftport .hljs-variable { color: #50fa7b; }
            #draftport .hljs-number { color: #bd93f9; }
            #draftport .hljs-function { color: #50fa7b; }
            #draftport .hljs-class { color: #8be9fd; }
            #draftport .hljs-attr { color: #50fa7b; }
        `,
    "solarized-dark": `
            #draftport .hljs { color: #839496; }
            #draftport .hljs-comment { color: #586e75; font-style: italic; }
            #draftport .hljs-keyword { color: #859900; }
            #draftport .hljs-selector-tag { color: #859900; }
            #draftport .hljs-string { color: #2aa198; }
            #draftport .hljs-variable { color: #b58900; }
            #draftport .hljs-number { color: #d33682; }
            #draftport .hljs-function { color: #268bd2; }
            #draftport .hljs-attr { color: #b58900; }
        `,
    "solarized-light": `
            #draftport .hljs { color: #657b83; }
            #draftport .hljs-comment { color: #93a1a1; font-style: italic; }
            #draftport .hljs-keyword { color: #859900; }
            #draftport .hljs-selector-tag { color: #859900; }
            #draftport .hljs-string { color: #2aa198; }
            #draftport .hljs-variable { color: #b58900; }
            #draftport .hljs-number { color: #d33682; }
            #draftport .hljs-function { color: #268bd2; }
            #draftport .hljs-attr { color: #b58900; }
        `,
    xcode: `
            #draftport .hljs { color: #000000; }
            #draftport .hljs-comment { color: #007400; }
            #draftport .hljs-quote { color: #007400; }
            #draftport .hljs-keyword { color: #aa0d91; }
            #draftport .hljs-selector-tag { color: #aa0d91; }
            #draftport .hljs-literal { color: #aa0d91; }
            #draftport .hljs-string { color: #c41a16; }
            #draftport .hljs-attr { color: #836C28; }
            #draftport .hljs-title { color: #1c00cf; }
            #draftport .hljs-section { color: #1c00cf; }
            #draftport .hljs-type { color: #5c2699; }
            #draftport .hljs-class .hljs-title { color: #5c2699; }
            #draftport .hljs-variable { color: #3f6e74; }
            #draftport .hljs-built_in { color: #5c2699; }
            #draftport .hljs-number { color: #1c00cf; }
        `,
    "atom-one-light": `
            #draftport .hljs { color: #383a42; }
            #draftport .hljs-comment { color: #a0a1a7; font-style: italic; }
            #draftport .hljs-keyword { color: #a626a4; }
            #draftport .hljs-selector-tag { color: #e45649; }
            #draftport .hljs-string { color: #50a14f; }
            #draftport .hljs-variable { color: #986801; }
            #draftport .hljs-number { color: #986801; }
            #draftport .hljs-function { color: #4078f2; }
            #draftport .hljs-attr { color: #986801; }
            #draftport .hljs-class .hljs-title { color: #c18401; }
            #draftport .hljs-type { color: #986801; }
            #draftport .hljs-built_in { color: #c18401; }
        `,
  };
  return themes[themeId] || "";
}
