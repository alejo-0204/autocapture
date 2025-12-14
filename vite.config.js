import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'
import { resolve, join } from 'path'
import { readFileSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    // Plugin para servir archivos WASM con el MIME type correcto
    {
      name: 'configure-response-headers',
      configureServer(server) {
        // Middleware para servir archivos WASM desde node_modules
        server.middlewares.use('/node_modules/onnxruntime-web/dist', (req, res, next) => {
          if (req.url.endsWith('.wasm')) {
            try {
              const fileName = req.url.replace('/node_modules/onnxruntime-web/dist', '')
              const filePath = join(__dirname, 'node_modules/onnxruntime-web/dist', fileName)
              const file = readFileSync(filePath)
              res.setHeader('Content-Type', 'application/wasm')
              res.setHeader('Content-Length', file.length)
              res.setHeader('Cache-Control', 'public, max-age=31536000')
              res.end(file)
            } catch (error) {
              console.error('Error sirviendo WASM:', error.message)
              next()
            }
          } else {
            next()
          }
        })
        
        // Middleware general para archivos WASM
        server.middlewares.use((req, res, next) => {
          if (req.url.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        })
      }
    }
  ],
  resolve: {
    alias: {
      // Asegurar que los archivos WASM se resuelvan correctamente
      'onnxruntime-web': resolve(__dirname, 'node_modules/onnxruntime-web')
    }
  },
  optimizeDeps: {
    include: ['onnxruntime-web']
  },
  server: {
    https: false,
    host: true,
    allowedHosts: [
      'wynona-unexonerative-unfundamentally.ngrok-free.dev'
    ],
    fs: {
      strict: false,
      // Permitir acceso a node_modules para servir archivos WASM
      allow: ['..']
    }
  },
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  assetsInclude: ['**/*.wasm']
})
