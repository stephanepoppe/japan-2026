import { useState } from 'react'

const EMPTY = { title: '', time: '', location: '' }
const field = 'w-full rounded-md border border-rule bg-raised px-3 py-2.5 text-ink placeholder:text-dim focus:border-ai focus:outline-none'
const button = 'cursor-pointer rounded-md px-4 py-2 text-sm font-medium'

/** The one form for adding and editing a plan, so both look and behave the same. */
export function ItemForm({ draft, setDraft, onSubmit, submitLabel, onCancel, onDelete }) {
  return (
    <form className="grid gap-3 py-6" onSubmit={onSubmit}>
      <input className={field} value={draft.title} autoFocus
             onChange={e => setDraft({ ...draft, title: e.target.value })}
             placeholder="What?" aria-label="Title" />
      <div className="grid grid-cols-[8.75rem_1fr] gap-3">
        <input className={field} type="time" value={draft.time ?? ''}
               onChange={e => setDraft({ ...draft, time: e.target.value })} aria-label="Time" />
        <input className={field} value={draft.location ?? ''}
               onChange={e => setDraft({ ...draft, location: e.target.value })}
               placeholder="Where? (optional)" aria-label="Location" />
      </div>
      <div className="flex items-center gap-2">
        {onDelete && <button type="button" className={`${button} mr-auto pl-0 text-ai`} onClick={onDelete}>Delete</button>}
        <button type="button" className={`${button} ml-auto text-dim`} onClick={onCancel}>Cancel</button>
        <button type="submit" className={`${button} bg-ai text-on-ai`}>{submitLabel}</button>
      </div>
    </form>
  )
}

export default function AddItem({ day, onAdd }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)

  if (!open) {
    return (
      <button className="w-full cursor-pointer py-5 text-left text-ai" onClick={() => setOpen(true)}>
        Add a plan
      </button>
    )
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
    <ItemForm draft={draft} setDraft={setDraft} onSubmit={submit} submitLabel="Add plan"
              onCancel={() => { setDraft(EMPTY); setOpen(false) }} />
  )
}
