import {
  useState,
  useEffect,
} from 'react'

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

  return [elementMap, setElement, setElementMap]
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
