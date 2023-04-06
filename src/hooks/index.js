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
