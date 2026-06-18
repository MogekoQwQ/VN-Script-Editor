import { APP_NAME, APP_VERSION } from "../constants/app"

const LINES = [
  "这是一个面向视觉小说写作的本地文本编辑器。",
  "当前版本没有后端服务，脚本文本不会上传。",
  "默认数据保存在当前浏览器本地。",
  "重要项目请定期导出项目文件备份。",
  "Ren'Py 导出是脚本片段，不等于完整 Ren'Py 工程。",
  "PDF 导出通过浏览器打印功能保存为 PDF。"
]

export function AboutPanel() {
  return (
    <div className="about-panel">
      <div className="about-panel-title">
        <strong>{APP_NAME}</strong>
        <span>{APP_VERSION}</span>
      </div>

      <div className="about-panel-list">
        {LINES.map((line) => (
          <p key={line} className="panel-hint">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
