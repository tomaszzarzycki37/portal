import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('quill')) return 'vendor-quill'
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
          if (id.includes('react-redux') || id.includes('@reduxjs') || id.includes('/redux/')) {
            return 'vendor-redux'
          }
          if (id.includes('react')) return 'vendor-react'
          if (id.includes('axios') || id.includes('dompurify')) return 'vendor-utils'
        },
      },
    },
  },
})
