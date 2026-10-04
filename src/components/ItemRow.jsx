import { useState } from 'react'
import { ItemForm } from './AddItem'

const mapsUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

export default function ItemRow({ item, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)

  if (!editing) {
    return (
      <article className="grid grid-cols-[3.5rem_1fr_auto] gap-x-3 py-6">
        <span className="pt-0.5 text-sm text-dim tabular-nums">{item.time ?? ''}</span>
        <div className="min-w-0">
          <p className="text-[1.0625rem] leading-snug">
            {item.title}
            {item.pending && <em className="ml-2 text-xs text-dim not-italic">Not synced yet</em>}
          </p>
          {item.location && (
            <a className="mt-1 inline-block text-sm text-dim underline decoration-rule underline-offset-4"
               href={mapsUrl(item.location)} target="_blank" rel="noreferrer">
              {item.location}
            </a>
          )}
        </div>
        <button className="cursor-pointer self-start text-sm text-dim hover:text-ai"
                onClick={() => { setDraft(item); setEditing(true) }}>Edit</button>
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
    <ItemForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel="Save"
              onCancel={() => setEditing(false)}
              onDelete={() => { setEditing(false); onRemove(item.id) }} />
  )
}
