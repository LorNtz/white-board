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
