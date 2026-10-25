import { APP_NAME, APP_VERSION } from "../constants/app"
import type { VNProject } from "../types"

export const defaultProject: VNProject = {
  version: 1,
  title: "脚本编辑器功能示例",
  characters: {
    作者: {
      id: "writer",
      color: "#990E00"
    },
    助手: {
      id: "helper",
      color: "#2F5D8C"
    }
  },
  lines: [
    {
      id: "line_1",
      speaker: "#1",
      content: "脚本编辑器功能示例"
    },
    {
      id: "line_2",
      speaker: "",
      content:
        "本项目用于演示脚本行、角色映射、行范围操作、Menu、章节折叠及保存导出功能。示例内容可直接编辑。"
    },
    {
      id: "line_3",
      speaker: "作者",
      content: "左边是说话人，右边是正文。说话人留空，就是旁白。"
    },
    {
      id: "line_4",
      speaker: "助手",
      content:
        "右侧角色映射保存显示名、导出 ID 和颜色。例如“助手”使用 helper 作为 Ren'Py 导出 ID。"
    },
    {
      id: "line_5",
      speaker: "#",
      content: "备注可以记录音效、画面和演出提示。导出 Ren'Py 时，它会成为代码注释。"
    },
    {
      id: "line_6",
      speaker: "#2",
      content: "文本编辑"
    },
    {
      id: "line_7",
      speaker: "作者",
      content: "按 Enter 可以在当前行下方新增一行，并把光标移动到新行的说话人栏。"
    },
    {
      id: "line_8",
      speaker: "助手",
      content: "Shift + Enter 在同一条正文中手动换行。\nTab 或 Shift + Tab 在当前行的说话人与正文之间切换。"
    },
    {
      id: "line_9",
      speaker: "",
      content: "“每行字数”控制阅读宽度，“文字大小”控制编辑区字号。自动换行只改变显示，不会往正文插入换行符。"
    },
    {
      id: "line_10",
      speaker: "#3",
      content: "连续行范围操作"
    },
    {
      id: "line_11",
      speaker: "作者",
      content: "点击行左侧的空白选择栏，可以选中整行。按住并上下拖动，或按 Shift 点击另一行，可以选中连续范围。"
    },
    {
      id: "line_12",
      speaker: "助手",
      content:
        "未编辑输入框时，上方工具条显示行范围操作。剪切、复制和删除作用于当前范围，粘贴插入到范围最后一行下方。点击输入框后恢复文字编辑。"
    },
    {
      id: "line_13",
      speaker: "作者",
      content: "输入框内粘贴保持普通文字编辑行为。需要把多行文字拆成脚本行时，请使用右侧“从纯文本插入”，检查匹配规则并确认说话人后再插入。"
    },
    {
      id: "line_14",
      speaker: "#4",
      content: "撤销与重做"
    },
    {
      id: "line_15",
      speaker: "助手",
      content: "剪切、删除、插入和替换都可以撤销。Ctrl / Cmd + Z 撤销，Ctrl / Cmd + Shift + Z 重做。"
    },
    { id: "example_menu_heading", speaker: "#2", content: "Menu 结构示例" },
    { id: "example_menu_intro", speaker: "", content: "下面是一段完整的 Menu。特殊标记写在说话人栏里，每个选项后面的剧情一直延续到下一个选项或结束标记。" },
    { id: "example_menu", speaker: "#menu", content: "选项提示文本" },
    { id: "example_option_write", speaker: "#option", content: "选项一：台词与旁白" },
    { id: "example_write_dialogue", speaker: "作者", content: "此台词属于选项一。" },
    { id: "example_write_narration", speaker: "", content: "此旁白也属于选项一。下一个 #option 标记结束该选项的内容范围。" },
    { id: "example_option_read", speaker: "#option", content: "选项二：台词与备注" },
    { id: "example_read_dialogue", speaker: "助手", content: "此台词属于选项二。" },
    { id: "example_read_note", speaker: "#", content: "此备注属于选项二，导出时生成注释。" },
    { id: "example_endmenu", speaker: "#endmenu", content: "" },
    { id: "example_common", speaker: "", content: "此行位于 #endmenu 之后，属于共通内容。导出时恢复 Menu 外的缩进。" },
    { id: "example_fold_heading", speaker: "#3", content: "正文折叠与目录导航" },
    { id: "example_fold_body", speaker: "助手", content: "点击正文标题或 #menu 左侧的小箭头可以折叠内容。展开父章节后，子章节和 Menu 会保留原来的折叠状态。" },
    { id: "example_outline_body", speaker: "", content: "左侧目录可以分别收起章节和选项列表。点击标题、Menu 或选项名称会跳转到对应行，必要时自动展开正文。折叠不会删除文字，也不会影响导出。" },
    {
      id: "line_16",
      speaker: "#2",
      content: "项目保存与查找"
    },
    {
      id: "line_17",
      speaker: "",
      content: "右侧“保存”中的项目名称用于生成导出文件名。项目自动保存在当前浏览器；项目文件包含完整数据，可用于备份和重新导入。"
    },
    {
      id: "line_18",
      speaker: "作者",
      content: "清理浏览器数据可能丢失自动保存。重要内容请定期导出项目文件备份。"
    },
    {
      id: "line_19",
      speaker: "助手",
      content: "Ctrl / Cmd + F 打开查找。查找替换同时搜索说话人和正文，替换后也可以撤销。"
    },
    {
      id: "line_20",
      speaker: "#3",
      content: "导出阅读稿和脚本片段"
    },
    {
      id: "line_21",
      speaker: "作者",
      content: "Ren'Py 导出会生成脚本片段，Menu 会生成选项和剧情缩进；如果结构不完整，会提示具体行号。片段仍需放进自己的 Ren'Py 工程中整理。"
    },
    {
      id: "line_22",
      speaker: "助手",
      content: "“打开 PDF 阅读稿”会打开预览页。点击预览页顶部的打印按钮，选择保存为 PDF，即可用于试读或校对。"
    },
    {
      id: "line_23",
      speaker: "作者",
      content: "“新建空白项目”创建空白脚本。“重置为示例项目”恢复本示例。两项操作均会替换当前项目，执行前应导出需要保留的内容。"
    }
  ],
  settings: {
    exportHeadings: true,
    indent: "",
    readingWrapChars: 32,
    editorFontSize: 16
  },
  meta: {
    appName: APP_NAME,
    appVersion: APP_VERSION
  }
}
