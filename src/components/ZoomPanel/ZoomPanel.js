import {
  Plus,
  Minus
} from '@icon-park/react'
import {
  useStageStateContext
} from '../../WhiteBoard/context.js'
import {
  ADJUST_ZOOM_MODE
} from '../../constants'
import {
  clamp
} from '../../utils'
import './ZoomPanel.css'

function ZoomPanel() {
  const {
    width,
    height,
    cameraZoom,
    adjustZoom,
  } = useStageStateContext()

  function normalizeScaleIndication (scale) {
    return `${Math.trunc(Number(scale * 100))}%`
  }

  function handleZoomIn () {
    adjustZoom({
      mode: ADJUST_ZOOM_MODE.MULTIPLY,
      value: 1.05,
      center: {
        x: width / 2,
        y: height / 2
      }
    })
  }

  function handleZoomOut () {
    adjustZoom({
      mode: ADJUST_ZOOM_MODE.MULTIPLY,
      value: 1 / 1.05,
      center: {
        x: width / 2,
        y: height / 2
      }
    })
  }

  function handleResetZoom () {
    adjustZoom({
      mode: ADJUST_ZOOM_MODE.SET,
      value: 1,
      center: {
        x: width / 2,
        y: height / 2
      }
    })
  }
  
  return (
    <div className="zoom-panel">
      <button type="button" onClick={handleZoomOut}>
        <div className="zoom-panel__button__icon zoom-panel__minus">
          <Minus />
        </div>
      </button>
      <div className="zoom-panel__scale" onClick={handleResetZoom}>
        { normalizeScaleIndication(cameraZoom) }
      </div>
      <button type="button" onClick={handleZoomIn}>
        <div className="zoom-panel__button__icon zoom-panel__plus">
          <Plus />
        </div>
      </button>
    </div>
  )
}

export default ZoomPanel
