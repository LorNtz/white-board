import {
  useRef,
  useState,
  useEffect,
} from 'react'
import {
  getButtonNameFromMouseEvent,
} from '../utils'
import {
  useLatest
} from 'react-use'

export const useCursorType = (element, initialType) => {
  const [cursor, setCursor] = useState(initialType)
  useEffect(() => {
    if (!element) return
    element.style.cursor = cursor
  }, [element, cursor])
  return [cursor, setCursor]
}

export const useElementContainer = () => {
  const [elementMap, setElementMap] = useState(() => new Map())

  const setElement = (id, newElement) => {
    elementMap.set(id, newElement)
    const updatedMap = new Map(elementMap)
    setElementMap(updatedMap)
  }
  
  const deleteElement = (id) => {
    elementMap.delete(id)
    const updatedMap = new Map(elementMap)
    setElementMap(updatedMap)
  }

  return { elementMap, setElement, deleteElement, setElementMap }
}

export const useDevicePixelRatio = () => {
  const [devicePixelRatio, setDevicePixelRatio] = useState(1)

  useEffect(() => {
    setDevicePixelRatio(window.devicePixelRatio || 1)

    function handleResize () {
      setDevicePixelRatio(window.devicePixelRatio || 1)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return devicePixelRatio
}

export const useMouseState = (ref) => {
  const buttonStateRef = useRef({
    left: false,
    middle: false,
    right: false
  })
  const getMouseState = () => buttonStateRef.current

  useEffect(() => {
    function handleMouseDown (event) {
      event.preventDefault()
      
      const buttonName = getButtonNameFromMouseEvent(event)
      buttonStateRef.current[buttonName] = true
    }
    
    function handleMouseUp (event) {
      event.preventDefault()
      
      const buttonName = getButtonNameFromMouseEvent(event)
      buttonStateRef.current[buttonName] = false
    }

    let target
    if (ref && ref.current && ref.current.addEventListener) {
      target = ref.current
    } else {
      target = document
    }
    target.addEventListener('mousedown', handleMouseDown)
    target.addEventListener('mouseup', handleMouseUp)

    return () => {
      target.removeEventListener('mousedown', handleMouseDown)
      target.removeEventListener('mouseup', handleMouseUp)
    }
  }, [ref])

  return getMouseState
}

export const useFont = (initialSize, initialFamily) => {
  const [size, setSize] = useState(initialSize)
  const [family, setFamily] = useState(initialFamily)
  const font = `${size}px ${family}`
  return {
    font,
    size,
    setSize,
    family,
    setFamily,
  }
}
