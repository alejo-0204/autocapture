/**
 * Utilidades para manejar modelos cuantizados INT8
 * 
 * NOTA: Los modelos INT8 no están soportados por onnxruntime-web.
 * Esta implementación no realiza descuantización en tiempo de ejecución.
 */

/**
 * Muestra un warning explicando por qué los modelos INT8 no se pueden usar
 * @param {string} modelKey - Clave del modelo INT8
 */
export function warnInt8NotSupported(modelKey) {
  console.warn(
    '⚠️ Modelos INT8 no soportados\n\n' +
    'Los modelos cuantizados INT8 no pueden ser utilizados con onnxruntime-web porque:\n' +
    '1. onnxruntime-web no implementa los operadores cuantizados requeridos (ConvInteger, QLinearConv, etc.)\n' +
    '2. La descuantización en tiempo de ejecución es extremadamente compleja y propensa a errores\n' +
    '3. Requeriría modificar el código fuente de onnxruntime-web (C++/WASM), lo cual no es posible desde JavaScript\n\n' +
    '💡 Solución: Usa los modelos F32 o F16 que están completamente soportados:\n' +
    '   - Modelo Pequeño F32/F16 (128x128)\n' +
    '   - Modelo Mediano F32/F16 (256x256)\n' +
    '   - Modelo Grande F32/F16 (320x320)\n\n' +
    `Modelo seleccionado: ${modelKey}`
  )
}
