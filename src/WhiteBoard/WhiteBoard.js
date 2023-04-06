import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm'
import { fixResolution, correctCanvasCord } from "../utils";
import './WhiteBoard.css'

const generator = rough.generator()

const createWrappedElement = (x1, y1, x2, y2) => {
  const roughElement = generator.line(x1, y1, x2, y2)
  return { x1, y1, x2, y2, roughElement }
}

const random = (a, b) => {
  return a + Math.random() * (b - a)
}

function WhiteBoard () {
  const [elements, setElements] = useState([])
  const [draging, setDraging] = useState(false)
  const canvasRef = useRef(null)
  
  const handleMouseDown = (event) => {
    setDraging(true)
    
    const canvas = canvasRef.current
    const { clientX, clientY } = event
    const [x, y] = correctCanvasCord(canvas, clientX, clientY)
    const element = createWrappedElement(x, y, x, y, activeToolType)
    setElements(prev => [...prev, element])
  }

  const handleMouseMove = (event) => {
    if (!draging) return

    const canvas = canvasRef.current
    const index = elements.length - 1
    const manipulatingElement = elements[index]
    const { x1, y1 } = manipulatingElement
    const { clientX, clientY } = event
    const [ x2, y2 ] = correctCanvasCord(canvas, clientX, clientY)
    
    const updatedElement = createWrappedElement(x1, y1, x2, y2, activeToolType)
    const elementsCopy = [...elements]
    elementsCopy[index] = updatedElement
    setElements(elementsCopy)
  }

  const handleMouseUp = (event) => {
    setDraging(false)
    
    const canvas = canvasRef.current
    const { clientX, clientY } = event
    const [x, y] = correctCanvasCord(canvas, clientX, clientY)
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
