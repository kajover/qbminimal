import { Fragment, type ComponentType, type ReactNode } from 'react'
import { Eye, MoreHorizontal, Pin, Pause, Play, Settings2, Copy, Trash2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { isStoppedState } from '@/lib/torrentState'
import { cn } from '@/lib/utils'
import type { Torrent } from '@/types'
import type { MenuEntry, MenuGroup } from './bulkActions'
import { t } from '@/i18n'

// Icons for the groups that open as submenus of the right-click menu.
const GROUP_ICONS: Record<string, LucideIcon> = { Options: Settings2, Copy }

const countLabel = (torrents: Torrent[]) => (torrents.length === 1 ? torrents[0].name : t('{count} torrents', { count: torrents.length }))

type MenuItem = ComponentType<{ className?: string; disabled?: boolean; onSelect?: (event: Event) => void; 'aria-label'?: string; 'aria-pressed'?: boolean; children?: ReactNode }>

// A row of icon-only menu items, each named by a label on hover and focus. The arrow keys move
// along it like along the rest of the menu.
function IconRow({ entries, Item }: { entries: MenuEntry[]; Item: MenuItem }) {
  return (
    <div className="flex flex-wrap gap-0.5 px-0.5 py-0.5" role="group">
      {entries.map(entry => {
        const Icon = entry.icon ?? MoreHorizontal
        return (
          <Tooltip key={entry.id} label={entry.label}>
            <Item
              aria-label={entry.label}
              aria-pressed={entry.pressed}
              disabled={entry.disabled}
              onSelect={entry.onSelect}
              className={cn('size-8 justify-center p-0 [&_svg:not([class*=size-])]:size-4', entry.pressed && 'bg-accent text-foreground [&_svg]:!text-foreground')}
            >
              <Icon />
            </Item>
          </Tooltip>
        )
      })}
    </div>
  )
}

const EntryItems = ({ entries, Item }: { entries: MenuEntry[]; Item: MenuItem }) => entries.map(entry => {
  const Icon = entry.icon
  return <Item key={entry.id} onSelect={entry.onSelect}>{Icon && <Icon />}{entry.label}</Item>
})

const DropdownItem: MenuItem = DropdownMenuItem
const ContextItem: MenuItem = ContextMenuItem

// The More button of the selection bar: every other action, in sections, the quick ones as icons.
export function MoreMenu({ torrents, groups, onCustomize }: { torrents: Torrent[]; groups: MenuGroup[]; onCustomize?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1" title={t('More actions')}>
          <MoreHorizontal className="size-4" />
          <span className="max-sm:sr-only">{t('More')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
        <DropdownMenuLabel className="truncate">{countLabel(torrents)}</DropdownMenuLabel>
        {groups.map(group => (
          <Fragment key={group.name}>
            <DropdownMenuSeparator />
            {group.icons ? <IconRow entries={group.entries} Item={DropdownItem} /> : <EntryItems entries={group.entries} Item={DropdownItem} />}
          </Fragment>
        ))}
        {onCustomize && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCustomize}><Pin />{t('Choose actions for the bar')}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface TorrentContextMenuProps {
  // The torrents the menu acts on: the selection, which a right-click on another row replaces.
  torrents: Torrent[]
  groups: MenuGroup[]
  onDetails: (torrent: Torrent) => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  // The table body or card list it opens from.
  children: ReactNode
}

// Right-click (or long-press) menu: the everyday actions as a row of icons at the top, organizing
// as a short list, the rest in submenus, and deleting apart at the end.
export function TorrentContextMenu({ torrents, groups, onDetails, onStart, onStop, onDelete, children }: TorrentContextMenuProps) {
  const anyStopped = torrents.some(t => isStoppedState(t.state))
  const anyRunning = torrents.some(t => !isStoppedState(t.state))
  const quick: MenuEntry[] = [
    ...(torrents.length === 1 ? [{ id: 'details', label: t('Details'), icon: Eye, onSelect: () => onDetails(torrents[0]) }] : []),
    { id: 'start', label: t('Start'), icon: Play, onSelect: onStart, disabled: !anyStopped },
    { id: 'stop', label: t('Stop'), icon: Pause, onSelect: onStop, disabled: !anyRunning },
    ...groups.filter(group => group.name === 'Transfer').flatMap(group => group.entries),
  ]
  // Organizing as a list and the queue as icons show in the menu itself; the rest open as submenus.
  const inline = groups.filter(group => group.name !== 'Transfer' && (group.name === 'Organize' || group.icons))
  const submenus = groups.filter(group => group.name !== 'Transfer' && !inline.includes(group))

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {torrents.length > 0 && (
        <ContextMenuContent className="w-60">
          <ContextMenuLabel className="truncate" title={torrents.length === 1 ? torrents[0].name : undefined}>{countLabel(torrents)}</ContextMenuLabel>
          <IconRow entries={quick} Item={ContextItem} />
          {inline.map(group => (
            <Fragment key={group.name}>
              <ContextMenuSeparator />
              {group.icons ? <IconRow entries={group.entries} Item={ContextItem} /> : <EntryItems entries={group.entries} Item={ContextItem} />}
            </Fragment>
          ))}
          <ContextMenuSeparator />
          {submenus.map(group => {
            const Icon = GROUP_ICONS[group.name]
            return (
              <ContextMenuSub key={group.name}>
                <ContextMenuSubTrigger>{Icon && <Icon />}{t(group.name)}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <EntryItems entries={group.entries} Item={ContextItem} />
                </ContextMenuSubContent>
              </ContextMenuSub>
            )
          })}
          <ContextMenuSeparator />
          <ContextMenuItem destructive onSelect={onDelete}><Trash2 /> {torrents.length === 1 ? t('Delete...') : t('Delete {length}...', { length: torrents.length })}</ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
