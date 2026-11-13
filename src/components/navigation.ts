import { Download, FileText, Radio, Search, Server, Settings, type LucideIcon } from 'lucide-react'
import { t } from '@/i18n'

export type PageId = 'torrents' | 'add' | 'rss' | 'search' | 'logs' | 'settings'

export const PAGES: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'torrents', label: t('Torrents'), icon: Download },
  { id: 'add', label: t('Add'), icon: Server },
  { id: 'rss', label: 'RSS', icon: Radio },
  { id: 'search', label: t('Search'), icon: Search },
  { id: 'logs', label: t('Logs'), icon: FileText },
  { id: 'settings', label: t('Settings'), icon: Settings },
]

// Logs sit apart from the pages, beside Statistics in the menu and sidebar, and stay off the phone tab bar.
export const MAIN_PAGES = PAGES.filter(page => page.id !== 'logs')
export const LOGS_PAGE = PAGES.find(page => page.id === 'logs')!
