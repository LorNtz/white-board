/**
 * correct a set of coordinates of a position and 
 * return coordinates coresponding to the canvas top-left corner
 * @param canvas {HTMLCanvasElement} canvas the canvas element
 * @param x {number} x clientX
 * @param y {number} y clientY
 * @returns {[number, number]} a tuple of corrected coordinates
 */
export function correctCanvasCord (canvas, x, y) {
  const boundingRect = canvas.getBoundingClientRect()
  const { left, top } = boundingRect
  return [
    x - left, // corrected x coordinate
    y - top   // corrected y coordinate
  ]
}
export function fixResolution (canvas) {
  const context = canvas.getContext('2d')
  const ratio = window.devicePixelRatio || 1

  const { width, height } = canvas.getBoundingClientRect()

  canvas.width = width * ratio
  canvas.height = height * ratio
  if (ratio !== 1) {
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
  } else {
    canvas.style.width = ''
    canvas.style.height = ''
  }

  context.scale(ratio, ratio)
}
