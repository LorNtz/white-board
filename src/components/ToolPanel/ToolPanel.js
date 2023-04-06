import {
  useState,
} from 'react'
import { TOOLS } from '../../constants'
import { useStageStateContext } from '../../WhiteBoard/context.js'
import './ToolPanel.css'

function ToolButton (props) {
  return (
    <label className="tool-button__label">
      <input
        type="radio"
        checked={props.checked}
        onChange={() => {
          props.onChange?.()
        }}
        className="tool-button__radio"
      />
      <div className="tool-button__icon">
        { props.icon }
      </div>
    </label>
  )
}

function ToolPanel() {
  const {
    activeToolType,
    setActiveToolType,
  } = useStageStateContext()
  return (
    <div className="tool-panel">
      {TOOLS.map(({ value, icon }, index) => {
        return (
          <ToolButton
            icon={icon}
            key={value}
            name={value}
            onChange={() =>{
              setActiveToolType(value)
            }}
            checked={activeToolType===value}
          />
        )
      })}
    </div>
  )
}

export default ToolPanel
