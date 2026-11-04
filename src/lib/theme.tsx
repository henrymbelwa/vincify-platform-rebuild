import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'vincify.theme'

/** Runs before paint (inlined in <head>) so the first frame already uses the right theme. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`

function apply(choice: ThemeChoice) {
  const dark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const ThemeContext = createContext<{ theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }>({
  theme: 'system',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>('system')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ThemeChoice | null) ?? 'system'
    setThemeState(saved)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply((localStorage.getItem(KEY) as ThemeChoice | null) ?? 'system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
    apply(t)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
