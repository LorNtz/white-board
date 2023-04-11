import ToolPanel from '../ToolPanel'
import ZoomPanel from '../ZoomPanel'
import './UI.css'

function UI () {
  return (
    <div className="UI__wrapper">
      <div className="UI__header-layout">
        <div className="header__left-section">
          
        </div>
        <div className="header__middle-section">
          <ToolPanel />
        </div>
        <div className="header__right-section">
          
        </div>
      </div>
      <div className="UI__footer-layout">
        <div className="footer__left-section">
          
        </div>
        <div className="footer__middle-section">
          
        </div>
        <div className="footer__right-section">
          <ZoomPanel />
        </div>
      </div>
    </div>
  );
}

export default UI
