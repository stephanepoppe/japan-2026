import { useState } from 'react'
import { PHRASE_GROUPS } from '../data/phrases'

export default function Phrases() {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()

  const groups = PHRASE_GROUPS
    .map(g => ({
      ...g,
      items: needle
        ? g.items.filter(p => (p.en + p.romaji + p.ja).toLowerCase().includes(needle))
        : g.items,
    }))
    .filter(g => g.items.length)

  return (
    <div className="stack">
      <input className="search" type="search" value={q} onChange={e => setQ(e.target.value)}
             placeholder="Search phrases…" aria-label="Search phrases" />

      {groups.map(g => (
        <section key={g.group}>
          <h2 className="group-head">{g.group}</h2>
          <div className="stack-tight">
            {g.items.map(p => (
              <div className="card phrase" key={p.ja}>
                <div className="ja" lang="ja">{p.ja}</div>
                <div className="romaji">{p.romaji}</div>
                <div className="en muted">{p.en}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!groups.length && <p className="muted">Nothing matches “{q}”.</p>}
    </div>
  )
}
