import {
  TOOL_TYPE,
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
  const defaultOptions = {
    translateX: 0,
    translateY: 0,
    zoom: 1,
    origin: {
      x: 0,
      y: 0
    }
  }
  const {
    translateX,
    translateY,
    zoom,
    origin
  } = Object.assign({}, defaultOptions, opt)

  const boundingRect = canvas.getBoundingClientRect()
  const { left, top } = boundingRect
  const [x, y] = [clientX - left, clientY - top]
  
  return {
    x: (x - origin.x) / zoom - translateX,
    y: (y - origin.y) / zoom - translateY
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
export function getElementAtPosition (x, y, elements) {
  const elementsCopy = [...elements]
  return elementsCopy
    .reverse()
    .find(element => posIsWithinElement(x, y, element))
}

/**
 * check if a point is within an element
 * @param {Number} x x coordinate of the point to be checked
 * @param {Number} y y coordinate of the point to be checked
 * @param {WrappedElement} element element to perform the hit test
 * @returns {Boolean} result of hit test, true if the given point is within the element
 */
export function posIsWithinElement (x, y, element) {
  const { x1, y1, x2, y2, type } = element

  const checkers = {
    [TOOL_TYPE.RECTANGLE]: () => {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      return x >= minX && x <= maxX && y >= minY && y <= maxY
    },
    [TOOL_TYPE.LINE]: () => {
      const a = { x: x1, y: y1 }
      const b = { x: x2, y: y2 }
      const c = { x, y }
      const diff = distance2D(a, b) - distance2D(a, c) - distance2D(b, c)
      const epsilon = 1
      return Math.abs(diff) < epsilon
    },
    [TOOL_TYPE.ELLIPSE]: () => {
      const [centerX, centerY] = [(x1 + x2) / 2, (y1 + y2) / 2]
      const [a, b] = [(x2 - x1) / 2, (y2 - y1) / 2]
      const p = Math.pow((x - centerX), 2) / Math.pow(a, 2) 
                + Math.pow((y - centerY), 2) / Math.pow(b, 2)
      return p <= 1
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
