import { useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { useScrollSmoother } from "./components/hooks/useScrollSmoother";
import Preloader from "./components/ux/preloader/Preloader";

function App() {
  const [preloaderDone, setPreloaderDone] = useState<boolean>(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useScrollSmoother(wrapperRef, {
    enabled: preloaderDone,
  });

  const handlePreloaderFinish = (): void => {
    setPreloaderDone(true);

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  };

  return (
    <>
      {!preloaderDone && (
        <Preloader onFinish={handlePreloaderFinish} />
      )}

      <div id="smooth-wrapper" ref={wrapperRef}>
        <div id="smooth-content">

          {/* Your sections/components here */}

        </div>
      </div>
    </>
  );
}

export default App;