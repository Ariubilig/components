import "./App.css";
import { useRef, useState } from "react";

import { useScrollSmoother } from "./hooks/useScrollSmoother";
import Preloader from "./components/ux/preloader/Preloader";


function App() {

  const [preloaderDone, setPreloaderDone] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useScrollSmoother(wrapperRef, { enabled: preloaderDone });

  const handlePreloaderFinish = (): void => {
    setPreloaderDone(true);
  };

  return (
    <>
      {!preloaderDone && <Preloader onFinish={handlePreloaderFinish} />}

      <div id="smooth-wrapper" ref={wrapperRef}>
        <div id="smooth-content">
          
        </div>
      </div>
    </>
  );
}

export default App;