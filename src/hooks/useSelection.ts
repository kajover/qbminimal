import { useRef } from 'react'
import { useRemembered } from './useRemembered'
import { rangeBetween } from '@/lib/selection'

// A set of selected keys, with the last clicked one kept as the anchor for Shift ranges. With a
// memory key it's kept while another page shows.
export function useSelection(order: readonly string[], memoryKey?: string) {
  const [selected, setSelected] = useRemembered<ReadonlySet<string>>(memoryKey, () => new Set())
  const anchor = useRef<string | null>(null)

  return {
    selected,
    toggle(key: string) {
      anchor.current = key
      setSelected(current => {
        const next = new Set(current)
        if (!next.delete(key)) next.add(key)
        return next
      })
    },
    only(key: string) {
      anchor.current = key
      setSelected(new Set([key]))
    },
    // Adds everything between the anchor and this key. The anchor stays, as in file managers.
    extendTo(key: string) {
      const from = anchor.current ?? key
      if (!anchor.current) anchor.current = key
      setSelected(current => new Set([...current, ...rangeBetween(order, from, key)]))
    },
    replace(keys: Iterable<string>) {
      setSelected(new Set(keys))
    },
    remove(keys: readonly string[]) {
      setSelected(current => new Set([...current].filter(key => !keys.includes(key))))
    },
    clear() {
      anchor.current = null
      setSelected(new Set())
    },
  }
}
