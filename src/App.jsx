import { useEffect, useState } from 'react'
import Today from './views/Today'
import Calendar from './views/Calendar'
import Calculator from './views/Calculator'
import Phrases from './views/Phrases'
import Links from './views/Links'

const TABS = [
  { id: 'today', label: 'Today', View: Today },
  { id: 'trip', label: 'Calendar', View: Calendar },
  { id: 'yen', label: 'Yen', View: Calculator },
  { id: 'say', label: 'Say', View: Phrases },
  { id: 'links', label: 'Links', View: Links },
]

export default function App() {
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'today')

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'today')
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  // Starts from the system setting; a tap pins it per device (index.html applies it before first paint).
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    const theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch {}
    setDark(!dark)
  }

  const current = TABS.find(t => t.id === tab) ?? TABS[0]

  return (
    <>
      <main className="relative mx-auto max-w-xl px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <button role="switch" aria-checked={dark} onClick={toggleTheme}
                className="absolute top-[max(2.5rem,env(safe-area-inset-top))] right-6 flex cursor-pointer items-center gap-2 text-sm text-dim">
          Dark
          <span className={`relative h-5 w-9 rounded-full transition-colors ${dark ? 'bg-ai' : 'bg-rule'}`}>
            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-paper transition-transform ${dark ? 'translate-x-4' : ''}`} />
          </span>
        </button>
        {<current.View />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto grid max-w-xl grid-cols-5 px-2">
          {TABS.map(t => {
            const on = t.id === current.id
            return (
              <a key={t.id} href={`#${t.id}`} aria-current={on ? 'page' : undefined}
                 className={`relative py-4 text-center text-[0.8125rem] no-underline ${on ? 'font-medium text-ai' : 'text-dim'}`}>
                {on && <span className="absolute inset-x-1/4 top-0 h-0.5 bg-ai" />}
                {t.label}
              </a>
            )
          })}
        </div>
      </nav>
    </>
  )
}
