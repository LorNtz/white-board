import {
  uuid24bit,
  getFontMetrics,
  createTextObject,
  getXYFromPoint2D,
  getPreprocessedText,
  getSvgPathFromHandDrawSamplePoints,
} from './index.js'
import {
  ELEMENT_TYPE
} from '../constants'
import rough from 'roughjs/bundled/rough.esm'

export const getDefaultRoughSettings = () => {
  return {
    maxRandomnessOffset: 2,
    roughness: 1,
    bowing: 1,
    stroke: '#000',
    strokeWidth: 1,
    curveTightness: 0,
    curveFitting: 0.95,
    curveStepCount: 9,
    fillStyle: 'hachure',
    fillWeight: -1,
    hachureAngle: -41,
    hachureGap: -1,
    dashOffset: -1,
    dashGap: -1,
    zigzagOffset: -1,
    seed: 0,
    disableMultiStroke: false,
    disableMultiStrokeFill: false,
    preserveVertices: false,
  }
}

export function createBaseElement (
  {
    id,
    coords = [],
    width = 0,
    height = 0,
    rotate = 0,
    visible = true,
    locked = false,
    link = null,
    groupIds = [],
    masterElements = null,
    softDeleted = false,
    ...rest
  }
) {
  return {
    id: id ?? uuid24bit(),
    coords,
    width,
    height,
    rotate,
    visible,
    locked,
    link, // link to a web page or an area on canvas or something else (not decided yet)
    groupIds, // ids of groups that this element belongs to
    version: rest.version ?? 1,
    softDeleted,
    lastUpdateTime: Date.now()
  }
}

export function createRectangleElement (
  generator,
  {
    id,
    coords,
    roughSettings
  }
) {
  if (coords.length !== 2) {
    throw new Error(`Expect 2 points to create a rectangle, got ${coords.length}`)
  }
  
  let x1, y1, x2, y2
  if (Array.isArray(coords[0])) {
    [[x1, y1], [x2, y2]] = coords
  } else {
    [{ x: x1, y: y1}, { x: x2, y: y2 }] = coords
  }
  
  const baseElement = createBaseElement({
    id,
    coords,
    width: Math.abs(x1 - x2),
    height: Math.abs(y1 - y2),
  })
  
  roughSettings = Object.assign(
    {},
    getDefaultRoughSettings(),
    roughSettings,
  )
  if (!roughSettings.seed) {
    roughSettings.seed = rough.newSeed()
  }
  
  return {
    ...baseElement,
    type: ELEMENT_TYPE.RECTANGLE,
    roughElement: generator.rectangle(x1, y1, x2 - x1, y2 - y1, roughSettings),
    roughSettings,
  }
}

export function createPolygonElement (
  generator,
  {
    id,
    coords,
    roughSettings
  }
) {
  if (coords.length < 3) {
    throw new Error(`Expect more than 2 points to create a polygon, got ${coords.length}`)
  }

  if (!Array.isArray(coords[0])) {
    if (!typeof coords[0].x === 'number' || !typeof coords[0].y === 'number') {
      throw new Error(`Got illegal coordinates when creating a polygon element`)
    }
    coords = coords.map(coord => [coord.x, coord.y])
  }

  let minX = Number.MAX_SAFE_INTEGER
  let minY = Number.MAX_SAFE_INTEGER
  let maxX = Number.MIN_SAFE_INTEGER
  let maxY = Number.MIN_SAFE_INTEGER
  coords.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })
  
  const baseElement = createBaseElement({
    id,
    coords,
    minX,
    minY,
    maxX,
    maxY,
    width: Math.abs(maxX - minX),
    height: Math.abs(maxY - minY),
  })

  roughSettings = Object.assign(
    {},
    getDefaultRoughSettings(),
    roughSettings,
  )
  if (!roughSettings.seed) {
    roughSettings.seed = rough.newSeed()
  }
  
  return {
    ...baseElement,
    type: ELEMENT_TYPE.POLYGON,
    roughElement: generator.polygon(coords, roughSettings),
    roughSettings,
  }
}

export function createDiamondElement (
  generator,
  {
    id,
    coords,
    roughSettings
  }
) {
  if (coords.length !== 2) {
    throw new Error(`Expect 2 points to create a diamond, got ${coords.length}`)
  }
  
  let x1, y1, x2, y2
  if (Array.isArray(coords[0])) {
    [[x1, y1], [x2, y2]] = coords
  } else {
    [{ x: x1, y: y1}, { x: x2, y: y2 }] = coords
  }
  
  const polygonElement = createPolygonElement(generator, {
    id,
    coords: [
      [(x1 + x2) / 2, y1],
      [x2, (y1 + y2) / 2],
      [(x1 + x2) / 2, y2],
      [x1, (y1 + y2) / 2]
    ],
    roughSettings
  })

  return {
    ...polygonElement,
    coords,
    type: ELEMENT_TYPE.DIAMOND
  }
}

export function createLineElement (
  generator,
  {
    id,
    coords,
    roughSettings
  }
) {
  if (coords.length !== 2) {
    throw new Error(`Expect 2 points to create a line, got ${coords.length}`)
  }
  
  let x1, y1, x2, y2
  if (Array.isArray(coords[0])) {
    [[x1, y1], [x2, y2]] = coords
  } else {
    [{ x: x1, y: y1}, { x: x2, y: y2 }] = coords
  }
  
  const baseElement = createBaseElement({
    id,
    coords,
    width: Math.abs(x1 - x2),
    height: Math.abs(y1 - y2),
  })

  roughSettings = Object.assign(
    {},
    getDefaultRoughSettings(),
    roughSettings,
  )
  if (!roughSettings.seed) {
    roughSettings.seed = rough.newSeed()
  }
  
  return {
    ...baseElement,
    type: ELEMENT_TYPE.LINE,
    roughElement: generator.line(x1, y1, x2, y2, roughSettings),
    roughSettings,
  }
}

export function createEllipseElement (
  generator,
  {
    id,
    coords,
    roughSettings
  }
) {
  if (coords.length !== 2) {
    throw new Error(`Expect 2 points to create a ellipse, got ${coords.length}`)
  }
  
  let x1, y1, x2, y2
  if (Array.isArray(coords[0])) {
    [[x1, y1], [x2, y2]] = coords
  } else {
    [{ x: x1, y: y1}, { x: x2, y: y2 }] = coords
  }
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  const [x, y] = [x1 + width / 2, y1 + height / 2]
  
  const baseElement = createBaseElement({
    id,
    coords,
    width,
    height,
  })
  
  roughSettings = Object.assign(
    {},
    getDefaultRoughSettings(),
    roughSettings,
  )
  if (!roughSettings.seed) {
    roughSettings.seed = rough.newSeed()
  }
  
  return {
    ...baseElement,
    type: ELEMENT_TYPE.ELLIPSE,
    roughElement: generator.ellipse(x, y, width, height, roughSettings),
    roughSettings,
  }
}

export function createTextElement (
  {
    id,
    coords,
    text,
    font,
    lineHeight
  }
) {
  if (coords.length !== 1) {
    throw new Error(`Expect exactly 1 point to create a text element, got ${coords.length}`)
  }
  
  const preprocessedText = getPreprocessedText(text)
  const textObject = createTextObject({ rawText: preprocessedText })
  const fontString = font.fontString
  const { width, height, baseline } = getFontMetrics(preprocessedText, fontString)
  const [x1, y1] = getXYFromPoint2D(coords[0])
  coords.push([x1 + width, y1 + height])
  
  const baseElement = createBaseElement({
    id,
    coords,
    width,
    height,
  })

  return {
    ...baseElement,
    type: ELEMENT_TYPE.TEXT,
    text,
    textObject,
    font,
    baseline,
    lineHeight
  }
}

export function createFreedrawElement (
  {
    id,
    coords,
    strokeOptions
  }
) {
  let minX = Number.MAX_SAFE_INTEGER
  let minY = Number.MAX_SAFE_INTEGER
  let maxX = Number.MIN_SAFE_INTEGER
  let maxY = Number.MIN_SAFE_INTEGER
  coords.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })
  
  const baseElement = createBaseElement({
    id,
    coords,
    minX,
    minY,
    maxX,
    maxY,
    width: Math.abs(maxX - minX),
    height: Math.abs(maxY - minY),
  })

  return {
    ...baseElement,
    type: ELEMENT_TYPE.FREEDRAW,
    pathData: getSvgPathFromHandDrawSamplePoints(coords, strokeOptions),
    strokeOptions
  }
}
