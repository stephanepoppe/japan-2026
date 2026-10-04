import { useState } from 'react'

const mapsUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

export default function ItemRow({ item, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)

  if (!editing) {
    return (
      <article className="card entry mine">
        <span className="when">{item.time ?? '—'}</span>
        <div className="body">
          <div className="title">{item.title}{item.pending && <em className="muted small"> · not synced</em>}</div>
          {item.location && (
            <a className="muted small loc" href={mapsUrl(item.location)} target="_blank" rel="noreferrer">
              ⌖ {item.location}
            </a>
          )}
        </div>
        <button className="x" onClick={() => { setDraft(item); setEditing(true) }} aria-label="Edit">✎</button>
      </article>
    )
  }

  const save = e => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    onUpdate(item.id, {
      title,
      time: draft.time || null,
      location: draft.location?.trim() || null,
    })
    setEditing(false)
  }

  return (
    <form className="card entry editing" onSubmit={save}>
      <input className="f-title" value={draft.title} autoFocus
             onChange={e => setDraft({ ...draft, title: e.target.value })}
             placeholder="What?" aria-label="Title" />
      <div className="editrow">
        <input className="f-time" type="time" value={draft.time ?? ''}
               onChange={e => setDraft({ ...draft, time: e.target.value })} aria-label="Time" />
        <input className="f-loc" value={draft.location ?? ''}
               onChange={e => setDraft({ ...draft, location: e.target.value })}
               placeholder="Where? (optional)" aria-label="Location" />
      </div>
      <div className="editactions">
        <button type="button" className="btn ghost danger"
                onClick={() => { setEditing(false); onRemove(item.id) }}>Delete</button>
        <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        <button type="submit" className="btn">Save</button>
      </div>
    </form>
  )
}
