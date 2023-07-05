import '@icon-park/react/styles/index.css'
import {
  useState,
  useEffect,
} from 'react'
import WhiteBoard from "./WhiteBoard";

function App() {
  const [whiteBoardWidth, setWhiteBoardWidth] = useState(window.innerWidth)
  const [whiteBoardHeight, setWhiteBoardHeight] = useState(window.innerHeight)
  
  useEffect(() => {
    function handleResize () {
      setWhiteBoardWidth(window.innerWidth)
      setWhiteBoardHeight(window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])
  
  return (
    <WhiteBoard width={whiteBoardWidth} height={whiteBoardHeight} />
  );
}

export default App;
