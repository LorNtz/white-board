import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm'
import {
  uuid24bit,
  fixResolution,
  correctCanvasCord,
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

function WhiteBoard ({width, height}) {
  
  const [elementMap, setElement, setElementMap] = useElementContainer()
  const elements = [ ...elementMap.values() ]
  
  const [currentAction, setCurrentAction] = useState('none')
  const [activeToolType, setActiveToolType] = useState('line')
  const [elementOnDragging, setElementOnDragging] = useState(null)
  const [elementOnDrawing, setElementOnDrawing] = useState(null)

  const devicePixelRatio = useDevicePixelRatio()
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  
  const canvasRef = useRef(null)
  const [, setCanvasCursorType] = useCursorType(canvasRef.current, 'default')
  
  const handleMouseDown = (event) => {
    const buttonName = getButtonNameFromMouseEvent(event)
    mouseState[buttonName] = true
    
    const canvas = canvasRef.current
    let { x, y } = getPositionFromMouseOrTouchEvent(event)

    if (activeToolType === 'pan' || mouseState.middle) {
      setCurrentAction('panning')
      panningStartPos.x = x - cameraOffset.x
      panningStartPos.y = y - cameraOffset.y
      return
    }
    
    let [correctedX, correctedY] = correctCanvasCord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
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
    let [correctedX, correctedY] = correctCanvasCord(canvas, x, y, {
      translateX: cameraOffset.x,
      translateY: cameraOffset.y,
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
        x: x - panningStartPos.x,
        y: y - panningStartPos.y
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

  const handleClearCanvas = () => {
    setElementMap(new Map([]))
  }
  
  useEffect(() => {
    const canvas = canvasRef.current
    fixResolution(canvas)
  }, [])
  
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rc = rough.canvas(canvas)

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    
    ctx.translate(cameraOffset.x, cameraOffset.y)
    
    elements.forEach(({ roughElement }) => {
      rc.draw(roughElement)
    })
  }, [elementMap, cameraOffset, devicePixelRatio])
  
  return (
    <canvas
      id="canvas"
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      This is fallback content
    </canvas>
  );
}

export default WhiteBoard
