import { useEffect, useState } from 'react'
import Today from './views/Today'
import Calendar from './views/Calendar'
import Calculator from './views/Calculator'
import Phrases from './views/Phrases'
import Links from './views/Links'

const TABS = [
  { id: 'today', label: 'Today', icon: '◉', View: Today },
  { id: 'trip', label: 'Calendar', icon: '▦', View: Calendar },
  { id: 'yen', label: 'Yen', icon: '¥', View: Calculator },
  { id: 'say', label: 'Say', icon: '語', View: Phrases },
  { id: 'links', label: 'Links', icon: '🔗', View: Links },
]

export default function App() {
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'today')

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'today')
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const current = TABS.find(t => t.id === tab) ?? TABS[0]

  return (
    <>
      <main>{<current.View />}</main>
      <nav className="tabbar">
        {TABS.map(t => (
          <a key={t.id} href={`#${t.id}`} className={t.id === current.id ? 'on' : ''}>
            <span className="tabicon">{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </>
  )
}
