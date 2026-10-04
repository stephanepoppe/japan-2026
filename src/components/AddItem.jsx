import { useState } from 'react'

const EMPTY = { title: '', time: '', location: '' }

export default function AddItem({ day, onAdd }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)

  if (!open) {
    return <button className="addbtn" onClick={() => setOpen(true)}>+ Add something</button>
  }

  const submit = e => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    onAdd({ day, title, time: draft.time || null, location: draft.location.trim() || null })
    setDraft(EMPTY)
    setOpen(false)
  }

  return (
    <form className="card entry editing" onSubmit={submit}>
      <input className="f-title" value={draft.title} autoFocus
             onChange={e => setDraft({ ...draft, title: e.target.value })}
             placeholder="What?" aria-label="Title" />
      <div className="editrow">
        <input className="f-time" type="time" value={draft.time}
               onChange={e => setDraft({ ...draft, time: e.target.value })} aria-label="Time" />
        <input className="f-loc" value={draft.location}
               onChange={e => setDraft({ ...draft, location: e.target.value })}
               placeholder="Where? (optional)" aria-label="Location" />
      </div>
      <div className="editactions">
        <button type="button" className="btn ghost"
                onClick={() => { setDraft(EMPTY); setOpen(false) }}>Cancel</button>
        <button type="submit" className="btn">Add</button>
      </div>
    </form>
  )
}
