# 🔍 Detector de Documentos con ONNX

Aplicación Vue.js con Vite para detectar documentos en tiempo real usando la cámara web y modelos ONNX. Identifica si el documento mostrado es el frente, reverso o si no se detecta ningún documento.

## 🚀 Características

- ✅ Detección en tiempo real usando la cámara web
- ✅ Soporte para múltiples modelos ONNX (F32, F16, INT8)
- ✅ Ejecución en CPU (WASM) o GPU (WebGPU)
- ✅ Identificación de frente/reverso de documentos
- ✅ Interfaz de usuario moderna y responsive
- ✅ Estadísticas de rendimiento en tiempo real
- ✅ Gráficas de FPS, tiempo de inferencia y confianza
- ✅ Monitoreo de recursos del sistema (RAM, CPU, GPU)
- ✅ Historial de detecciones con imágenes segmentadas
- ✅ Exportación de sesiones a CSV
- ✅ Selección de cámara (múltiples cámaras)
- ✅ Umbral de confianza configurable
- ✅ Paneles laterales colapsables en móvil

## 📋 Requisitos Previos

- Node.js 16+ y npm/yarn
- Modelos ONNX entrenados para detección de documentos
- Navegador moderno con soporte para:
  - WebRTC (acceso a cámara)
  - WebGL o WASM (para ONNX Runtime)
  - WebGPU (opcional, para aceleración por GPU)

## 🛠️ Instalación

1. Instala las dependencias:

```bash
npm install
```

2. Coloca tus modelos ONNX en la carpeta `public/`:
   - `best_128_f32.onnx` - Modelo pequeño F32 (128x128)
   - `best_256_f32.onnx` - Modelo mediano F32 (256x256)
   - `best_320_f32.onnx` - Modelo grande F32 (320x320)
   - `best_128_f16.onnx` - Modelo pequeño F16 (128x128)
   - `best_256_f16.onnx` - Modelo mediano F16 (256x256)
   - `best_320_f16.onnx` - Modelo grande F16 (320x320)
   - `best_128_int8.onnx` - Modelo pequeño INT8 (128x128) - No soportado
   - `best_256_int8.onnx` - Modelo mediano INT8 (256x256) - No soportado
   - `best_320_int8.onnx` - Modelo grande INT8 (320x320) - No soportado

## 🎯 Uso

1. Inicia el servidor de desarrollo:

```bash
npm run dev
```

2. Abre tu navegador en la URL que muestra Vite (generalmente `http://localhost:5173`)

3. Configura la aplicación:
   - Selecciona el modelo de inferencia (F32 o F16 recomendados)
   - Elige el proveedor de ejecución (CPU/WASM o GPU/WebGPU)
   - Ajusta el umbral de confianza (por defecto 80%)
   - Si tienes múltiples cámaras, selecciona la deseada

4. Inicia la cámara:
   - Haz clic en "Iniciar Cámara"
   - Permite el acceso a la cámara cuando se solicite

5. Apunta la cámara hacia un documento y observa:
   - Detección en tiempo real
   - Estadísticas de rendimiento
   - Imagen segmentada del documento detectado
   - Historial de detecciones

## 📦 Estructura del Proyecto

```
src/
├── components/
│   ├── DocumentDetector.vue    # Componente principal
│   ├── DocumentDetector.css    # Estilos compartidos
│   ├── StatsPanel.vue          # Panel de estadísticas y gráficas
│   ├── CameraSection.vue       # Sección de cámara y controles
│   ├── HistoryPanel.vue        # Panel de historial e imagen segmentada
│   └── SessionsTable.vue       # Tabla de sesiones exportable
├── composables/
│   └── useCharts.js            # Composable para gráficas
├── config/
│   └── modelConfig.js          # Configuración de modelos
├── utils/
│   ├── inference.js            # Lógica de inferencia ONNX
│   └── quantization.js         # Utilidades de cuantización
├── App.vue                     # Componente raíz
├── main.js                     # Punto de entrada
└── style.css                   # Estilos globales
```

## 📦 Estructura del Modelo ONNX

El modelo ONNX debe cumplir con las siguientes especificaciones:

- **Input**: Tensor de forma `[1, 3, H, W]` donde H y W son el tamaño de entrada (128, 256 o 320)
- **Output**: Tensor con probabilidades para cada clase
- **Clases esperadas**:
  - Índice 0: No detectado
  - Índice 1: Frente
  - Índice 2: Reverso

### Normalización de Imágenes

Las imágenes se normalizan usando los valores estándar de ImageNet:
- Media: [0.485, 0.456, 0.405]
- Desviación estándar: [0.229, 0.224, 0.225]

Si tu modelo usa una normalización diferente, ajusta la función `preprocessImage` en `src/utils/inference.js`.

## 🔧 Configuración de Modelos

Los modelos se configuran en `src/config/modelConfig.js`. Puedes agregar nuevos modelos editando el objeto `AVAILABLE_MODELS`:

```javascript
AVAILABLE_MODELS: {
  '128_f32': {
    path: '/best_128_f32.onnx',
    inputSize: 128,
    label: 'Modelo Pequeño F32 (128x128)',
    description: 'Modelo optimizado para velocidad'
  },
  // ... más modelos
}
```

### Tipos de Modelos Soportados

- **F32 (Float32)**: Máxima precisión, compatible con CPU y GPU
- **F16 (Float16)**: Menor tamaño, solo compatible con CPU (WASM)
- **INT8**: No soportado (onnxruntime-web no implementa operadores cuantizados)

## 🎨 Características de la Interfaz

### Panel de Estadísticas (Izquierda)
- Métricas del modelo: FPS, tiempo de inferencia, frames totales, confianza promedio
- Métricas del sistema: RAM, CPU, GPU
- Gráficas en tiempo real: FPS, tiempo de inferencia, confianza

### Sección Central
- Video stream en vivo
- Controles de configuración
- Estado de detección

### Panel de Historial (Derecha)
- Imagen segmentada del documento detectado
- Historial de las últimas 10 detecciones
- Información detallada de cada detección

### Tabla de Sesiones
- Resumen de sesiones por modelo y arquitectura
- Métricas agregadas (promedios)
- Exportación a CSV
- Vista histórica o última sesión

## 🔧 Personalización

### Ajustar el Umbral de Confianza

El umbral de confianza es configurable desde la interfaz (slider de 0% a 100%). Por defecto está en 80%.

### Cambiar el Tamaño de Entrada del Modelo

Los tamaños de entrada se configuran en `src/config/modelConfig.js` en la propiedad `inputSize` de cada modelo.

### Ajustar el Mapeo de Clases

El mapeo de clases se configura en `src/config/modelConfig.js` en el objeto `CLASS_MAPPING`.

### Configurar Proveedores de Ejecución

- **CPU (WASM)**: Compatible con todos los navegadores, funciona con todos los modelos
- **GPU (WebGPU)**: Requiere navegador compatible, solo funciona con modelos F32

**Nota**: Los modelos F16 no son compatibles con WebGPU debido a limitaciones de onnxruntime-web.

## 📱 Compatibilidad

- ✅ Chrome/Edge (recomendado, soporte completo de WebGPU)
- ✅ Firefox (soporte limitado de WebGPU)
- ✅ Safari (puede requerir HTTPS, sin soporte de WebGPU)
- ✅ Navegadores móviles modernos

**Nota**: Para usar la cámara en producción, se requiere HTTPS (excepto en localhost).

## 🏗️ Construcción para Producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`.

### Configuración para ngrok

Si necesitas usar ngrok para desarrollo, configura el dominio en `vite.config.js`:

```javascript
server: {
  host: true,
  allowedHosts: ['tu-dominio.ngrok-free.dev']
}
```

## 📊 Métricas y Estadísticas

La aplicación rastrea automáticamente:

- **Rendimiento del modelo**:
  - FPS (Frames por segundo)
  - Tiempo de inferencia (ms)
  - Confianza promedio
  - Detecciones por segundo

- **Recursos del sistema**:
  - Uso de RAM (MB)
  - Carga de CPU (%)
  - Estado de GPU
  - Información de GPU (vendor, arquitectura)

- **Sesiones**:
  - Métricas por combinación de modelo/arquitectura
  - Persistencia en localStorage
  - Exportación a CSV

## 🐛 Solución de Problemas

### La cámara no se inicia
- Verifica que hayas dado permisos de cámara al navegador
- Asegúrate de que ninguna otra aplicación esté usando la cámara
- Prueba en un navegador diferente
- Verifica que estés usando HTTPS en producción

### El modelo no carga
- Verifica que el archivo del modelo exista en la carpeta `public/`
- Verifica que el archivo sea un modelo ONNX válido
- Revisa la consola del navegador para ver errores específicos
- Asegúrate de que el modelo tenga el formato de entrada correcto
- **Modelos INT8**: No son soportados, usa modelos F32 o F16

### La detección es lenta
- Usa un modelo más pequeño (128x128 en lugar de 320x320)
- Cambia a GPU (WebGPU) si está disponible
- Reduce la resolución de la cámara
- Verifica que WebGPU esté habilitado en tu navegador

### Los modelos F16 no funcionan con GPU
- Los modelos F16 solo funcionan con CPU (WASM)
- Esto es una limitación de onnxruntime-web
- Usa modelos F32 si quieres usar GPU

### Los paneles laterales no aparecen
- En desktop, los paneles deberían estar visibles por defecto
- En móvil, los paneles están colapsados por defecto
- Haz clic en el encabezado del panel para expandirlo/colapsarlo
- Verifica que el ancho de la ventana sea mayor a 968px para desktop

### WebGPU no funciona
- Verifica que tu navegador soporte WebGPU (Chrome/Edge 113+)
- Asegúrate de que los drivers de GPU estén actualizados
- Prueba con CPU (WASM) como alternativa

## 📝 Notas Importantes

1. **Modelos ONNX**: El proyecto busca automáticamente los modelos configurados en `modelConfig.js`. Asegúrate de que los archivos existan en la carpeta `public/`.

2. **Permisos de Cámara**: El navegador solicitará permisos para acceder a la cámara. Asegúrate de permitirlos.

3. **Rendimiento**: El rendimiento depende de:
   - La complejidad del modelo ONNX
   - El hardware del dispositivo (GPU/CPU)
   - La resolución de la cámara
   - El proveedor de ejecución seleccionado

4. **HTTPS en Producción**: Para usar en producción, despliega con HTTPS ya que los navegadores requieren conexiones seguras para acceder a la cámara.

5. **Modelos INT8**: Los modelos cuantizados INT8 no son soportados por onnxruntime-web debido a la falta de implementación de operadores cuantizados. Usa modelos F32 o F16.

6. **Modelos F16 con GPU**: Los modelos F16 no funcionan con WebGPU debido a limitaciones de onnxruntime-web. Se usará automáticamente CPU (WASM) si se detecta este conflicto.

## 🏗️ Arquitectura del Código

El proyecto está modularizado en componentes Vue reutilizables:

- **DocumentDetector.vue**: Componente principal que orquesta toda la aplicación
- **StatsPanel.vue**: Panel de estadísticas con gráficas en tiempo real
- **CameraSection.vue**: Sección de cámara con controles de configuración
- **HistoryPanel.vue**: Panel de historial con imágenes segmentadas
- **SessionsTable.vue**: Tabla de sesiones con exportación a CSV

Los estilos están centralizados en `DocumentDetector.css` y se importan en cada componente.

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request si tienes mejoras o correcciones.
