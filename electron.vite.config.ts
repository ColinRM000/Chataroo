import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['electron-store']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          popout: resolve('src/renderer/popout.html')
        }
      }
    }
  }
})
