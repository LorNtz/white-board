import ToolPanel from '../ToolPanel'
import './UI.css'

function UI () {
  return (
    <div className="UI__wrapper">
      <div className="UI__top-layout">
        <div className="top__left-section">
          
        </div>
        <div className="top__middle-section">
          <ToolPanel />
        </div>
        <div className="top__right-section">
          
        </div>
      </div>
    </div>
  );
}

export default UI
