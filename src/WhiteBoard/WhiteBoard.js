import {
  useRef,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
  useLayoutEffect,
} from 'react';
import rough from 'roughjs/bundled/rough.esm'
import {
  clamp,
  uuid24bit,
  getViewRect,
  fixResolution,
  getFontMetrics,
  createTextObject,
  measureTextWidth,
  posIsWithinElement,
  screenToCanvasCoord,
  getPreprocessedText,
  getElementAtPosition,
  getSeedFromRoughElement,
  getButtonNameFromMouseEvent,
  getPositionFromMouseOrTouchEvent,
  getSvgPathFromHandDrawSamplePoints,
} from "../utils";
import {
  useFont,
  useCursorType,
  useElementContainer,
  useDevicePixelRatio,
} from '../hooks'
import {
  MIN_ZOOM,
  MAX_ZOOM,
  TOOL_TYPE,
  ELEMENT_TYPE,
  TOOL_ELEMENT_MAP,
  ADJUST_ZOOM_MODE,
} from '../constants'
import './WhiteBoard.css'
import { StageStateContext } from './context.js'
import UI from '../components/UI';

const generator = rough.generator()

function createWrappedElement (type, props){
  const { zIndex, id, x1, y1, x2, y2, text, font, seed, lineHeight } = props

  let wrappedElement = {
    type,
    zIndex,
    x1,
    y1,
    x2,
    y2,
    id: id ?? uuid24bit()
  }
  
  let roughOpts = {
    seed: seed || rough.newSeed(),
  }
  
  if (type === ELEMENT_TYPE.LINE) {
    wrappedElement.roughElement = generator.line(x1, y1, x2, y2, roughOpts)
  } else if (type === ELEMENT_TYPE.RECTANGLE) {
    wrappedElement.roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1, roughOpts)
  } else if (type === ELEMENT_TYPE.DIAMOND) {
    wrappedElement.roughElement = generator.polygon([
      [(x1 + x2) / 2, y1],
      [x2, (y1 + y2) / 2],
      [(x1 + x2) / 2, y2],
      [x1, (y1 + y2) / 2]
    ], roughOpts)
  } else if (type === ELEMENT_TYPE.ELLIPSE) {
    const width = x2 - x1
    const height = y2 - y1
    const [x, y] = [x1 + width / 2, y1 + height / 2]
    wrappedElement.roughElement = generator.ellipse(x, y, width, height, roughOpts)
  } else if (type === ELEMENT_TYPE.FREEDRAW) {
    wrappedElement.strokePoints = props.strokePoints
  } else if (type === ELEMENT_TYPE.TEXT) {
    const preprocessedText = getPreprocessedText(text)
    wrappedElement.textObject = createTextObject({ rawText: preprocessedText })
    wrappedElement.font = font
    const fontString = font.fontString
    const { width, height, baseline } = getFontMetrics(preprocessedText, fontString)
    wrappedElement.width = width
    wrappedElement.height = height
    wrappedElement.x2 = x1 + width
    wrappedElement.y2 = y1 + height
    wrappedElement.baseline = baseline
    wrappedElement.lineHeight = lineHeight
  } else {
    throw new Error(`creation of element of ${type} type is not implemented yet`)
  }
  
  return wrappedElement
}

function drawElement (roughCanvas, context, element) {
  const { type } = element
  
  switch (type) {
    case ELEMENT_TYPE.LINE:
    case ELEMENT_TYPE.CURVE:
    case ELEMENT_TYPE.ELLIPSE:
    case ELEMENT_TYPE.DIAMOND:
    case ELEMENT_TYPE.RECTANGLE:
      roughCanvas.draw(element.roughElement)
      break
    case ELEMENT_TYPE.FREEDRAW:
      const pathString = getSvgPathFromHandDrawSamplePoints(element.strokePoints)
      const path = new Path2D(pathString)
      context.fill(path)
      break
    case ELEMENT_TYPE.TEXT:
      context.save()
      
      const fontString = element.font.fontString
      context.font = fontString
      const { lines } = element.textObject
      const { height, baseline } = element
      const lineHeight = element.lineHeight
      // const lineHeight = getLineHeightOfFont(fontString) // not accurate enough
      const verticalOffset = height - baseline
      
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        const x = element.x1
        const y = element.y1 + (index + 1) * lineHeight - verticalOffset
        context.fillText(line, x, y)
      }

      context.restore()
      break

    default:
      throw new Error(`Drawing for element type ${type} is not implemented yet`)
  }
}

function drawGrids (context, { from, to, gridSize }) {
  context.save()
  const { a: zoom } = context.getTransform()

  context.lineWidth = 1 / zoom
  context.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  context.beginPath()
  
  // vertical lines
  for (let x = from.x - (from.x % gridSize); x < to.x; x += gridSize) {
    context.moveTo(x, from.y)
    context.lineTo(x, to.y)
  }
  // horizontal lines
  for (let y = from.y - (from.y % gridSize); y < to.y; y += gridSize) {
    context.moveTo(from.x, y)
    context.lineTo(to.x, y)
  }
  context.stroke()
  
  context.lineWidth = 2 / zoom
  context.beginPath()
  for (let x = from.x - (from.x % (4 * gridSize)); x < to.x; x += 4 * gridSize) {
    context.moveTo(x, from.y)
    context.lineTo(x, to.y)
  }
  for (let y = from.y - (from.y % (4 * gridSize)); y < to.y; y += 4 * gridSize) {
    context.moveTo(from.x, y)
    context.lineTo(to.x, y)
  }
  context.stroke()

  context.restore()
}

// TODO: move this into a ref and maybe create a custom hook for it
const mouseState = {
  left: false,
  middle: false,
  right: false,
  x: 0,
  y: 0
}
let panningStartPos = { x: 0, y: 0 }

function WhiteBoard ({ width, height }) {
  
  const {
    elementMap,
    setElement,
    deleteElement,
    setElementMap,
  } = useElementContainer()
  const elements = [ ...elementMap.values() ]
  
  const [currentAction, setCurrentAction] = useState('none')
  const [activeToolType, setActiveToolType] = useState(TOOL_TYPE.SELECTION)
  const manipulatingElementRef = useRef(null)

  const devicePixelRatio = useDevicePixelRatio()
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [cameraZoom, setCameraZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0, y: 0 })
  const [scrollSensitivity, setScrollSensitivity] = useState(0.0005)

  const [
    defaultFont,
    setDefaultFontProps
  ] = useFont({ size: 32, family: 'sans-serif', weight: 400 })

  const [gridSize, setGridSize] = useState(20)
  
  const canvasRef = useRef(null)
  const [, setCanvasCursorType] = useCursorType(canvasRef.current, 'default')
  
  const [textEditPosition, setTextEditPosition] = useState({ x: 0, y: 0 })
  const textAreaRef = useRef(null)
  
  const handleMouseDown = (event) => {
    const buttonName = getButtonNameFromMouseEvent(event)
    mouseState[buttonName] = true
    
    const canvas = canvasRef.current
    let { x: clientX, y: clientY } = getPositionFromMouseOrTouchEvent(event)

    if (currentAction === 'typing') {
      return
    }

    if (activeToolType === TOOL_TYPE.PAN || mouseState.middle) {
      setCurrentAction('panning')
      panningStartPos.x = clientX / cameraZoom - cameraOffset.x
      panningStartPos.y = clientY / cameraZoom - cameraOffset.y
      return
    }

    if (!mouseState.left) return
    
    const {
      x: canvasX,
      y: canvasY,
    } = screenToCanvasCoord(canvas, clientX, clientY, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
      zoom: cameraZoom,
      origin: zoomOrigin
    })
    if (activeToolType === TOOL_TYPE.SELECTION) {
      const element = getElementAtPosition({ x: canvasX, y: canvasY }, elements)
      if (element) {
        setCurrentAction('moving')
        manipulatingElementRef.current = {
          ...element,
          offsetX: canvasX - element.x1,
          offsetY: canvasY - element.y1,
        }
      }
    } else if (
      [
        TOOL_TYPE.LINE,
        TOOL_TYPE.RECTANGLE,
        TOOL_TYPE.DIAMOND,
        TOOL_TYPE.ELLIPSE,
        TOOL_TYPE.FREEDRAW,
      ].includes(activeToolType)
    ) {
      setCurrentAction('drawing')
      const zIndex = elements.length
      const elementType = TOOL_ELEMENT_MAP[activeToolType]
      let element
      if (elementType === ELEMENT_TYPE.FREEDRAW) {
        element = createWrappedElement(ELEMENT_TYPE.FREEDRAW, {
          zIndex,
          strokePoints: [{ x: canvasX, y: canvasY }]
        })
      } else {
        element = createWrappedElement(elementType, {
          zIndex,
          x1: canvasX,
          y1: canvasY,
          x2: canvasX,
          y2: canvasY,
        })
      }
      setElement(element.id, element)
      manipulatingElementRef.current = element
    } else if (activeToolType === TOOL_TYPE.TEXT) {
      setActiveToolType(TOOL_TYPE.SELECTION)
      setCurrentAction('typing')
      startTextEditing({
        screenX: clientX,
        screenY: clientY,
      })
      const zIndex = elements.length
      const element = createWrappedElement(ELEMENT_TYPE.TEXT, {
        zIndex,
        x1: canvasX,
        y1: canvasY,
        text: '',
        font: defaultFont,
      })
      setElement(element.id, element)
      manipulatingElementRef.current = element
      deselectElements()
    }
  }

  function startTextEditing ({
    screenX,
    screenY,
  }) {
    setTextEditPosition({ x: screenX, y: screenY })
  }

  function submitText () {
    const textElement = manipulatingElementRef.current
    const textarea = textAreaRef.current
    let text = textarea.value
    const lineCount = text.split('\n').length
    const lineHeight = lineCount > 2 
      ? textarea.scrollHeight / lineCount
      : textarea.scrollHeight / 2
    if (text.trim() === '') {
      deleteElement(textElement.id)
      manipulatingElementRef.current = null
    } else {
      updateElement(textElement.id, { text, lineHeight })
    }

    setCurrentAction('none')
  }

  function deselectElements () {
    // TODO: implementation
  }

  const updateElement = (id, { x1, y1, x2, y2, text, font, lineHeight, strokePoints }) => {
    const element = elementMap.get(id)
    let updatedElement
    switch (element.type) {
      case ELEMENT_TYPE.LINE:
      case ELEMENT_TYPE.RECTANGLE:
      case ELEMENT_TYPE.ELLIPSE:
      case ELEMENT_TYPE.DIAMOND:
        const seed = getSeedFromRoughElement(element.roughElement)
        updatedElement = createWrappedElement(element.type, {
          id,
          x1,
          y1,
          x2,
          y2,
          seed,
        })
        setElement(id, updatedElement)
        break

      case ELEMENT_TYPE.FREEDRAW:
        updatedElement = createWrappedElement(ELEMENT_TYPE.FREEDRAW, {
          id,
          strokePoints
        })
        setElement(id, updatedElement)
        // remember, we are updating the element by creating a new one
        // and updating a freedraw always needs the newest strokePoints
        // thus don't forget to update manipulatingElementRef
        manipulatingElementRef.current = updatedElement
        break

      case ELEMENT_TYPE.TEXT:
        updatedElement = createWrappedElement(ELEMENT_TYPE.TEXT, {
          id,
          x1: x1 ? x1 : element.x1,
          y1: y1 ? y1 : element.y1,
          text: text ? text : element.textObject.rawText,
          font: font ? font : element.font,
          lineHeight: lineHeight ? lineHeight : element.lineHeight
        })
        setElement(id, updatedElement)
        break

      default:
        throw new Error(`Cannot update element with type ${element.type}`)
    }
  }
  
  const handleMouseMove = (event) => {
    const canvas = canvasRef.current
    let { x, y } = getPositionFromMouseOrTouchEvent(event)
    mouseState.x = x
    mouseState.y = y
    
    const {
      x: canvasX,
      y: canvasY,
    } = screenToCanvasCoord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
      zoom: cameraZoom,
      origin: zoomOrigin
    })
    
    if (activeToolType === TOOL_TYPE.PAN) {
      setCanvasCursorType('grab')
    } else if (activeToolType === TOOL_TYPE.SELECTION) {
      elements.some(element => posIsWithinElement({ x: canvasX, y: canvasY }, element)) 
        ? setCanvasCursorType('move') 
        : setCanvasCursorType('default')
    } else {
      setCanvasCursorType('crosshair')
    }
    
    if (currentAction === 'panning') {
      setCanvasCursorType('grabbing')
      
      setCameraOffset({
        x: x / cameraZoom - panningStartPos.x,
        y: y / cameraZoom - panningStartPos.y
      })
      
      return
    }
    
    const manipulatingElement = manipulatingElementRef.current
    if (currentAction === 'drawing') {
      const [ x2, y2 ] = [canvasX, canvasY]
      if (manipulatingElement.type === ELEMENT_TYPE.FREEDRAW) {
        const { id, strokePoints } = manipulatingElement
        updateElement(id, {
          strokePoints: [...strokePoints, { x: canvasX, y: canvasY }]
        })
      } else {
        const { id, x1, y1 } = manipulatingElement
        updateElement(id, {
          x1,
          y1,
          x2,
          y2,
        })
      }
    } else if (currentAction === 'moving') {
      const { id, x1, x2, y1, y2, offsetX, offsetY } = manipulatingElement
      const width = x2 - x1
      const height = y2 - y1
      // TODO: set a threshold to prevent unwanted minor move
      const nextX = canvasX - offsetX
      const nextY = canvasY - offsetY
      
      updateElement(id, {
        x1: nextX,
        y1: nextY,
        x2: nextX + width,
        y2: nextY + height,
      })
    }
  }

  const handleMouseUp = (event) => {
    const buttonName = getButtonNameFromMouseEvent(event)
    mouseState[buttonName] = false

    if (currentAction === 'typing') {
      return
    }
    
    setCurrentAction('none')
    manipulatingElementRef.current = null
  }

  const handleMouseOut = () => {
    mouseState.middle = mouseState.left = mouseState.right = false
    // setCurrentAction('none')
  }

  const handleContextMenu = (event) => {
    event.preventDefault()
  }
  
  const adjustZoom = ({
    mode, value, center
  }) => {
    const normalizeZoomFactor = (factor) => clamp(factor, MIN_ZOOM, MAX_ZOOM)
    
    let newZoom = cameraZoom
    if (mode === ADJUST_ZOOM_MODE.INCREMENT) {
      newZoom = normalizeZoomFactor(cameraZoom + value)
    } else if (mode === ADJUST_ZOOM_MODE.MULTIPLY) {
      newZoom = normalizeZoomFactor(cameraZoom * value)
    } else if (mode === ADJUST_ZOOM_MODE.SET) {
      newZoom = value
    } else {
      throw new Error(`Unsupported zoom mode: ${mode}`)
    }
    const scaleBy = newZoom / cameraZoom
    if (center) {
      setZoomOrigin({
        x: center.x - (center.x - zoomOrigin.x) * scaleBy,
        y: center.y - (center.y - zoomOrigin.y) * scaleBy
      })
    } else {
      setZoomOrigin({
        x: mouseState.x - (mouseState.x - zoomOrigin.x) * scaleBy,
        y: mouseState.y - (mouseState.y - zoomOrigin.y) * scaleBy
      })
    }
    // TODO: use requestAnimationFrame and time functions to create smooth zoom
    setCameraZoom(newZoom)
  }

  const handleWheel = (event) => {
    // TODO: consider adding back the zoom support when action is typing
    if (['panning', 'typing'].includes(currentAction)) return

    const { deltaY } = event
    const reversed = false  // TODO: make this a state in the future
    const supportSmoothScrolling = true  // TODO: make this a configurables state
    
    if (supportSmoothScrolling) {
      const increment = reversed 
        ? deltaY * scrollSensitivity 
        : -deltaY * scrollSensitivity
      adjustZoom({ mode: ADJUST_ZOOM_MODE.INCREMENT, value: increment })
    } else {
      const factor = 0.1
      deltaY < 0 
        ? adjustZoom({ mode: ADJUST_ZOOM_MODE.MULTIPLY, value: 1 + factor }) 
        : adjustZoom({ mode: ADJUST_ZOOM_MODE.MULTIPLY, value: 1 - factor })
    }
  }

  const handleClearCanvas = () => {
    setElementMap(new Map([]))
  }

  const handleInputInTextEditor = (event) => {
    const textarea = textAreaRef.current
    const text = textarea.value
    
    const fontString = manipulatingElementRef.current.font.fontString
    const width = measureTextWidth(text, fontString)
    textarea.style.width = `${width}px`
    
    textarea.style.height = `${textarea.scrollHeight}px`
  }
  
  useEffect(() => {
    const canvas = canvasRef.current
    fixResolution(canvas)
  }, [])
  
  useLayoutEffect(() => {
    // TODO: extract these lines into a handleRef function
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rc = rough.canvas(canvas)

    // reset the transform matrix before clearRect
    // to make sure always clearing the entire viewport of canvas
    // even though the canvas has transformation applied
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    // clear the last frame before this frame starts drawing
    ctx.clearRect(0, 0, width, height)
    
    // zooming
    ctx.transform(cameraZoom, 0, 0, cameraZoom, zoomOrigin.x, zoomOrigin.y)
    
    // panning
    ctx.translate(cameraOffset.x, cameraOffset.y)

    // or only apply one transform:
    // ctx.transform(
    //   cameraZoom,
    //   0,
    //   0,
    //   cameraZoom,
    //   zoomOrigin.x + cameraOffset.x * cameraZoom,
    //   zoomOrigin.y + cameraOffset.y * cameraZoom
    // )
    
    const viewRect = getViewRect(canvas)
    
    drawGrids(ctx, {
      from: {
        x: viewRect.x1,
        y: viewRect.y1,
      },
      to: {
        x: viewRect.x2,
        y: viewRect.y2,
      },
      gridSize: gridSize
    })
    
    elements.forEach((element) => {
      drawElement(rc, ctx, element)
    })
  }, [
      elementMap,
      cameraOffset,
      cameraZoom,
      zoomOrigin,
      gridSize,
      devicePixelRatio,
  ])
  
  useEffect(() => {
    if (currentAction === 'typing') {
      const textArea = textAreaRef.current
      setTimeout(() => {
        textArea.focus()
      }, 0)
    }
  }, [currentAction])
  
  return (
    <StageStateContext.Provider value={{
      width,
      height,
      activeToolType,
      setActiveToolType,
      cameraZoom,
      adjustZoom,
    }}>
      {
        /* INFO: consider make UI a compose component (inspired by https://youtu.be/vPRdY87_SH0) */
      }
      <UI></UI>
      { 
        // TODO: refactor this into a component
        currentAction === 'typing' 
        ? <textarea
            ref={textAreaRef}
            style={{
            // BUG: font size can not be set below 12px, otherwise is stays at 12px
              font: defaultFont.fontString,
              position: 'fixed',
              top: textEditPosition.y,
              left: textEditPosition.x,
              transformOrigin: 'left top',
              transform: `scale(${cameraZoom})`,
              margin: 0,
              padding: 0,
              border: 0,
              boxSizing: "content-box",
              outline: 0,
              resize: 'none',
              overflow: 'hidden',
              backfaceVisibility: 'hidden',
              tabIndex: 0,
              whiteSpace: 'pre',
              background: 'transparent'
            }}
            onInput={handleInputInTextEditor}
            onBlur={submitText}
          ></textarea> 
        : null
      }
      <canvas
        id="canvas"
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseOut}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onFocus={() => console.log('canvas gain focus')}
      >
        This is fallback content
      </canvas>
    </StageStateContext.Provider>
  );
}

export default WhiteBoard
