/** 一个标题在大纲中的条目;index 是文档内标题的出现次序(从 0 起),跨表面统一寻址。 */
export interface OutlineItem {
  /** 标题层级 1-6。 */
  level: number;
  /** 标题纯文本(去掉前缀 # 与首尾空白)。 */
  text: string;
  /** 文档内第几个标题,从 0 开始。这是跳转寻址的唯一键。 */
  index: number;
  /** 标题所在行号,从 0 开始;供 CodeMirror 行定位使用。 */
  line: number;
}
