/**
 * Utilidades para la inferencia del modelo ONNX
 */

import * as ort from 'onnxruntime-web'
import { MODEL_CONFIG, IMAGE_NORMALIZATION, CLASS_MAPPING, DETECTION_COLORS, MODEL_OUTPUT_FORMAT, AVAILABLE_MODELS } from '../config/modelConfig.js'
import { warnInt8NotSupported } from './quantization.js'

/**
 * Configura las rutas de los archivos WASM de ONNX Runtime
 */
export function configureWasmPaths() {
  ort.env.wasm.wasmPaths = MODEL_CONFIG.getWasmPaths()
}

/**
 * Carga el modelo ONNX desde la ruta especificada
 * @param {string} modelKey - Clave del modelo a cargar (opcional, usa el configurado por defecto)
 * @param {AbortSignal} signal - Signal para cancelar la carga
 * @returns {Promise<ort.InferenceSession>} Sesión del modelo cargado
 */
export async function loadModel(modelKey = null, executionProvider = 'wasm', signal = null) {
  // Si se especifica un modelo, actualizar la configuración
  if (modelKey) {
    MODEL_CONFIG.setModel(modelKey)
  }
  
  const modelPath = MODEL_CONFIG.MODEL_PATH
  const isInt8Model = modelKey && modelKey.includes('_int8')
  
  console.log('Intentando cargar modelo desde:', modelPath)
  console.log('Base URL:', window.location.origin)
  
  // Verificar si es un modelo INT8 y mostrar warning
  if (isInt8Model) {
    warnInt8NotSupported(modelKey)
    throw new Error(
      '❌ Modelos INT8 no soportados\n\n' +
      'Los modelos cuantizados INT8 no pueden ser utilizados con onnxruntime-web porque:\n' +
      '1. onnxruntime-web no implementa los operadores cuantizados requeridos (ConvInteger, QLinearConv, etc.)\n' +
      '2. La descuantización en tiempo de ejecución es extremadamente compleja y propensa a errores\n' +
      '3. Requeriría modificar el código fuente de onnxruntime-web (C++/WASM), lo cual no es posible desde JavaScript\n\n' +
      '💡 Solución: Usa los modelos F32 o F16 que están completamente soportados:\n' +
      '   - Modelo Pequeño F32/F16 (128x128)\n' +
      '   - Modelo Mediano F32/F16 (256x256)\n' +
      '   - Modelo Grande F32/F16 (320x320)'
    )
  }
  
  // Intentar cargar el modelo con timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MODEL_CONFIG.MODEL_LOAD_TIMEOUT)
  
  // Si se proporciona un signal externo, usarlo también
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }
  
  try {
    const response = await fetch(modelPath, {
      method: 'GET',
      headers: {
        'Accept': 'application/octet-stream'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = 'No se pudo leer el mensaje de error'
      }
      console.error('Error HTTP:', response.status, response.statusText)
      console.error('Error body:', errorText)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentLength = response.headers.get('content-length')
    console.log('Modelo descargado, tamaño:', contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'desconocido')
    
    let arrayBuffer = await response.arrayBuffer()
    console.log('ArrayBuffer creado, tamaño:', `${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('El archivo está vacío')
    }
    
    console.log('Creando sesión ONNX...')
    
    // Verificar disponibilidad del proveedor
    let providers = []
    const isF16Model = modelKey && modelKey.includes('_f16')
    
    if (executionProvider === 'webgpu') {
      // Los modelos F16 no son compatibles con WebGPU
      if (isF16Model) {
        console.warn('⚠️ Modelos F16 no son compatibles con WebGPU. Forzando uso de WASM (CPU)')
        console.warn('   Razón: onnxruntime-web no implementa completamente float16 en WebGPU')
        console.warn('   El operador Resize falla con "Invalid data type"')
        providers = ['wasm']
      } else if (typeof navigator !== 'undefined' && navigator.gpu) {
        providers = ['webgpu', 'wasm'] // Fallback a WASM si WebGPU falla
        console.log('✅ WebGPU disponible, intentando usar GPU')
      } else {
        console.warn('⚠️ WebGPU no disponible, usando WASM como fallback')
        providers = ['wasm']
      }
    } else {
      providers = ['wasm']
      console.log('✅ Usando CPU (WASM)')
    }
    
    // Cargar modelo con el proveedor seleccionado
    let session
    try {
      session = await ort.InferenceSession.create(arrayBuffer, {
        executionProviders: providers,
        graphOptimizationLevel: 'all'
      })
      const providerUsed = providers[0]
      console.log(`✅ Modelo cargado exitosamente con ${providerUsed.toUpperCase()}`)
    } catch (error) {
      console.error('Error al crear sesión ONNX:', error)
      
      // Si falla con WebGPU, intentar con WASM como fallback
      if (executionProvider === 'webgpu' && providers.includes('webgpu')) {
        try {
          console.log('⚠️ WebGPU falló, intentando con WASM como fallback...')
          session = await ort.InferenceSession.create(arrayBuffer, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
          })
          console.log('✅ Modelo cargado con WASM (fallback)')
        } catch (error2) {
          throw new Error(`No se pudo cargar el modelo. Error: ${error2.message}`)
        }
      } else {
        // Si falla con WASM, intentar con optimización básica
        try {
          console.log('Intentando con optimización básica...')
          session = await ort.InferenceSession.create(arrayBuffer, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'basic'
          })
          console.log('✅ Modelo cargado con optimización básica')
        } catch (error2) {
          throw new Error(`No se pudo cargar el modelo. Error: ${error2.message}`)
        }
      }
    }
    
    console.log('✅ Modelo best.onnx cargado exitosamente')
    console.log('Input names:', session.inputNames)
    console.log('Output names:', session.outputNames)
    
    // Intentar obtener metadatos de entrada de forma segura
    try {
      if (session.inputMetadata) {
        const metadata = session.inputNames.map(name => {
          const input = session.inputMetadata[name]
          if (input) {
            return { name, shape: input.shape, type: input.type }
          }
          return { name, shape: 'unknown', type: 'unknown' }
        })
        console.log('Input metadata:', metadata)
      } else {
        console.log('Input metadata no disponible')
      }
    } catch (metadataError) {
      console.warn('No se pudieron obtener los metadatos de entrada:', metadataError)
    }
    
    return session
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Preprocesa una imagen para el modelo ONNX
 * @param {ImageData} imageData - Datos de la imagen original
 * @param {number} width - Ancho de la imagen original
 * @param {number} height - Alto de la imagen original
 * @returns {Float32Array} Tensor preprocesado [1, 3, 320, 320]
 */
export function preprocessImage(imageData, width, height) {
  const targetSize = MODEL_CONFIG.INPUT_SIZE
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = targetSize
  tempCanvas.height = targetSize
  const tempCtx = tempCanvas.getContext('2d')
  
  // Dibujar imagen redimensionada
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceCtx = sourceCanvas.getContext('2d')
  sourceCtx.putImageData(imageData, 0, 0)
  
  tempCtx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize)
  const resizedData = tempCtx.getImageData(0, 0, targetSize, targetSize)
  
  // Convertir a tensor normalizado [1, 3, 320, 320]
  const tensor = new Float32Array(1 * 3 * targetSize * targetSize)
  const data = resizedData.data
  
  // Normalizar y reorganizar de HWC a CHW
  const { mean, std } = IMAGE_NORMALIZATION
  for (let i = 0; i < targetSize * targetSize; i++) {
    const r = data[i * 4] / 255.0
    const g = data[i * 4 + 1] / 255.0
    const b = data[i * 4 + 2] / 255.0
    
    // Normalización ImageNet
    tensor[i] = (r - mean.r) / std.r // R channel
    tensor[targetSize * targetSize + i] = (g - mean.g) / std.g // G channel
    tensor[2 * targetSize * targetSize + i] = (b - mean.b) / std.b // B channel
  }
  
  return tensor
}

/**
 * Ejecuta la inferencia del modelo con una imagen preprocesada
 * @param {ort.InferenceSession} session - Sesión del modelo
 * @param {Float32Array} preprocessedImage - Imagen preprocesada
 * @returns {Promise<ort.InferenceSession.OutputType>} Resultados de la inferencia
 */
export async function runInference(session, preprocessedImage) {
  const feeds = {}
  const inputName = session.inputNames[0]
  feeds[inputName] = new ort.Tensor('float32', preprocessedImage, [1, 3, MODEL_CONFIG.INPUT_SIZE, MODEL_CONFIG.INPUT_SIZE])
  
  const results = await session.run(feeds)
  return results
}

/**
 * Procesa los resultados de la inferencia y extrae las detecciones
 * @param {ort.InferenceSession.OutputType} results - Resultados de la inferencia
 * @param {string} outputName - Nombre del tensor de salida
 * @param {number} threshold - Umbral de confianza (opcional, usa MODEL_CONFIG.CONFIDENCE_THRESHOLD por defecto)
 * @returns {Array} Array de detecciones válidas con {x, y, w, h, conf, cls}
 */
export function extractDetections(results, outputName, threshold = null) {
  const output = results[outputName]
  const outputData = Array.from(output.data)
  const outputShape = output.dims
  
  const confidenceThreshold = threshold !== null ? threshold : MODEL_CONFIG.CONFIDENCE_THRESHOLD
  const validDetections = []
  
  if (outputShape.length === 3 && outputShape[0] === 1 && outputShape[1] === 6) {
    // Formato [1, 6, num_detections] - features x detecciones
    const numDetections = outputShape[2]
    const { X, Y, WIDTH, HEIGHT, CONFIDENCE, CLASS } = MODEL_OUTPUT_FORMAT.FEATURES
    
    for (let i = 0; i < numDetections; i++) {
      const x = outputData[X * numDetections + i]
      const y = outputData[Y * numDetections + i]
      const w = outputData[WIDTH * numDetections + i]
      const h = outputData[HEIGHT * numDetections + i]
      const feature4 = outputData[CONFIDENCE * numDetections + i]
      const feature5 = outputData[CLASS * numDetections + i]
      
      // Interpretar el formato de salida
      const sumProbs = feature4 + feature5
      const isProbFormat = sumProbs > 0.8 && sumProbs < 1.2
      
      let conf, cls, clsConf
      
      if (isProbFormat && feature4 > 0 && feature5 > 0) {
        // Formato de probabilidades: [x, y, w, h, prob_class_0, prob_class_1]
        clsConf = Math.max(feature4, feature5)
        cls = feature4 > feature5 ? 0 : 1
        conf = clsConf
      } else {
        // Formato estándar: [x, y, w, h, confidence, class_index]
        conf = feature4
        cls = Math.round(feature5)
        clsConf = conf
        
        // Lógica adicional para determinar la clase
        if (conf > 0.7 && feature5 < 0.1) {
          cls = 0
        } else if (conf > 0.7 && feature5 > 0.5) {
          cls = 1
        }
      }
      
      // Filtrar detecciones con confianza suficiente y área válida
      if (conf > confidenceThreshold && w > 0 && h > 0) {
        validDetections.push({ x, y, w, h, conf, cls, clsConf, f4: feature4, f5: feature5 })
      }
    }
  }
  
  return validDetections
}

/**
 * Determina el estado de detección basado en la clase y confianza
 * @param {number} classIndex - Índice de clase del modelo
 * @param {number} confidence - Confianza de la detección
 * @returns {Object} Objeto con {status, className}
 */
export function mapClassToStatus(classIndex, confidence) {
  if (confidence <= 0.5) {
    return {
      status: 'none',
      className: CLASS_MAPPING.STATUS_TO_NAME.none
    }
  }
  
  const status = CLASS_MAPPING.CLASS_TO_STATUS[classIndex] || 
                 (classIndex > 0 ? 'back' : 'front')
  
  return {
    status,
    className: CLASS_MAPPING.STATUS_TO_NAME[status] || 'Desconocido'
  }
}

/**
 * Dibuja un bounding box en el canvas
 * @param {CanvasRenderingContext2D} ctx - Contexto del canvas
 * @param {number} x - Coordenada X (esquina superior izquierda)
 * @param {number} y - Coordenada Y (esquina superior izquierda)
 * @param {number} w - Ancho del box
 * @param {number} h - Alto del box
 * @param {string} status - Estado de la detección ('front', 'back', 'none')
 * @param {number} confidence - Confianza de la detección
 * @param {number} canvasWidth - Ancho del canvas
 * @param {number} canvasHeight - Alto del canvas
 */
export function drawBox(ctx, x, y, w, h, status, confidence, canvasWidth, canvasHeight) {
  const colors = DETECTION_COLORS[status] || DETECTION_COLORS.none
  const label = CLASS_MAPPING.STATUS_TO_NAME[status] || 'No Detectado'
  
  // Dibujar el box
  ctx.strokeStyle = colors.border
  ctx.fillStyle = colors.fill
  ctx.lineWidth = 3
  
  // Rectángulo relleno
  ctx.fillRect(x, y, w, h)
  
  // Borde del rectángulo
  ctx.strokeRect(x, y, w, h)
  
  // Dibujar etiqueta con fondo
  const fontSize = Math.max(16, Math.min(canvasWidth || ctx.canvas.width, canvasHeight || ctx.canvas.height) / 30)
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textBaseline = 'top'
  
  const text = `${label} ${(confidence * 100).toFixed(1)}%`
  const textMetrics = ctx.measureText(text)
  const textWidth = textMetrics.width
  const textHeight = fontSize
  const padding = 8
  
  // Fondo del texto
  ctx.fillStyle = colors.border
  ctx.fillRect(
    x,
    y - textHeight - padding * 2,
    textWidth + padding * 2,
    textHeight + padding * 2
  )
  
  // Texto
  ctx.fillStyle = 'white'
  ctx.fillText(
    text,
    x + padding,
    y - textHeight - padding
  )
}

/**
 * Escala las coordenadas del modelo (320x320) al tamaño del canvas
 * @param {Object} box - Box con coordenadas {x, y, w, h} en espacio del modelo
 * @param {number} canvasWidth - Ancho del canvas
 * @param {number} canvasHeight - Alto del canvas
 * @returns {Object} Box escalado con coordenadas en espacio del canvas
 */
export function scaleBoxToCanvas(box, canvasWidth, canvasHeight) {
  const scaleX = canvasWidth / MODEL_CONFIG.INPUT_SIZE
  const scaleY = canvasHeight / MODEL_CONFIG.INPUT_SIZE
  
  // Convertir de centro (x, y) y tamaño (w, h) a esquina superior izquierda
  const x = (box.x - box.w / 2) * scaleX
  const y = (box.y - box.h / 2) * scaleY
  const w = box.w * scaleX
  const h = box.h * scaleY
  
  return { x, y, w, h }
}

