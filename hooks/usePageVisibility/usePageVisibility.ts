// usage: useAwayTitle()


import { useEffect, useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  document.addEventListener('visibilitychange', onStoreChange)
  return () => document.removeEventListener('visibilitychange', onStoreChange)
}

const getSnapshot = () => document.visibilityState === 'visible'
const getServerSnapshot = () => true

/** `true` while the tab is the active one, `false` once it is backgrounded. */
export function usePageVisibility() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export type AwayTitleOptions = {
  /** Title restored on return. Defaults to whatever the title was on mount. */
  home?: string
  /** Text shown while the tab is hidden, before the dots. */
  label?: string
  /** ms between dots. Browsers clamp background timers to >=1000ms. */
  interval?: number
  /** Max dots. The cycle starts bare: `` -> `.` -> `..` -> `...` -> repeat. */
  dots?: number
}

/**
 * Swaps `document.title` for an animated `label...` while the tab is hidden
 * and puts the original title back the moment it is focused again.
 *
 * Costs nothing while the tab is visible: no state, no renders, and the timer
 * only exists for as long as the tab is actually backgrounded.
 */
export function useAwayTitle({
  home,
  label = 'On hold',
  interval = 500,
  dots = 3,
}: AwayTitleOptions = {}) {
  useEffect(() => {
    const original = home ?? document.title
    // Built once, so a tick is a single property write.
    const frames = Array.from({ length: dots + 1 }, (_, i) => label + '.'.repeat(i))
    let timer: number | undefined
    let n = 0

    const tick = () => {
      document.title = frames[n]
      n = (n + 1) % frames.length
    }

    const sync = () => {
      if (document.visibilityState === 'visible') {
        clearInterval(timer)
        timer = undefined
        document.title = original
        return
      }
      if (timer !== undefined) return
      n = 0
      tick()
      timer = setInterval(tick, interval)
    }

    document.addEventListener('visibilitychange', sync)
    sync()

    return () => {
      document.removeEventListener('visibilitychange', sync)
      clearInterval(timer)
      document.title = original
    }
  }, [home, label, interval, dots])
}
