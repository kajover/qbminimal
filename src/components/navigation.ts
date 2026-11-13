import { Activity, Download, FileText, Radio, Search, Server, Settings, type LucideIcon } from 'lucide-react'
import { t } from '@/i18n'

export type PageId = 'torrents' | 'add' | 'rss' | 'search' | 'logs' | 'statistics' | 'settings'

const PAGES: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'torrents', label: t('Torrents'), icon: Download },
  { id: 'add', label: t('Add'), icon: Server },
  { id: 'rss', label: 'RSS', icon: Radio },
  { id: 'search', label: t('Search'), icon: Search },
  { id: 'logs', label: t('Logs'), icon: FileText },
  { id: 'statistics', label: t('Statistics'), icon: Activity },
  { id: 'settings', label: t('Settings'), icon: Settings },
]

// Logs and Statistics sit apart from the other pages in the menu and sidebar, and stay off the phone tab bar.
const EXTRA: PageId[] = ['logs', 'statistics']
export const MAIN_PAGES = PAGES.filter(page => !EXTRA.includes(page.id))
export const EXTRA_PAGES = PAGES.filter(page => EXTRA.includes(page.id))
