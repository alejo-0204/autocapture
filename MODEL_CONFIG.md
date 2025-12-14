# Configuración del Modelo ONNX

Este documento explica cómo configurar y personalizar el detector para trabajar con diferentes modelos ONNX.

## Formato de Entrada Esperado

El código actual espera un modelo con las siguientes características:

### Input
- **Forma**: `[1, 3, 320, 320]`
- **Tipo**: `float32`
- **Formato**: CHW (Channel, Height, Width)
- **Normalización**: ImageNet (media: [0.485, 0.456, 0.405], std: [0.229, 0.224, 0.225])

### Output
- **Forma**: `[1, N]` donde N es el número de clases
- **Tipo**: `float32`
- **Valores**: Probabilidades o logits para cada clase

## Personalización

### 1. Cambiar el Tamaño de Entrada

Si tu modelo requiere un tamaño diferente (por ejemplo, 256x256 o 512x512):

```javascript
// En DocumentDetector.vue, función preprocessImage
const targetSize = 256 // Cambia de 320 a tu tamaño
```

Y actualiza la creación del tensor:

```javascript
// En startDetection
feeds[inputName] = new ort.Tensor('float32', preprocessed, [1, 3, 256, 256])
```

### 2. Cambiar la Normalización

Si tu modelo usa una normalización diferente:

```javascript
// En preprocessImage, reemplaza:
tensor[i] = (r - 0.485) / 0.229
tensor[targetSize * targetSize + i] = (g - 0.456) / 0.224
tensor[2 * targetSize * targetSize + i] = (b - 0.405) / 0.225

// Por tus valores personalizados, por ejemplo:
tensor[i] = r / 255.0 // Sin normalización
tensor[targetSize * targetSize + i] = g / 255.0
tensor[2 * targetSize * targetSize + i] = b / 255.0
```

### 3. Cambiar el Mapeo de Clases

Si tu modelo tiene un orden diferente de clases:

```javascript
// En processResults, ajusta según tu modelo:
if (maxIndex === 0) {
  detectionStatus.value = 'front'
} else if (maxIndex === 1) {
  detectionStatus.value = 'back'
} else {
  detectionStatus.value = 'none'
}
```

### 4. Usar Softmax si el Output son Logits

Si tu modelo devuelve logits en lugar de probabilidades:

```javascript
// En processResults, antes de encontrar maxIndex:
function softmax(logits) {
  const max = Math.max(...logits)
  const exp = logits.map(x => Math.exp(x - max))
  const sum = exp.reduce((a, b) => a + b, 0)
  return exp.map(x => x / sum)
}

const probabilities = softmax(predictions)
const maxIndex = probabilities.indexOf(Math.max(...probabilities))
const maxConfidence = probabilities[maxIndex]
```

### 5. Modelos con Múltiples Outputs

Si tu modelo tiene múltiples salidas:

```javascript
// En processResults
const output1 = results['output1_name'] // Primera salida
const output2 = results['output2_name'] // Segunda salida

// Procesa según necesites
```

## Ejemplo de Modelo

Un modelo típico podría ser:

- **Arquitectura**: ResNet, MobileNet, o similar
- **Entrenamiento**: Clasificación de 3 clases (no_detectado, frente, reverso)
- **Input**: Imagen RGB 224x224 normalizada
- **Output**: Probabilidades [P(no_detectado), P(frente), P(reverso)]

## Verificación del Modelo

Para verificar que tu modelo es compatible:

1. Abre la consola del navegador (F12)
2. Carga el modelo
3. Verifica los mensajes de consola que muestran:
   - `inputNames`: Nombres de las entradas
   - `outputNames`: Nombres de las salidas
4. Compara con lo que espera el código

## Optimización del Modelo

Para mejor rendimiento:

1. **Cuantización**: Convierte el modelo a INT8 si es posible
2. **Optimización**: Usa `onnx.optimize_model()` antes de exportar
3. **Tamaño**: Modelos más pequeños (MobileNet) son más rápidos
4. **Resolución**: Reducir el tamaño de entrada mejora la velocidad

## Troubleshooting

### Error: "Input shape mismatch"
- Verifica que el tamaño de entrada coincida con tu modelo
- Revisa la forma del tensor en la consola

### Error: "Output shape mismatch"
- Verifica el número de clases en la salida
- Ajusta el mapeo de clases en `processResults`

### Detección incorrecta
- Verifica el orden de las clases en tu modelo
- Ajusta el umbral de confianza
- Revisa la normalización de imágenes

