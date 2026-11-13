import { createContext } from 'react'

// In compact mode, the place in the header bar for each page's title row (see PageHeader). `whole`
// on wide screens, where the selection bar goes there too. Null when the page shows its own row.
export const HeaderSlot = createContext<{ element: HTMLElement; whole: boolean } | null>(null)
