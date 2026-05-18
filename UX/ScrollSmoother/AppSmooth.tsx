import './App.css'
import { useScrollSmoother } from "./hooks/useScrollSmoother";
import { useRef } from 'react';

function App() {
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  useScrollSmoother(wrapperRef); // enabled defaults to true
  
  return (
    <>
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div id="smooth-content">
        
      </div>
    </div>
    </>
  )
}

export default App
