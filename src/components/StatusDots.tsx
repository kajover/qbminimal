import type { StatusNote } from '@/lib/statusNotes'
import { cn } from '@/lib/utils'

// The dots after Statistics in the menu and sidebar.
export function StatusDots({ notes, className }: { notes: StatusNote[]; className?: string }) {
  if (!notes.length) return null
  return (
    <span className={cn('flex shrink-0 items-center gap-1', className)} title={notes.map(note => note.label).join(', ')}>
      {notes.map(note => <span key={note.label} aria-hidden className={cn('size-2 rounded-full', note.dot)} />)}
      <span className="sr-only">{notes.map(note => note.label).join(', ')}</span>
    </span>
  )
}
