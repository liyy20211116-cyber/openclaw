import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {},
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18782',
        changeOrigin: true,
      },
      // 与 writeback-api.ts 的 GET /health 对齐，供前端探测本地后端是否已启动
      '/health': {
        target: 'http://127.0.0.1:18782',
        changeOrigin: true,
      },
    },
  },
})
