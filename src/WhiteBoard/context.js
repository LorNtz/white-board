import {
  useContext,
  createContext,
} from 'react'

export const StageStateContext = createContext(null)

export const useStageStateContext = () => useContext(StageStateContext)
