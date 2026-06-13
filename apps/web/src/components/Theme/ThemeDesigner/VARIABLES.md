# DraftPort 主题 CSS 变量清单

以下是 DraftPort 主题系统使用的所有 CSS 变量。你可以在「手写 CSS 模式」下修改这些变量来自定义主题。

## 全局

| 变量名                          | 说明                | 示例值                     |
| ------------------------------- | ------------------- | -------------------------- |
| `--draftport-page-padding`      | 页面左右内边距      | `20px`                     |
| `--draftport-font-size`         | 正文字体大小        | `16px`                     |
| `--draftport-line-height`       | 正文行高            | `1.7`                      |
| `--draftport-paragraph-margin`  | 段落上下间距        | `16px`                     |
| `--draftport-paragraph-padding` | 段落上下内边距      | `0px`                      |
| `--draftport-text-color`        | 正文颜色            | `#333`                     |
| `--draftport-primary-color`     | 主题色              | `#1e6bb8`                  |
| `--draftport-primary-color-20`  | 主题色 (透明度 12%) | `rgba(30, 107, 184, 0.12)` |
| `--draftport-primary-color-30`  | 主题色 (透明度 18%) | `rgba(30, 107, 184, 0.18)` |
| `--draftport-primary-color-50`  | 主题色 (透明度 50%) | `#1e6bb850`                |
| `--draftport-letter-spacing`    | 全局字间距          | `0px`                      |
| `--draftport-underline-style`   | 下划线样式          | `solid`                    |
| `--draftport-underline-color`   | 下划线颜色          | `currentColor`             |

## 标题

| 变量名                         | 说明      |
| ------------------------------ | --------- |
| `--draftport-h1-font-size`     | H1 字号   |
| `--draftport-h1-color`         | H1 颜色   |
| `--draftport-h1-margin-top`    | H1 上边距 |
| `--draftport-h1-margin-bottom` | H1 下边距 |
| `--draftport-h2-font-size`     | H2 字号   |
| `--draftport-h2-color`         | H2 颜色   |
| `--draftport-h2-margin-top`    | H2 上边距 |
| `--draftport-h2-margin-bottom` | H2 下边距 |
| `--draftport-h3-font-size`     | H3 字号   |
| `--draftport-h3-color`         | H3 颜色   |
| `--draftport-h3-margin-top`    | H3 上边距 |
| `--draftport-h3-margin-bottom` | H3 下边距 |
| `--draftport-h4-font-size`     | H4 字号   |
| `--draftport-h4-color`         | H4 颜色   |
| `--draftport-h4-margin-top`    | H4 上边距 |
| `--draftport-h4-margin-bottom` | H4 下边距 |

## 引用

| 变量名                           | 说明                           |
| -------------------------------- | ------------------------------ |
| `--draftport-quote-background`   | 背景色                         |
| `--draftport-quote-border-color` | 边框颜色                       |
| `--draftport-quote-border-width` | 边框宽度                       |
| `--draftport-quote-border-style` | 边框样式 (solid/dashed/dotted) |
| `--draftport-quote-text-color`   | 文字颜色                       |
| `--draftport-quote-font-size`    | 字号                           |
| `--draftport-quote-line-height`  | 行高                           |
| `--draftport-quote-padding-x`    | 水平内边距                     |
| `--draftport-quote-padding-y`    | 垂直内边距                     |

## 代码

| 变量名                               | 说明           |
| ------------------------------------ | -------------- |
| `--draftport-code-background`        | 代码块背景色   |
| `--draftport-code-font-size`         | 代码块字号     |
| `--draftport-inline-code-color`      | 行内代码颜色   |
| `--draftport-inline-code-background` | 行内代码背景色 |

## 图片

| 变量名                                | 说明         |
| ------------------------------------- | ------------ |
| `--draftport-image-margin`            | 图片间距     |
| `--draftport-image-border-radius`     | 图片圆角     |
| `--draftport-image-caption-color`     | 图注颜色     |
| `--draftport-image-caption-font-size` | 图注字号     |
| `--draftport-image-caption-align`     | 图注对齐方式 |

## 链接与装饰

| 变量名                        | 说明         |
| ----------------------------- | ------------ |
| `--draftport-link-color`      | 链接颜色     |
| `--draftport-italic-color`    | 斜体颜色     |
| `--draftport-del-color`       | 删除线颜色   |
| `--draftport-mark-background` | 高亮背景色   |
| `--draftport-mark-color`      | 高亮文字颜色 |

## 表格

| 变量名                                | 说明         |
| ------------------------------------- | ------------ |
| `--draftport-table-header-background` | 表头背景色   |
| `--draftport-table-header-color`      | 表头文字颜色 |
| `--draftport-table-border-color`      | 表格边框颜色 |

## 分割线

| 变量名                  | 说明     |
| ----------------------- | -------- |
| `--draftport-hr-color`  | 颜色     |
| `--draftport-hr-height` | 高度     |
| `--draftport-hr-margin` | 上下间距 |

## 列表

| 变量名                             | 说明             |
| ---------------------------------- | ---------------- |
| `--draftport-list-spacing`         | 列表项间距       |
| `--draftport-list-marker-color`    | 列表符号颜色     |
| `--draftport-list-marker-color-l2` | 二级列表符号颜色 |
