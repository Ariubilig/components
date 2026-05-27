import useGMTplus8 from '.'

  function App(){

    const currentTime = useGMTplus8()

    return (
      <>
      
      <div>{currentTime}</div>


      </>
    );
  }

export default App