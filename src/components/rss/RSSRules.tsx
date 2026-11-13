import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Download, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCategories, useRemoveRSSRule, useRSSFeeds, useRSSRules, useSetRSSRule } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import type { RSSRule } from '@/types'
import { RuleExtras } from './RuleExtras'
import { exportRules, parseRulesFile } from '@/lib/rssRulesFile'
import { t } from '@/i18n'

const EMPTY_RULE: RSSRule = { enabled: true, mustContain: '', mustNotContain: '', useRegex: false, affectedFeeds: [], assignedCategory: '', savePath: '' }

interface Editing {
  name: string
  isNew: boolean
  rule: RSSRule
}

export function RSSRules() {
  const { data: rules } = useRSSRules()
  const { data: feedsData } = useRSSFeeds()
  const { data: categories } = useCategories()
  const setRule = useSetRSSRule()
  const removeRule = useRemoveRSSRule()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  const feeds = feedsData?.feeds ?? []
  const importInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportRules(rules ?? {})], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'qbittorrent-rss-rules.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Like qBittorrent's own import, a rule with the same name is replaced.
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const parsed = parseRulesFile(await file.text())
    if (typeof parsed === 'string') {
      toast.error(t('Couldn\'t import rules'), { description: parsed })
      return
    }
    setImporting(true)
    const names = Object.keys(parsed)
    const replaced = names.filter(name => rules?.[name]).length
    let failed = 0
    for (const name of names) {
      try {
        await setRule.mutateAsync({ name, rule: parsed[name] })
      } catch {
        failed++
      }
    }
    setImporting(false)
    const imported = names.length - failed
    if (failed > 0) toast.warning(t('Imported {imported} of {length} rules', { imported, length: names.length }), { description: t('{failed} couldn\'t be saved.', { failed }) })
    else toast.success(imported === 1 ? t('Imported 1 rule') : t('Imported {imported} rules', { imported }), { description: replaced > 0 ? t('{replaced} replaced a rule with the same name.', { replaced }) : undefined })
  }
  const update = (patch: Partial<RSSRule>) => setEditing(current => current && { ...current, rule: { ...current.rule, ...patch } })

  const open = (next: Editing) => {
    setEditing(next)
    setEditorOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return
    if (editing.isNew && rules?.[name]) {
      toast.error(t('A rule with this name already exists'))
      return
    }
    // Newer qBittorrent versions keep these in torrentParams, which takes priority when present.
    const { rule } = editing
    const def: RSSRule = rule.torrentParams
      ? { ...rule, torrentParams: { ...rule.torrentParams, category: rule.assignedCategory, save_path: rule.savePath } }
      : rule
    try {
      await setRule.mutateAsync({ name, rule: def })
      toast.success(t('Rule saved'))
      setEditorOpen(false)
    } catch (error) {
      toast.error(t('Failed to save rule'), { description: error instanceof Error ? error.message : undefined })
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    try {
      await removeRule.mutateAsync(removing)
      toast(t('Rule removed'))
      setRemoveOpen(false)
    } catch (error) {
      toast.error(t('Failed to remove rule'), { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <Card className="gap-2">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{t('Download rules')}</CardTitle>
        <div className="flex gap-1">
        <input ref={importInput} type="file" accept=".json,application/json" className="hidden" onChange={importFile} />
        <Button size="sm" variant="outline" aria-label={t('Import rules')} title={t('Import rules from a file')} disabled={importing} onClick={() => importInput.current?.click()}>
          <Upload className="size-4" />
        </Button>
        <Button size="sm" variant="outline" aria-label={t('Export rules')} title={t('Export rules to a file')} disabled={!rules || Object.keys(rules).length === 0} onClick={download}>
          <Download className="size-4" />
        </Button>
        <Button size="sm" variant="outline" aria-label={t('Add rule')} title={t('Add rule')} onClick={() => open({ name: '', isNew: true, rule: EMPTY_RULE })}>
          <Plus className="size-4" />
        </Button>
        </div>
      </CardHeader>

      <CardContent>
      {Object.keys(rules ?? {}).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('No rules configured')}</p>
      ) : (
        <ul className="divide-y">
        {Object.entries(rules ?? {}).map(([name, rule]) => (
          <li key={name} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {rule.enabled ? t('On') : t('Off')}{rule.mustContain ? t(' · Must contain: {mustContain}', { mustContain: rule.mustContain }) : ''}
                </p>
              </div>
              <RuleExtras name={name} existing={Object.keys(rules ?? {})} />
              <Button variant="ghost" size="icon" className="size-8" aria-label={t('Edit {name}', { name })} title={t('Edit')} onClick={() => open({
                name,
                isNew: false,
                rule: {
                  ...EMPTY_RULE,
                  ...rule,
                  assignedCategory: rule.torrentParams?.category ?? rule.assignedCategory ?? '',
                  savePath: rule.torrentParams?.save_path ?? rule.savePath ?? '',
                },
              })}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label={t('Delete {name}', { name })} title={t('Delete')} onClick={() => { setRemoving(name); setRemoveOpen(true) }}>
                <Trash2 className="size-4" />
              </Button>
          </li>
        ))}
        </ul>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? t('Add rule') : t('Edit rule')}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="rule-name">{t('Name')}</Label>
                <Input id="rule-name" required disabled={!editing.isNew} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-contain">{t('Must contain')}</Label>
                <Input id="rule-contain" value={editing.rule.mustContain} onChange={(e) => update({ mustContain: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-not-contain">{t('Must not contain')}</Label>
                <Input id="rule-not-contain" value={editing.rule.mustNotContain} onChange={(e) => update({ mustNotContain: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-category">{t('Category')}</Label>
                <select id="rule-category" value={editing.rule.assignedCategory} onChange={(e) => update({ assignedCategory: e.target.value })} className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm">
                  <option value="">{t('No category')}</option>
                  {editing.rule.assignedCategory && !categories?.[editing.rule.assignedCategory] && <option value={editing.rule.assignedCategory}>{editing.rule.assignedCategory}</option>}
                  {Object.keys(categories ?? {}).map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-path">{t('Save location')}</Label>
                <Input id="rule-path" value={editing.rule.savePath} onChange={(e) => update({ savePath: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="rule-regex" checked={editing.rule.useRegex} onCheckedChange={(checked) => update({ useRegex: !!checked })} />
                <Label htmlFor="rule-regex">{t('Use regular expressions')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="rule-enabled" checked={editing.rule.enabled} onCheckedChange={(checked) => update({ enabled: !!checked })} />
                <Label htmlFor="rule-enabled">{t('Rule is on')}</Label>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">{t('Feeds')}</legend>
                {feeds.length === 0 && <p className="text-xs text-muted-foreground">{t('Add a feed first, so this rule has something to match.')}</p>}
                {feeds.map(feed => (
                  <div key={feed.uid} className="flex items-center gap-2">
                    <Checkbox
                      id={`rule-feed-${feed.uid}`}
                      checked={editing.rule.affectedFeeds.includes(feed.url)}
                      onCheckedChange={(checked) => update({
                        affectedFeeds: checked
                          ? [...editing.rule.affectedFeeds, feed.url]
                          : editing.rule.affectedFeeds.filter(url => url !== feed.url),
                      })}
                    />
                    <Label htmlFor={`rule-feed-${feed.uid}`} className="min-w-0 truncate">{feed.title}</Label>
                  </div>
                ))}
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>{t('Cancel')}</Button>
                <Button type="submit" disabled={setRule.isPending}><Save />{t('Save')}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete this rule?')}</DialogTitle>
            <DialogDescription>{removing}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>{t('Cancel')}</Button>
            <Button variant="destructive" disabled={removeRule.isPending} onClick={confirmRemove}><Trash2 />{t('Delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  )
}
