/**
 * Custom hook for managing the application theme.
 *
 * - Persists the user's preference to `localStorage` under the key `"theme"`.
 * - Applies the resolved value as `data-theme="light"|"dark"` on `<html>`.
 * - When set to `"system"`, automatically tracks OS preference changes in
 *   real time via a `matchMedia` listener (cleaned up on preference change).
 * - Safe in private-browsing and locked-down environments (`localStorage`
 *   errors are caught and silently ignored).
 *
 * @example
 * // Toggle button
 * const { toggle } = useTheme()
 * <button onClick={toggle}>Toggle theme</button>
 *
 * @example
 * // Three-way selector
 * const { theme, setTheme } = useTheme()
 * ['light', 'dark', 'system'].map((t) => (
 *   isTheme(t) && <button key={t} onClick={() => setTheme(t)}>{t}</button>
 * ))
 *
 * @remarks
 * To prevent a flash of unstyled content (FOUC), add this blocking script
 * to `index.html` inside `<head>` before any CSS:
 * ```html
 * <script>
 *   try {
 *     const t = localStorage.getItem('theme')
 *     const dark = t === 'dark' || ((!t || t === 'system') &&
 *       window.matchMedia('(prefers-color-scheme: dark)').matches)
 *     document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
 *   } catch {}
 * </script>
 * ```
 *
 * @returns {{ theme, setTheme, toggle }}
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export interface UseThemeReturn {
  /** The stored preference: `"light"`, `"dark"`, or `"system"`. */
  theme: Theme,
  setTheme: (theme: Theme) => void,
  toggle: () => void,
}

const STORAGE_KEY = 'theme'
const VALID_THEMES = new Set<Theme>(['light', 'dark', 'system'])

/**
 * Type predicate — verifies an arbitrary string is a valid `Theme` member
 * of `VALID_THEMES`, rather than trusting a cast. Keeps runtime validation
 * and the `Theme` union from silently drifting apart.
 */
const isTheme = (val: string): val is Theme =>
  (VALID_THEMES as Set<string>).has(val)

/**
 * Resolves the current OS color scheme preference.
 * @returns "dark" | "light"
 */
const getSystem = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

/**
 * Safe `localStorage` getter — returns `null` instead of throwing
 * in private-browsing or locked-down browser environments.
 */
const readStorage = (): Theme | null => {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    return val !== null && isTheme(val) ? val : null
  } catch {
    return null
  }
}

/**
 * Safe `localStorage` setter — silently no-ops if storage is unavailable.
 */
const writeStorage = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode, quota exceeded, etc.) — ignore.
  }
}

export default function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(() => readStorage() ?? 'system')

  /**
   * Apply theme + persist whenever it changes.
   * Resolves "system" to the actual OS value before writing to the DOM.
   */
  useEffect(() => {
    const applied = theme === 'system' ? getSystem() : theme
    document.documentElement.setAttribute('data-theme', applied)
    writeStorage(theme)
  }, [theme])

  /**
   * Keep `data-theme` in sync with OS preference while theme="system".
   * The listener is removed when the user picks an explicit preference.
   */
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () =>
      document.documentElement.setAttribute(
        'data-theme',
        mq.matches ? 'dark' : 'light',
      )

    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [theme])

  /**
   * Directly set the theme preference.
   * @param theme - `"light"` | `"dark"` | `"system"`
   */
  const setTheme = useCallback((theme: Theme) => {
    setThemeState(theme)
  }, [])

  /**
   * Toggle between `"light"` and `"dark"`.
   * If the current preference is `"system"`, resolves the OS value first
   * so the result is always an explicit preference.
   */
  const toggle = useCallback(() => {
    setThemeState((t) => {
      const applied = t === 'system' ? getSystem() : t
      return applied === 'dark' ? 'light' : 'dark'
    })
  }, [])

  return useMemo(
    () => ({
      theme,
      setTheme,
      toggle,
    }),
    [theme, setTheme, toggle],
  )
}