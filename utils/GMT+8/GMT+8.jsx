import { useState, useEffect } from "react"


export default function useGMTplus8() {


  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour12: true,          // AM/PM format
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Ulaanbaatar",
    })

    const updateTime = () => {
      setCurrentTime(formatter.format(new Date()))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return currentTime

  
}
