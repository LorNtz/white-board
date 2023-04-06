import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm'
import {
  clamp,
  uuid24bit,
  fixResolution,
  posIsWithinElement,
  screenToCanvasCoord,
  getElementAtPosition,
  getSeedFromRoughElement,
  getButtonNameFromMouseEvent,
  getPositionFromMouseOrTouchEvent,
} from "../utils";
import {
  useCursorType,
  useElementContainer,
  useDevicePixelRatio,
} from '../hooks'
import './WhiteBoard.css'

const generator = rough.generator()

const createWrappedElement = ({ zIndex, id, x1, y1, x2, y2, elementType, seed }) => {
  let roughElement
  seed = seed || rough.newSeed()
  let opts = {
    seed,
  }
  switch (elementType) {
    case 'line':
      roughElement = generator.line(x1, y1, x2, y2, opts)
      break

    case 'rectangle':
      roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1, opts)
      break

    default:
      throw new Error(`creation of element of ${elementType} type is not implemented yet`)
  }
  id = id || uuid24bit()
  return {
    zIndex,
    id,
    x1,
    y1,
    x2,
    y2,
    type: elementType,
    roughElement
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
  
  const [elementMap, setElement, setElementMap] = useElementContainer()
  const elements = [ ...elementMap.values() ]
  
  const [currentAction, setCurrentAction] = useState('none')
  const [activeToolType, setActiveToolType] = useState('rectangle')
  const [elementOnDragging, setElementOnDragging] = useState(null)
  const [elementOnDrawing, setElementOnDrawing] = useState(null)

  const devicePixelRatio = useDevicePixelRatio()
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [cameraZoom, setCameraZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0, y: 0 })
  const [scrollSensitivity, setScrollSensitivity] = useState(0.0005)
  
  const canvasRef = useRef(null)
  const [, setCanvasCursorType] = useCursorType(canvasRef.current, 'default')
  
  const handleMouseDown = (event) => {
    const buttonName = getButtonNameFromMouseEvent(event)
    mouseState[buttonName] = true
    
    const canvas = canvasRef.current
    let { x, y } = getPositionFromMouseOrTouchEvent(event)

    if (activeToolType === 'pan' || mouseState.middle) {
      setCurrentAction('panning')
      panningStartPos.x = x / cameraZoom - cameraOffset.x
      panningStartPos.y = y / cameraZoom - cameraOffset.y
      return
    }

    if (!mouseState.left) return
    
    const {
      x: canvasX,
      y: canvasY,
    } = screenToCanvasCoord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
      zoom: cameraZoom,
      origin: zoomOrigin
    })
    if (activeToolType === 'selection') {
      const element = getElementAtPosition(canvasX, canvasY, elements)
      if (element) {
        setCurrentAction('moving')
        setElementOnDragging({ ...element, offsetX: canvasX - element.x1, offsetY: canvasY - element.y1 })
      }
    } else {
      setCurrentAction('drawing')
      const zIndex = elements.length
      const element = createWrappedElement({
        zIndex,
        x1: canvasX,
        y1: canvasY,
        x2: canvasX,
        y2: canvasY,
        elementType: activeToolType,
      })
      setElement(element.id, element)
      setElementOnDrawing(element)
    }
  }

  const updateElement = (id, { x1, y1, x2, y2, type }) => {
    const element = elementMap.get(id)
    const seed = getSeedFromRoughElement(element.roughElement)
    const updatedElement = createWrappedElement({
      id,
      x1,
      y1,
      x2,
      y2,
      elementType: type,
      seed,
    })
    setElement(id, updatedElement)
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
    
    if (activeToolType === 'pan') {
      setCanvasCursorType('grab')
    } else if (activeToolType === 'selection') {
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
      const { id, x1, y1 } = elementOnDrawing
      const [ x2, y2 ] = [canvasX, canvasY]
      
      updateElement(id, {
        x1,
        y1,
        x2,
        y2,
        type: activeToolType,
      })
      
    } else if (currentAction === 'moving') {
      const { id, x1, x2, y1, y2, offsetX, offsetY, type } = elementOnDragging
      const width = x2 - x1
      const height = y2 - y1
      const nextX = canvasX - offsetX
      const nextY = canvasY - offsetY
      
      updateElement(id, {
        x1: nextX,
        y1: nextY,
        x2: nextX + width,
        y2: nextY + height,
        type
      })
    }
  }

  const handleMouseUp = (event) => {
    const buttonName = getButtonNameFromMouseEvent(event)
    mouseState[buttonName] = false
    setCurrentAction('none')
    setElementOnDragging(null)
    setElementOnDrawing(null)
  }

  const handleMouseOut = () => {
    mouseState.middle = mouseState.left = mouseState.right = false
    setCurrentAction('none')
  }

  const handleContextMenu = (event) => {
    event.preventDefault()
  }
  
  const adjustZoom = ({
    mode, increment, multiplier
  }) => {
    // TODO: extract these constants to somewhere else
    // may be a constants.js file
    const MAX_ZOOM = 16
    const MIN_ZOOM = 0.1
    const normalizeZoomFactor = (factor) => clamp(factor, MIN_ZOOM, MAX_ZOOM)
    
    let newZoom = cameraZoom
    if (mode === 'increment') {
      newZoom = normalizeZoomFactor(cameraZoom + increment)
    } else if (mode === 'multiplier') {
      newZoom = normalizeZoomFactor(cameraZoom * multiplier)
    } else {
      throw new Error(`Unsupported zoom mode: ${mode}`)
    }
    const scaleBy = newZoom / cameraZoom
    setZoomOrigin({
      x: mouseState.x - (mouseState.x - zoomOrigin.x) * scaleBy,
      y: mouseState.y - (mouseState.y - zoomOrigin.y) * scaleBy
    })
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
      adjustZoom({ mode: 'increment', increment: increment})
    } else {
      const factor = 0.1
      deltaY < 0 
        ? adjustZoom({ mode: 'multiply', multiplier: 1 + factor }) 
        : adjustZoom({ mode: 'multiply', multiplier: 1 - factor })
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
    
    elements.forEach(({ roughElement }) => {
      rc.draw(roughElement)
    })
  }, [elementMap, cameraOffset, cameraZoom, zoomOrigin, devicePixelRatio])
  
  return (
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
    >
      This is fallback content
    </canvas>
  );
}

export default WhiteBoard
