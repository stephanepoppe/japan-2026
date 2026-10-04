import { useCollection } from './sync'

/** Shared by Today and Calendar so they can't drift apart. Works offline (see sync.js). */
export function useItems() {
  const { list, add, update, remove } = useCollection('items')
  return { items: list, add, update, remove }
}
