import { useState } from 'react'
import { readStored, writeStored } from '@/lib/storage'
import { searchMatcher, toggleChoice } from '@/lib/torrentFilters'

// Which sections are folded, kept on this device under `storageKey`, and what each section's own
// search field holds. `initial` gives the folded sections before any were changed here.
export function useSidebarSections(storageKey: string, initial: () => string[] = () => []) {
  const [folded, setFolded] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(readStored(storageKey) ?? 'null')
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : initial()
    } catch {
      return initial()
    }
  })
  const [texts, setTexts] = useState<Record<string, string>>({})
  const fold = (id: string) => setFolded(current => {
    const next = toggleChoice(current, id)
    writeStored(storageKey, JSON.stringify(next))
    return next
  })
  return {
    folded,
    fold,
    // The props that give a Section its search field.
    searchProps: (id: string) => ({ search: texts[id] ?? '', onSearch: (text: string) => setTexts(current => ({ ...current, [id]: text })) }),
    // The items whose name matches the section's search, with wildcards like the quick search.
    matching: <T,>(id: string, items: T[], label: (item: T) => string) => {
      const matches = searchMatcher(texts[id] ?? '')
      return matches ? items.filter(item => matches(label(item))) : items
    },
  }
}
