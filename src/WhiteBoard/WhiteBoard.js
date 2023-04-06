import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm'
import {
  clamp,
  uuid24bit,
  fixResolution,
  correctCanvasCoord,
  posIsWithinElement,
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

const mouseState = {
  left: false,
  middle: false,
  right: false
}
let panningStartPos = { x: 0, y: 0 }

function WhiteBoard ({ width, height }) {
  
  const [elementMap, setElement, setElementMap] = useElementContainer()
  const elements = [ ...elementMap.values() ]
  
  const [currentAction, setCurrentAction] = useState('none')
  const [activeToolType, setActiveToolType] = useState('line')
  const [elementOnDragging, setElementOnDragging] = useState(null)
  const [elementOnDrawing, setElementOnDrawing] = useState(null)

  const devicePixelRatio = useDevicePixelRatio()
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [cameraZoom, setCameraZoom] = useState(1)
  const [zoomCenter, setZoomCenter] = useState({ x: width / 2, y: height / 2 })
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
    
    let [correctedX, correctedY] = correctCanvasCoord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
      zoom: cameraZoom,
      zoomCenterX: zoomCenter.x,
      zoomCenterY: zoomCenter.y
    })
    if (activeToolType === 'selection') {
      const element = getElementAtPosition(correctedX, correctedY, elements)
      if (element) {
        setCurrentAction('moving')
        setElementOnDragging({ ...element, offsetX: correctedX - element.x1, offsetY: correctedY - element.y1 })
      }
    } else {
      setCurrentAction('drawing')
      const zIndex = elements.length
      const element = createWrappedElement({
        zIndex,
        x1: correctedX,
        y1: correctedY,
        x2: correctedX,
        y2: correctedY,
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
    let [correctedX, correctedY] = correctCanvasCoord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
      zoom: cameraZoom,
      zoomCenterX: zoomCenter.x,
      zoomCenterY: zoomCenter.y
    })
    
    if (activeToolType === 'pan') {
      setCanvasCursorType('grab')
    } else if (activeToolType === 'selection') {
      elements.some(element => posIsWithinElement(correctedX, correctedY, element)) 
        ? setCanvasCursorType('move') 
        : setCanvasCursorType('default')
    } else {
      setCanvasCursorType('default')
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
      const [ x2, y2 ] = [correctedX, correctedY]
      
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
      const nextX = correctedX - offsetX
      const nextY = correctedY - offsetY
      
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

  const handleWheel = (event) => {
    if (currentAction === 'panning') return

    // TODO: extract these constants to somewhere else
    // may be a constants.js file
    const MAX_ZOOM = 5
    const MIN_ZOOM = 0.1
    
    const { deltaY } = event
    const reversed = false  // TODO: make this a state in the future
    const deltaZoom = reversed ? deltaY * scrollSensitivity : -deltaY * scrollSensitivity
    setCameraZoom(prev => clamp(prev + deltaZoom, MIN_ZOOM, MAX_ZOOM))
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
    
    ctx.translate(zoomCenter.x, zoomCenter.y)
    ctx.scale(cameraZoom, cameraZoom)
    ctx.translate(-zoomCenter.x, -zoomCenter.y)
    
    ctx.translate(cameraOffset.x, cameraOffset.y)
    
    elements.forEach(({ roughElement }) => {
      rc.draw(roughElement)
    })
  }, [elementMap, cameraOffset, cameraZoom, devicePixelRatio])
  
  return (
    <canvas
      id="canvas"
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    >
      This is fallback content
    </canvas>
  );
}

export default WhiteBoard
