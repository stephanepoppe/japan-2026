import { useState } from 'react'
import { useCollection } from '../lib/sync'

const EMPTY = { title: '', url: '' }

export default function Links() {
  const { list: links, add, remove: drop } = useCollection('links')   // works offline, see sync.js
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [arming, setArming] = useState(null)      // id whose delete needs a second tap

  const submit = e => {
    e.preventDefault()
    const title = draft.title.trim(), url = draft.url.trim()
    if (!title || !url) return
    add({ title, url })
    setDraft(EMPTY); setOpen(false)
  }

  const remove = id => { setArming(null); drop(id) }

  return (
    <div className="stack">
      <h1>Links</h1>
      <div className="stack-tight">
        {links.map(l => (
          <div className="card item" key={l.id}>
            <a className="linkrow" href={l.url} target="_blank" rel="noopener">
              <div>{l.title}{l.pending && <em className="muted small"> · not synced</em>}</div>
              <div className="muted small">{new URL(l.url).hostname}</div>
            </a>
            {arming === l.id
              ? <button className="btn ghost danger" onClick={() => remove(l.id)}>Delete</button>
              : <button className="x" onClick={() => setArming(l.id)} aria-label={`Delete ${l.title}`}>×</button>}
          </div>
        ))}
        {!links.length && <p className="muted">No links yet.</p>}

        {open ? (
          <form className="card entry editing" onSubmit={submit}>
            <input className="f-title" value={draft.title} autoFocus required
                   onChange={e => setDraft({ ...draft, title: e.target.value })}
                   placeholder="Name" aria-label="Name" />
            <input className="f-title" type="url" pattern="https?://.+" value={draft.url} required
                   onChange={e => setDraft({ ...draft, url: e.target.value })}
                   placeholder="https://…" aria-label="URL" />
            <div className="editactions">
              <button type="button" className="btn ghost" onClick={() => { setDraft(EMPTY); setOpen(false) }}>Cancel</button>
              <button type="submit" className="btn">Add</button>
            </div>
          </form>
        ) : (
          <button className="addbtn" onClick={() => setOpen(true)}>+ Add link</button>
        )}
      </div>
    </div>
  )
}
