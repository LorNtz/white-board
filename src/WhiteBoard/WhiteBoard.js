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
  fixResolution,
  getFontMetrics,
  createTextObject,
  posIsWithinElement,
  screenToCanvasCoord,
  getElementAtPosition,
  getSeedFromRoughElement,
  getButtonNameFromMouseEvent,
  getPositionFromMouseOrTouchEvent,
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
  const { zIndex, id, x1, y1, x2, y2, text, font, seed } = props

  let wrappedElement = {
    type,
    zIndex,
    x1,
    y1,
    x2,
    y2,
    id: id || uuid24bit()
  }
  
  let roughOpts = {
    seed: seed || rough.newSeed(),
  }
  
  switch (type) {
    case ELEMENT_TYPE.LINE:
      wrappedElement.roughElement = generator.line(x1, y1, x2, y2, roughOpts)
      break

    case ELEMENT_TYPE.RECTANGLE:
      wrappedElement.roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1, roughOpts)
      break

    case ELEMENT_TYPE.ELLIPSE:
      const width = x2 - x1
      const height = y2 - y1
      const [x, y] = [x1 + width / 2, y1 + height / 2]
      wrappedElement.roughElement = generator.ellipse(x, y, width, height, roughOpts)
      break

    case ELEMENT_TYPE.TEXT:
      wrappedElement.textObject = createTextObject({ rawText: text })
      wrappedElement.font = font
      break

    default:
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
    case ELEMENT_TYPE.TEXT:
      context.textBaseline = 'top'
      context.font = element.font
      const { lines } = element.textObject
      const { charWidth, lineHeight, fontSize } = getFontMetrics(element.font)
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        // TODO: should be using lineHeight instead of fontSize
        // context.fillText(line, element.x1, element.y1 + index * lineHeight)
        context.fillText(line, element.x1, element.y1 + index * fontSize)
      }
      
      // context.beginPath()
      // context.lineWidth = '1'
      // context.strokeStyle = 'red'
      // context.rect(element.x1, element.y1, charWidth, lineHeight)
      // context.stroke()
      break

    default:
      throw new Error(`Drawing for element type ${type} is not implemented yet`)
  }
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
  const [manipulatingElement, setManipulatingElement] = useState(null)

  const devicePixelRatio = useDevicePixelRatio()
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [cameraZoom, setCameraZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0, y: 0 })
  const [scrollSensitivity, setScrollSensitivity] = useState(0.0005)

  const {
    font: defaultFont,
    setSize: setDefaultFontSize,
    setFamily: setDefaultFontFamily,
    fontMetrics: defaultFontMetrics,
  } = useFont(24, 'sans-serif')
  
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
      const element = getElementAtPosition(canvasX, canvasY, elements)
      if (element) {
        setCurrentAction('moving')
        setManipulatingElement({ ...element, offsetX: canvasX - element.x1, offsetY: canvasY - element.y1 })
      }
    } else if (
      [
        TOOL_TYPE.LINE,
        TOOL_TYPE.RECTANGLE,
        TOOL_TYPE.DIAMOND,
        TOOL_TYPE.ELLIPSE,
      ].includes(activeToolType)
    ) {
      setCurrentAction('drawing')
      const zIndex = elements.length
      const elementType = TOOL_ELEMENT_MAP[activeToolType]
      const element = createWrappedElement(elementType, {
        zIndex,
        x1: canvasX,
        y1: canvasY,
        x2: canvasX,
        y2: canvasY,
      })
      setElement(element.id, element)
      setManipulatingElement(element)
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
      setManipulatingElement(element)
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
    const textElement = manipulatingElement
    let text = textAreaRef.current.value
    if (text.trim() === '') {
      deleteElement(textElement.id)
      setManipulatingElement(null)
    } else {
      updateElement(textElement.id, { text })
    }

    setCurrentAction('none')
  }

  function deselectElements () {
    // TODO: implementation
  }

  const updateElement = (id, { x1, y1, x2, y2, text, }) => {
    const element = elementMap.get(id)
    switch (element.type) {
      case ELEMENT_TYPE.LINE:
      case ELEMENT_TYPE.RECTANGLE:
      case ELEMENT_TYPE.ELLIPSE:
      case ELEMENT_TYPE.DIAMOND:
        const seed = getSeedFromRoughElement(element.roughElement)
        const updatedElement = createWrappedElement(element.type, {
          id,
          x1,
          y1,
          x2,
          y2,
          seed,
        })
        setElement(id, updatedElement)
        break

      case ELEMENT_TYPE.TEXT:
        const context = canvasRef.current.getContext('2d')
        const textMetrics = context.measureText(text)
        const textObject = createTextObject({ rawText: text })
        setElement(id, {
          ...element,
          textObject,
          textMetrics
        })
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
      elements.some(element => posIsWithinElement(canvasX, canvasY, element)) 
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
    
    if (currentAction === 'drawing') {
      const { id, x1, y1 } = manipulatingElement
      const [ x2, y2 ] = [canvasX, canvasY]
      
      updateElement(id, {
        x1,
        y1,
        x2,
        y2,
      })
      
    } else if (currentAction === 'moving') {
      const { id, x1, x2, y1, y2, offsetX, offsetY } = manipulatingElement
      const width = x2 - x1
      const height = y2 - y1
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
    setManipulatingElement(null)
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
    if (currentAction === 'panning') return

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
    
    elements.forEach((element) => {
      drawElement(rc, ctx, element)
    })
  }, [elementMap, cameraOffset, cameraZoom, zoomOrigin, devicePixelRatio])
  
  useEffect(() => {
    if (currentAction === 'typing') {
      const textArea = textAreaRef.current
      setTimeout(() => {
        textArea.focus()
      }, 0)
    }
  }, [currentAction, manipulatingElement])
  // INFO: notice that textarea uses position info of manipulatingElement
  // thus manipulatingElement is a implicit dependency and should be put in the dep list
  // otherwise textarea won't gain focus when it rerenders while currentAction doesn't change
  
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
              font: defaultFont,
              position: 'fixed',
              top: textEditPosition.y,
              left: textEditPosition.x,
              transformOrigin: 'left top',
              transform: `scale(${cameraZoom})`,
              lineHeight: '1em',
              margin: 0,
              padding: 0,
              outline: 0,
              resize: 'none',
              overflow: 'hidden',
              tabIndex: 0,
              whiteSpace: 'pre',
              background: 'transparent'
            }}
            onInput={function updateStyle() { /* TODO: implementation */ }}
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
