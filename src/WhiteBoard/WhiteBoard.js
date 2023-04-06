import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm'
import {
  fixResolution,
  correctCanvasCord,
  getElementAtPosition,
  posIsWithinElement,
} from "../utils";
import {
  useCursorType
} from '../hooks'
import './WhiteBoard.css'

const generator = rough.generator()

const createWrappedElement = (id, x1, y1, x2, y2, elementType) => {
  let roughElement
  switch (elementType) {
    case 'line':
      roughElement = generator.line(x1, y1, x2, y2)
      break

    case 'rectangle':
      roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1)
      break

    default:
      throw new Error(`creation of element of ${elementType} type is not implemented yet`)
  }
  return {
    id,
    x1,
    y1,
    x2,
    y2,
    type: elementType,
    roughElement
  }
}

function WhiteBoard () {
  const [elements, setElements] = useState([])
  const [mouseDown, setMouseDown] = useState(false)
  const [currentAction, setCurrentAction] = useState('none')
  const [activeToolType, setActiveToolType] = useState('line')
  const [elementOnDragging, setElementOnDragging] = useState(null)
  
  const canvasRef = useRef(null)
  const [canvasCursorType, setCanvasCursorType] = useCursorType(canvasRef.current, 'default')
  
  const handleMouseDown = (event) => {
    setMouseDown(true)
    
    const canvas = canvasRef.current
    const [x, y] = correctCanvasCord(canvas, event.clientX, event.clientY)
    
    if (activeToolType === 'selection') {
      const element = getElementAtPosition(x, y, elements)
      if (element) {
        setCurrentAction('moving')
        setElementOnDragging({ ...element, offsetX: x - element.x1, offsetY: y - element.y1 })
      }
    } else {
      setCurrentAction('drawing')
      const id = elements.length
      const element = createWrappedElement(id, x, y, x, y, activeToolType)
      setElements(prev => [...prev, element])
    }
  }

  const updateElement = ({ id, x1, y1, x2, y2, type }) => {
    const updatedElement = createWrappedElement(id, x1, y1, x2, y2, type)
    const elementsCopy = [...elements]
    elementsCopy[id] = updatedElement
    setElements(elementsCopy)
  }
  
  const handleMouseMove = (event) => {
    const canvas = canvasRef.current
    const [clientX, clientY] = correctCanvasCord(canvas, event.clientX, event.clientY)
    if (activeToolType === 'selection') {
      elements.some(element => posIsWithinElement(clientX, clientY, element)) 
        ? setCanvasCursorType('move') 
        : setCanvasCursorType('default')
    }
    
    if (!mouseDown) return
    
    if (currentAction === 'drawing') {
      const index = elements.length - 1
      const drawingElement = elements[index]
      const { x1, y1 } = drawingElement
      const [ x2, y2 ] = [clientX, clientY]
      
      updateElement({
        id: index,
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
      const nextX = clientX - offsetX
      const nextY = clientY - offsetY
      
      updateElement({
        id,
        x1: nextX,
        y1: nextY,
        x2: nextX + width,
        y2: nextY + height,
        type
      })
    }
  }

  const handleMouseUp = (event) => {
    setMouseDown(false)
    setCurrentAction('none')
    setElementOnDragging(null)
    
    const canvas = canvasRef.current
    const [x, y] = correctCanvasCord(canvas, event.clientX, event.clientY)
  }

  const handleClearCanvas = () => {
    setElements([])
  }
  
  useEffect(() => {
    const canvas = canvasRef.current
    fixResolution(canvas)
  }, [])
  
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rc = rough.canvas(canvas)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    elements.forEach(({ roughElement }) => {
      rc.draw(roughElement)
    })
  }, [elements])
  
  return (
    <canvas
      id="canvas"
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      This is fallback content
    </canvas>
  );
}

export default WhiteBoard
