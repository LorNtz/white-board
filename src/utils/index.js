import {
  ELEMENT_TYPE,
} from '../constants'

/**
 * correct a set of coordinates of a position and 
 * return coordinates coresponding to the canvas top-left corner
 * @param canvas {HTMLCanvasElement} canvas the canvas element
 * @param clientX {number} clientX
 * @param clientY {number} clientY
 * @returns {[number, number]} a tuple of corrected coordinates
 */
export function screenToCanvasCoord (canvas, clientX, clientY, opt = {}) {
  const translateX = opt.translateX ?? 0
  const translateY = opt.translateY ?? 0
  const zoom = opt.zoom ?? 1
  const origin = opt.origin ?? { x: 0, y: 0 }

  const boundingRect = canvas.getBoundingClientRect()
  const { left, top } = boundingRect
  const [x, y] = [clientX - left, clientY - top]
  
  return {
    x: (x - origin.x) / zoom - translateX,
    y: (y - origin.y) / zoom - translateY
  }
}

export function getViewRect (canvas) {
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const { a, d, e, f } = ctx.getTransform()
  
  return {
    x1: -e / a,
    y1: -f / d,
    x2: (width - e) / a,
    y2: (height - f) / d
  }
}

/**
 * fix the resolution issue on a given canvas element
 * @param {HTMLCanvasElement} canvas the canvas element to be fixed with resolution
 */
export function fixResolution (canvas) {
  if (!canvas) return
  
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

/**
 * retriev position infomation from a MouseEvent or Touch
 * @param {MouseEvent | Touch} event 
 */
export function getPositionFromMouseOrTouchEvent (event) {
  if (event.touches && event.touches.length === 1) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
  } else if (event.clientX != undefined && event.clientY != undefined) {
    return {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    throw new Error('event has no supported position info')
  }
}

export const randomBetween = (a, b) => {
  return a + Math.random() * (b - a)
}

/**
 * search for the foremost element where the given point is within
 * @param {Number} x x coordinate of the given point
 * @param {Number} y y coordinate of the given point
 * @param {WrappedElement} elements a list of elements to search in
 * @returns {element} the last added element where the given point is within
 */
export function getElementAtPosition ({ x, y }, elements) {
  const elementsCopy = [...elements]
  return elementsCopy
    .reverse()
    .find(element => posIsWithinElement({ x, y }, element))
}

export function pointIsOnSegment (point, segment, opts) {
  const { x, y } = point
  const { x: x1, y: y1 } = segment[0]
  const { x: x2, y: y2 } = segment[1]

  const lengthSquared = Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2)
  if (lengthSquared === 0) {
    return false // The segment is actually a point
  }

  const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared
  let distanceToSegment

  if (t < 0) {
    distanceToSegment = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2))
  } else if (t > 1) {
    distanceToSegment = Math.sqrt(Math.pow(x - x2, 2) + Math.pow(y - y2, 2))
  } else {
    const projectedX = x1 + t * (x2 - x1)
    const projectedY = y1 + t * (y2 - y1)
    distanceToSegment = Math.sqrt(Math.pow(x - projectedX, 2) + Math.pow(y - projectedY, 2))
  }

  if (opts && typeof opts.epsilon === 'number' && opts.epsilon > 0) {
    return distanceToSegment <= opts.epsilon
  } else {
    return distanceToSegment === 0
  }
}

}

/**
 * check if a point is within an element
 * @param {Number} x x coordinate of the point to be checked
 * @param {Number} y y coordinate of the point to be checked
 * @param {WrappedElement} element element to perform the hit test
 * @returns {Boolean} result of hit test, true if the given point is within the element
 */
export function posIsWithinElement ({ x, y }, element) {
  const { x1, y1, x2, y2, type } = element

  const checkers = {
    [ELEMENT_TYPE.RECTANGLE]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return x >= minX && x <= maxX && y >= minY && y <= maxY
    },
    [ELEMENT_TYPE.LINE]: () => {
      const a = { x: x1, y: y1 }
      const b = { x: x2, y: y2 }
      const c = { x, y }
      // TODO: divide epsilon with zoom
      return pointIsOnSegment(c, [a, b], { epsilon: 10 })
    },
    [ELEMENT_TYPE.ELLIPSE]: () => {
      const [centerX, centerY] = [(x1 + x2) / 2, (y1 + y2) / 2]
      const [a, b] = [(x2 - x1) / 2, (y2 - y1) / 2]
      const p = Math.pow((x - centerX), 2) / Math.pow(a, 2) 
                + Math.pow((y - centerY), 2) / Math.pow(b, 2)
      const epsilon = 0.2
      return p <= 1 + epsilon
    },
    [ELEMENT_TYPE.TEXT]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return x >= minX && x <= maxX && y >= minY && y <= maxY
    }
  }
  
  const isWithin = checkers[type]()
  if (isWithin === undefined) {
    throw new Error(`hit check for element type ${type} is not implemented yet.`)
  }
  
  return isWithin
}

/**
 * calculate the 2D distance between 2 points
 * @param {Point2D} a point A with x & y properties
 * @param {Point2D} b point B with x & y properties
 * @returns {Number} the distance
 */
export function distance2D (a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

export function clamp (val, min, max) {
  val = Math.min(val, max)
  val = Math.max(val, min)
  return val
}

export function getSeedFromRoughElement (roughElement) {
  return roughElement.options.seed
}

export function uuid24bit () {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(3)
    window.crypto.getRandomValues(array)
    return array.join('-')
  }
}

export function getButtonNameFromMouseEvent (event) {
  const button = event.button
  switch (button) {
    case 0:
      return 'left'
    case 1:
      return 'middle'
    case 2:
      return 'right'
    default:
    throw new Error(`Invalid button: ${button}`)
  }
}

export function getPreprocessedText (rawText) {
  return rawText
    .replace(/\t/g, '    ')     // replace tabs with 4 whitespaces
    .replace(/\r?\n|\r/g, '\n') // replace enters with \n
}

const DUMMY_STRING = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.toLocaleUpperCase()
const lineHeightCache = {}
export function getLineHeightOfFont (font) {
  if (lineHeightCache[font]) {
    return lineHeightCache[font]
  }
  lineHeightCache[font] = getFontMetrics(DUMMY_STRING, font).height
  return lineHeightCache[font]
}

let helperCanvas
export function measureLineWidth (textLine, font) {
  if (!helperCanvas) {
    helperCanvas = document.createElement('canvas')
  }
  const context = helperCanvas.getContext('2d')
  context.font = font

  const metrics = context.measureText(textLine)
  return metrics.width
}

export function measureTextWidth (text, font) {
  const lines = text.split('\n')
  let width = 0
  lines.forEach(line => {
    width = Math.max(width, measureLineWidth(line, font))
  })
  return width
}

export function getFontMetrics (text, font) {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.whiteSpace = 'pre'
  container.style.font = font
  container.style.minHeight = '1em'
  container.innerText = text
  
  const line = document.createElement('span')
  line.style.display = 'inline-block'
  line.style.overflow = 'hidden'
  line.style.width = '1px'
  line.style.height = '1px'
  
  container.appendChild(line)
  const body = document.body
  body.appendChild(container)

  const width = container.offsetWidth
  const height = container.offsetHeight
  const baseline = line.offsetTop + line.offsetHeight

  body.removeChild(container)

  const metrics = {
    width,
    height,
    baseline,
  }

  return metrics
}

export function getFontString (fontProps) {
  const { size, family, style, variant, weight } = fontProps
  return (style ? style + ' ' : '') 
    + (variant ? variant + ' ' : '')
    + (weight ? weight + ' ': '')
    + `${size}px `
    + family
}

export function createTextObject ({ rawText }) {
  let lines = rawText.replace(/\r\n?/g, "\n").split("\n")
  return {
    rawText,
    lines,
  }
}
