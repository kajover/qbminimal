import { LayoutList, Rows4, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { viewLabel, type ShownView } from '@/lib/listSettings'
import { withKeys } from '@/lib/shortcutKeys'

const ICONS = { table: Table2, compact: Rows4, cards: LayoutList }

// One button for the three views. It shows the view on screen, and a click (or V) goes on to the
// next: the table, the compact table, then cards. It stays the same size. `onNext` steps on from
// the view in effect when the click is handled, not the one last drawn, so quick clicks each count.
export function ViewSwitch({ shown, onNext, pageKey }: { shown: ShownView; onNext: () => void; pageKey?: boolean }) {
  const Icon = ICONS[shown]
  return (
    <Button variant="outline" size="icon" className="size-8" aria-label={viewLabel(shown)} title={withKeys(viewLabel(shown), 'V')} data-key={pageKey ? 'v' : undefined} onClick={onNext}>
      <Icon className="size-4" />
    </Button>
  )
}
