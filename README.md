# 🔍 Detector de Documentos con ONNX

Aplicación Vue.js con Vite para detectar documentos en tiempo real usando la cámara web y un modelo ONNX. Identifica si el documento mostrado es el frente, reverso o si no se detecta ningún documento.

## 🚀 Características

- ✅ Detección en tiempo real usando la cámara web
- ✅ Integración con modelos ONNX
- ✅ Identificación de frente/reverso de documentos
- ✅ Interfaz de usuario moderna y responsive
- ✅ Procesamiento de video optimizado
- ✅ Soporte para WebGL y WASM

## 📋 Requisitos Previos

- Node.js 16+ y npm/yarn
- Un modelo ONNX entrenado para detección de documentos
- Navegador moderno con soporte para:
  - WebRTC (acceso a cámara)
  - WebGL o WASM (para ONNX Runtime)

## 🛠️ Instalación

1. Instala las dependencias:

```bash
npm install
```

## 🎯 Uso

1. Asegúrate de que el archivo `best.onnx` esté en la carpeta `public/`

2. Inicia el servidor de desarrollo:

```bash
npm run dev
```

3. Abre tu navegador en la URL que muestra Vite (generalmente `http://localhost:5173`)

4. El modelo `best.onnx` se cargará automáticamente al iniciar la aplicación

5. Inicia la cámara:
   - Haz clic en "Iniciar Cámara"
   - Permite el acceso a la cámara cuando se solicite

6. Apunta la cámara hacia un documento y observa la detección en tiempo real

## 📦 Estructura del Modelo ONNX

El modelo ONNX debe cumplir con las siguientes especificaciones:

- **Input**: Tensor de forma `[1, 3, 320, 320]` (imagen RGB normalizada)
- **Output**: Tensor con probabilidades para cada clase
- **Clases esperadas**:
  - Índice 0: No detectado
  - Índice 1: Frente
  - Índice 2: Reverso

### Normalización de Imágenes

Las imágenes se normalizan usando los valores estándar de ImageNet:
- Media: [0.485, 0.456, 0.405]
- Desviación estándar: [0.229, 0.224, 0.225]

Si tu modelo usa una normalización diferente, ajusta la función `preprocessImage` en `src/components/DocumentDetector.vue`.

## 🔧 Personalización

### Ajustar el Umbral de Confianza

En `src/components/DocumentDetector.vue`, modifica la variable `threshold` en la función `processResults`:

```javascript
const threshold = 0.5 // Cambia este valor (0.0 - 1.0)
```

### Cambiar el Tamaño de Entrada del Modelo

Si tu modelo requiere un tamaño diferente a 320x320, modifica la variable `targetSize` en la función `preprocessImage`:

```javascript
const targetSize = 320 // Cambia según tu modelo
```

### Ajustar el Mapeo de Clases

Si tu modelo tiene un orden diferente de clases, modifica la función `processResults`:

```javascript
if (maxIndex === 1) {
  detectionStatus.value = 'front'
} else if (maxIndex === 2) {
  detectionStatus.value = 'back'
}
```

## 📱 Compatibilidad

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari (puede requerir HTTPS)
- ✅ Navegadores móviles modernos

**Nota**: Para usar la cámara en producción, se requiere HTTPS (excepto en localhost).

## 🏗️ Construcción para Producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`.

## 📝 Notas Importantes

1. **Modelo ONNX**: El proyecto usa automáticamente el archivo `best.onnx` ubicado en la carpeta `public/`. Asegúrate de que este archivo existe antes de iniciar la aplicación.

2. **Permisos de Cámara**: El navegador solicitará permisos para acceder a la cámara. Asegúrate de permitirlos.

3. **Rendimiento**: El rendimiento depende de:
   - La complejidad del modelo ONNX
   - El hardware del dispositivo (GPU/CPU)
   - La resolución de la cámara

4. **HTTPS en Producción**: Para usar en producción, despliega con HTTPS ya que los navegadores requieren conexiones seguras para acceder a la cámara.

## 🐛 Solución de Problemas

### La cámara no se inicia
- Verifica que hayas dado permisos de cámara al navegador
- Asegúrate de que ninguna otra aplicación esté usando la cámara
- Prueba en un navegador diferente

### El modelo no carga
- Verifica que el archivo `best.onnx` exista en la carpeta `public/`
- Verifica que el archivo sea un modelo ONNX válido
- Revisa la consola del navegador para ver errores específicos
- Asegúrate de que el modelo tenga el formato de entrada correcto

### La detección es lenta
- Reduce la resolución de la cámara en `startCamera()`
- Usa un modelo más pequeño o optimizado
- Verifica que WebGL esté habilitado en tu navegador

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request si tienes mejoras o correcciones.

