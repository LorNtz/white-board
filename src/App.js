import '@icon-park/react/styles/index.css'

import ReactWelcome from './react-welcome'
import WhiteBoard from "./WhiteBoard";

function App() {
  return (
    <WhiteBoard width={window.innerWidth} height={window.innerHeight} />
  );
}

export default App;
