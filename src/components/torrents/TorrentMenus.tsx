import { Fragment, useState, type ComponentType, type ReactNode } from 'react'
import { WIDE } from '@/lib/pageScroll'
import { Check, CheckCheck, ChevronDown, ChevronRight, Copy, Eye, ListOrdered, MoreHorizontal, Pause, Pin, Play, Settings2, Trash2, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { isStoppedState } from '@/lib/torrentState'
import type { Torrent } from '@/types'
import type { MenuEntry, MenuGroup } from './bulkActions'
import { t } from '@/i18n'
import { altKey, modKey, withKeys } from '@/lib/shortcutKeys'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// The groups that open as submenus, with their icons.
const SUBMENUS: [name: string, icon: LucideIcon][] = [['Options', Settings2], ['Queue', ListOrdered], ['Copy', Copy]]

const countLabel = (torrents: Torrent[]) => (torrents.length === 1 ? torrents[0].name : t('{count} torrents', { count: torrents.length }))

type Item = ComponentType<{ className?: string; title?: string; disabled?: boolean; destructive?: boolean; variant?: 'default' | 'destructive'; onSelect?: (event: Event) => void; role?: string; 'aria-checked'?: boolean; 'aria-expanded'?: boolean; children?: ReactNode }>

// The parts of the dropdown or the right-click menu, so both build the same menu.
interface MenuKit {
  Item: Item
  Separator: ComponentType
  Label: ComponentType<{ className?: string; title?: string; children?: ReactNode }>
  Sub: ComponentType<{ children?: ReactNode }>
  SubTrigger: ComponentType<{ children?: ReactNode }>
  SubContent: ComponentType<{ children?: ReactNode }>
  // How each marks a destructive item.
  danger: { destructive?: boolean; variant?: 'destructive' }
}

const DROPDOWN: MenuKit = { Item: DropdownMenuItem as Item, Separator: DropdownMenuSeparator, Label: DropdownMenuLabel, Sub: DropdownMenuSub, SubTrigger: DropdownMenuSubTrigger, SubContent: DropdownMenuSubContent, danger: { variant: 'destructive' } }
const CONTEXT: MenuKit = { Item: ContextMenuItem as Item, Separator: ContextMenuSeparator, Label: ContextMenuLabel, Sub: ContextMenuSub, SubTrigger: ContextMenuSubTrigger, SubContent: ContextMenuSubContent, danger: { destructive: true } }

// A menu item's shortcut shows only on hover, so the menu stays as short as its names.
const keyTitle = (label: string, keys?: string) => (keys ? withKeys(label, keys) : undefined)

// Every entry starts with its icon. On/off options end with a check mark while they're on, like
// the option buttons in a torrent's details.
const EntryItems = ({ entries, kit, className }: { entries: MenuEntry[]; kit: MenuKit; className?: string }) => entries.map(entry => {
  const { Item } = kit
  const Icon = entry.icon
  const toggle = entry.checked !== undefined
  return (
    <Item key={entry.id} className={className} title={keyTitle(entry.label, entry.keys)} disabled={entry.disabled} onSelect={entry.onSelect} {...(toggle ? { role: 'menuitemcheckbox', 'aria-checked': entry.checked } : {})}>
      {Icon && <Icon />}
      {entry.label}
      {entry.checked && <Check className="ms-auto !text-foreground" />}
    </Item>
  )
})

interface MenuActions {
  // The torrents the menu acts on: the selection, which a right-click on another row replaces.
  torrents: Torrent[]
  groups: MenuGroup[]
  // Opens the torrent's details, or closes them when they're already open for it.
  onDetails: (torrent: Torrent) => void
  // The torrent whose details are open, marked with a check by Details.
  detailsHash?: string | null
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}

// What the More button and the right-click menu both hold: Details, then starting and stopping
// and the other transfer actions, organizing, the options, queue and copy submenus, and Delete.
function MenuBody({ kit, torrents, groups, onDetails, detailsHash, onStart, onStop, onDelete, onCustomize }: MenuActions & { kit: MenuKit; onCustomize?: () => void }) {
  const { Item, Separator, Label, Sub, SubTrigger, SubContent } = kit
  // A submenu opens beside the menu, which a phone has no room for: there the group opens in the
  // menu itself, below its name.
  const roomBeside = useMediaQuery('(min-width: 640px)')
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const transfer: MenuEntry[] = [
    { id: 'start', label: t('Start'), keys: altKey('S'), icon: Play, onSelect: onStart, disabled: !torrents.some(torrent => isStoppedState(torrent.state)) },
    { id: 'stop', label: t('Stop'), keys: altKey('P'), icon: Pause, onSelect: onStop, disabled: torrents.every(torrent => isStoppedState(torrent.state)) },
    ...groups.filter(group => group.name === 'Transfer').flatMap(group => group.entries),
  ]
  const organize = groups.filter(group => group.name === 'Organize').flatMap(group => group.entries)
  return (
    <>
      {/* The name takes the menu's width without setting it: the menu is as wide as its actions. */}
      <Label className="w-0 min-w-full truncate" title={torrents.length === 1 ? torrents[0].name : undefined}>{countLabel(torrents)}</Label>
      {torrents.length === 1 && (
        <Item title={keyTitle(t('Details'), t('Enter'))} onSelect={() => onDetails(torrents[0])} role="menuitemcheckbox" aria-checked={detailsHash === torrents[0].hash}>
          <Eye />{t('Details')}
          {detailsHash === torrents[0].hash && <Check className="ms-auto !text-foreground" />}
        </Item>
      )}
      <Separator />
      <EntryItems entries={transfer} kit={kit} />
      <Separator />
      <EntryItems entries={organize} kit={kit} />
      <Separator />
      {SUBMENUS.map(([name, Icon]) => {
        const group = groups.find(other => other.name === name)
        if (!group) return null
        if (!roomBeside) {
          const open = openGroup === name
          const Chevron = open ? ChevronDown : ChevronRight
          return (
            <Fragment key={name}>
              {/* Keeps the menu open, to show the group's items. */}
              <Item onSelect={(event) => { event.preventDefault(); setOpenGroup(open ? null : name) }} aria-expanded={open}>
                <Icon />{t(name)}<Chevron className={open ? 'ms-auto' : 'ms-auto rtl:rotate-180'} />
              </Item>
              {open && <EntryItems entries={group.entries} kit={kit} className="ps-8" />}
            </Fragment>
          )
        }
        return (
          <Sub key={name}>
            <SubTrigger><Icon />{t(name)}</SubTrigger>
            <SubContent>
              <EntryItems entries={group.entries} kit={kit} />
            </SubContent>
          </Sub>
        )
      })}
      {/* Unseen, the groups' actions widen the menu as if listed in it, as they are on phones, so the
          menu is as wide on phones and desktop, and opening a group never widens it. */}
      <div aria-hidden className="invisible h-0 overflow-hidden">
        {SUBMENUS.flatMap(([name]) => groups.find(group => group.name === name)?.entries ?? []).map(entry => (
          <div key={entry.id} className="flex items-center gap-2 px-2 ps-8 text-sm">{entry.icon && <entry.icon className="size-4" />}{entry.label}{entry.checked !== undefined && <Check className="size-4" />}</div>
        ))}
      </div>
      <Separator />
      <Item {...kit.danger} title={keyTitle(t('Delete'), `${altKey('D')}, Del`)} onSelect={onDelete}><Trash2 />{torrents.length === 1 ? t('Delete') : t('Delete {length}', { length: torrents.length })}</Item>
      {onCustomize && (
        <Fragment>
          <Separator />
          <Item onSelect={onCustomize}><Pin />{t('Choose actions for the bar')}</Item>
        </Fragment>
      )}
    </>
  )
}

// The More button of the selection bar: the same menu as a right-click, and choosing the bar's actions.
// On the cards, which have no title row with a select-all box, it selects all or none too.
export function MoreMenu({ onCustomize, cards, ...actions }: MenuActions & { onCustomize?: () => void; cards?: { onSelectAll?: () => void; onClear: () => void } }) {
  // On phones the menu rises from the selection bar, with a gap so the two don't run together.
  const wide = useMediaQuery(WIDE)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Just the dots, like the bar's other extra buttons. */}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('More actions')} title={t('More actions')}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* As wide as its longest action, so none is cut off, but never wider than the screen. As tall as
          the room there is, like the right-click menu, so on a big screen it shows whole. */}
      <DropdownMenuContent align="end" sideOffset={wide ? 4 : 18} collisionPadding={8} className="w-max max-w-[calc(100vw-1rem)] overflow-y-auto">
        {cards && (
          <>
            {cards.onSelectAll && <DropdownMenuItem title={keyTitle(t('Select all'), modKey('A'))} onClick={cards.onSelectAll}><CheckCheck className="size-4" />{t('Select all')}</DropdownMenuItem>}
            <DropdownMenuItem title={keyTitle(t('Clear selection'), 'Esc')} onClick={cards.onClear}><X className="size-4" />{t('Clear selection')}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <MenuBody kit={DROPDOWN} {...actions} onCustomize={onCustomize} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Right-click (or long-press) menu, the same as the More button's.
export function TorrentContextMenu({ children, ...actions }: MenuActions & { children: ReactNode }) {
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {actions.torrents.length > 0 && (
        // Scrolls when an opened group makes it taller than the room there is. As wide as its
        // longest action, the groups' too, the same on phones and desktop.
        <ContextMenuContent collisionPadding={8} className="max-h-(--radix-context-menu-content-available-height) w-max max-w-[calc(100vw-1rem)] overflow-y-auto">
          <MenuBody kit={CONTEXT} {...actions} />
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
