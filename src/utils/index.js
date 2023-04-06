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
