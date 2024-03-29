import {
  getStroke,
} from 'perfect-freehand'
import {
  ORIENTATION,
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
export function screenToWorldCoord (canvas, clientX, clientY, opt = {}) {
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
export function fixResolution (canvas, width, height) {
  if (!canvas) return
  
  const context = canvas.getContext('2d')
  const ratio = window.devicePixelRatio || 1

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

export const getXYFromPoint2D = point => {
  if (Array.isArray(point)) {
    return point
  }
  else {
    return [point.x, point.y]
  }
}

/**
 * search for the foremost element where the given point is within
 * @param {Number} x x coordinate of the given point
 * @param {Number} y y coordinate of the given point
 * @param {WrappedElement} elements a list of elements to search in
 * @returns {element} the last added element where the given point is within
 */
export function getElementAtPosition ({ worldX, worldY, clientX, clientY }, elements, canvas) {
  const elementsCopy = [...elements]
  return elementsCopy
    .reverse()
    .find(element => posIsWithinElement({ worldX, worldY, clientX, clientY }, element, canvas))
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

export function getOrientationOfThreeOrderedPoints (p1, p2, p3) {
  const [x1, y1] = getXYFromPoint2D(p1)
  const [x2, y2] = getXYFromPoint2D(p2)
  const [x3, y3] = getXYFromPoint2D(p3)
  const value = (y2 - y1) * (x3 - x2) -
    (x2 - x1) * (y3 - y2)

  if (value === 0) return ORIENTATION.COLLINEAR

  return value > 0 
    ? ORIENTATION.CLOCKWISE 
    : ORIENTATION.COUNTER_CLOCKWISE
}

export function isIntersect (segment1, segment2) {
  const [p1, q1] = segment1
  const [p2, q2] = segment2

  const o1 = getOrientationOfThreeOrderedPoints(p1, q1, p2)
  const o2 = getOrientationOfThreeOrderedPoints(p1, q1, q2)
  const o3 = getOrientationOfThreeOrderedPoints(p2, q2, p1)
  const o4 = getOrientationOfThreeOrderedPoints(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true

  if (
    (o1 === ORIENTATION.COLLINEAR && pointIsOnSegment(p2, segment1)) 
      || (o2 === ORIENTATION.COLLINEAR && pointIsOnSegment(q2, segment1))
      || (o3 === ORIENTATION.COLLINEAR && pointIsOnSegment(p1, segment2))
      || (o4 === ORIENTATION.COLLINEAR && pointIsOnSegment(q1, segment2))
  ) {
    return true
  }

  return false
}

export function posIsWithinPolygon (point, vertices) {
  if (vertices.length < 3) {
    return false
  }
  const tempSegment = [point, { x: point.x + 9999, y: point.y }]
  let count = 0
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const side = [vertices[j], vertices[i]]
    if (isIntersect(side, tempSegment)) {
      count += 1
    }
  }

  return (count & 1) === 1
}

export function getCenterOfPoints (points) {
  const n = points.length
  let xSum = 0, ySum = 0
  for (const { x, y } of points) {
    xSum += x
    ySum += y
  }
  return { x: xSum / n, y: ySum / n }
}

const getCanvasCoords = (canvas, clientX, clientY) => {
  const canvasBoundingRect = canvas.getBoundingClientRect();
  const scale = {
    x: canvas.width / canvasBoundingRect.width,
    y: canvas.height / canvasBoundingRect.height,
  };
  return {
    x: (clientX - canvasBoundingRect.left) * scale.x,
    y: (clientY - canvasBoundingRect.top) * scale.y,
  };
}

/**
 * check if a point is within an element
 * @param {Number} x x coordinate of the point to be checked
 * @param {Number} y y coordinate of the point to be checked
 * @param {WrappedElement} element element to perform the hit test
 * @returns {Boolean} result of hit test, true if the given point is within the element
 */
export function posIsWithinElement ({ worldX, worldY, clientX, clientY }, element, canvas) {
  const { coords, type } = element
  const [[x1, y1], [x2, y2]] = coords

  const checkers = {
    [ELEMENT_TYPE.RECTANGLE]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY
    },
    [ELEMENT_TYPE.DIAMOND]: () => {
      return posIsWithinPolygon({ x: worldX, y: worldY }, [
        [(x1 + x2) / 2, y1],
        [x2, (y1 + y2) / 2],
        [(x1 + x2) / 2, y2],
        [x1, (y1 + y2) / 2]
      ])
    },
    [ELEMENT_TYPE.LINE]: () => {
      const a = { x: x1, y: y1 }
      const b = { x: x2, y: y2 }
      const c = { x: worldX, y: worldY }
      // TODO: divide epsilon with zoom
      return pointIsOnSegment(c, [a, b], { epsilon: 10 })
    },
    [ELEMENT_TYPE.ELLIPSE]: () => {
      const [centerX, centerY] = [(x1 + x2) / 2, (y1 + y2) / 2]
      const [a, b] = [(x2 - x1) / 2, (y2 - y1) / 2]
      const p = Math.pow((worldX - centerX), 2) / Math.pow(a, 2) 
                + Math.pow((worldY - centerY), 2) / Math.pow(b, 2)
      const epsilon = 0.1
      return p <= 1 + epsilon
    },
    [ELEMENT_TYPE.FREEDRAW]: () => {
      const ctx = canvas.getContext('2d')
      const pathStr = element.pathData
      const path = new Path2D(pathStr)
      const { x: canvasX, y: canvasY } = getCanvasCoords(canvas, clientX, clientY)
      return ctx.isPointInPath(path, canvasX, canvasY)
    },
    [ELEMENT_TYPE.TEXT]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY
    },
    [ELEMENT_TYPE.IMAGE]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY
    }
  }
  
  if (checkers[type] === undefined) {
    throw new Error(`hit check for element type ${type} is not implemented yet.`)
  }
  
  const isWithin = checkers[type]()
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

const average = (a, b) => (a + b) / 2
export function getSvgPathFromStroke(points, closed = true) {
  const len = points.length

  if (len < 4) {
    return ``
  }

  let a = points[0]
  let b = points[1]
  const c = points[2]

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(
    2
  )} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]
    b = points[i + 1]
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `
  }

  if (closed) {
    result += 'Z'
  }

  return result
}

export function getSvgPathFromHandDrawSamplePoints (points, opts) {
  return getSvgPathFromStroke(getStroke(points, opts))
}
