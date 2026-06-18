import { APP_NAME, APP_VERSION } from "../constants/app"
import type { VNProject } from "../types"

export const defaultProject: VNProject = {
  version: 1,
  title: "视觉小说脚本编辑器示例",
  characters: {
    Mogeko: {
      id: "mogeko",
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
      content: "视觉小说脚本编辑器示例"
    },
    {
      id: "line_2",
      speaker: "",
      content:
        "这个示例项目会展示基本写法。左边填写说话人，右边填写正文；说话人为空时，这一行就是旁白。"
    },
    {
      id: "line_3",
      speaker: "Mogeko",
      content: "角色台词会根据右侧的角色映射导出为 Ren'Py 角色 ID。"
    },
    {
      id: "line_4",
      speaker: "助手",
      content:
        "例如我的显示名是“助手”，导出 ID 是 helper，所以 Ren'Py 导出时会变成 helper \"……\"。"
    },
    {
      id: "line_5",
      speaker: "#",
      content: "说话人填 # 时，这一行会作为备注导出为 Ren'Py 注释。"
    },
    {
      id: "line_6",
      speaker: "#2",
      content: "写作和编辑"
    },
    {
      id: "line_7",
      speaker: "Mogeko",
      content: "按 Enter 可以在当前行下方新增一行，并把光标移动到新行的说话人栏。"
    },
    {
      id: "line_8",
      speaker: "助手",
      content: "在内容栏里按 Shift + Enter，可以手动输入换行。"
    },
    {
      id: "line_9",
      speaker: "",
      content: "右侧的“每行字数”只影响编辑器中的阅读宽度，不会真的往文本里插入换行符。"
    },
    {
      id: "line_10",
      speaker: "#3",
      content: "选择模式"
    },
    {
      id: "line_11",
      speaker: "Mogeko",
      content: "双击任意行可以进入选择模式。"
    },
    {
      id: "line_12",
      speaker: "助手",
      content:
        "进入选择模式后，左侧会出现复选框。普通点击可以复选，Shift 点击可以选择或取消一个范围。"
    },
    {
      id: "line_13",
      speaker: "Mogeko",
      content: "选择多行后，可以剪切、复制、粘贴、删除、上移或下移。"
    },
    {
      id: "line_14",
      speaker: "#4",
      content: "单行菜单"
    },
    {
      id: "line_15",
      speaker: "助手",
      content: "每一行右侧的菜单可以插入行、剪切行、复制行、粘贴行、移动行或删除行。"
    },
    {
      id: "line_16",
      speaker: "#2",
      content: "保存和查找"
    },
    {
      id: "line_17",
      speaker: "",
      content: "编辑内容会自动保存在当前浏览器中。为了避免浏览器数据丢失，重要项目建议定期导出项目文件。"
    },
    {
      id: "line_18",
      speaker: "Mogeko",
      content: "右侧“保存”面板可以导出或导入项目文件。项目文件是完整源文件，适合备份和继续编辑。"
    },
    {
      id: "line_19",
      speaker: "助手",
      content: "查找替换可以搜索说话人和正文，也可以批量替换文本。替换操作可以撤销。"
    },
    {
      id: "line_20",
      speaker: "#2",
      content: "导出"
    },
    {
      id: "line_21",
      speaker: "Mogeko",
      content: "Ren'Py 导出会生成脚本片段，可以复制到 Ren'Py 工程里继续整理。"
    },
    {
      id: "line_22",
      speaker: "助手",
      content: "PDF 阅读稿会打开一个预览页，你可以在预览页里打印或保存为 PDF，用来试读和校对。"
    },
    {
      id: "line_23",
      speaker: "#",
      content: "这里可以写演出、立绘、变量或跳转提示，之后再进入 Ren'Py 编辑器手动修改。"
    }
  ],
  settings: {
    exportHeadings: true,
    indent: "",
    readingWrapChars: 32
  },
  meta: {
    appName: APP_NAME,
    appVersion: APP_VERSION
  }
}
