import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "视觉小说脚本编辑器",
        short_name: "VN Script",
        description: "一个本地优先的视觉小说文本编辑器，可导出 Ren'Py 片段和 PDF 阅读稿。",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#f5f5f5",
        background_color: "#f5f5f5",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"]
      }
    })
  ]
})
