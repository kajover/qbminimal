import { describe, expect, it } from 'vitest'
import { buildFileTree, filterFileTree, folderPaths, sortFileTree, type FileTreeFolder, type FileTreeNode } from './fileTree'
import type { TorrentFile } from '@/types'

const file = (index: number, name: string, size: number, priority = 1, progress = 0): TorrentFile => ({ index, name, size, priority, progress })

describe('buildFileTree', () => {
  it('nests files in folders, folders first and names in natural order', () => {
    const tree = buildFileTree([file(0, 'Show/ep10.mkv', 10), file(1, 'Show/ep2.mkv', 10), file(2, 'Show/Extras/a.txt', 1), file(3, 'readme.txt', 1)])
    expect(tree.map(n => n.name)).toEqual(['Show', 'readme.txt'])
    const show = tree[0] as FileTreeFolder
    expect(show.children.map(n => n.name)).toEqual(['Extras', 'ep2.mkv', 'ep10.mkv'])
    expect(show.size).toBe(21)
    expect(show.indexes.sort()).toEqual([0, 1, 2])
  })

  it('knows whether a folder is wanted fully, partly, or not at all', () => {
    const [all] = buildFileTree([file(0, 'A/1', 1), file(1, 'A/2', 1)]) as FileTreeFolder[]
    const [some] = buildFileTree([file(0, 'A/1', 1), file(1, 'A/2', 1, 0)]) as FileTreeFolder[]
    const [none] = buildFileTree([file(0, 'A/1', 1, 0)]) as FileTreeFolder[]
    expect([all.wanted, some.wanted, none.wanted]).toEqual(['all', 'some', 'none'])
  })

  it('adds up downloaded bytes for folder progress', () => {
    const [folder] = buildFileTree([file(0, 'A/1', 100, 1, 1), file(1, 'A/2', 100, 1, 0.5)]) as FileTreeFolder[]
    expect(folder.done / folder.size).toBe(0.75)
  })
})

describe('sorting, searching and folders', () => {
  const tree = buildFileTree([
    { index: 0, name: 'Show/S01/b.mkv', size: 300, progress: 0.5, priority: 1 },
    { index: 1, name: 'Show/S01/a.mkv', size: 100, progress: 1, priority: 6 },
    { index: 2, name: 'Show/notes.txt', size: 5, progress: 0, priority: 0 },
  ])
  const priority = (node: FileTreeNode) => (node.kind === 'file' ? node.file.priority : -1)

  it('sorts each folder, folders and files together except by name', () => {
    const bySize = sortFileTree(tree, 'size', true, priority)
    const show = bySize[0] as FileTreeFolder
    expect(show.children.map(node => node.name)).toEqual(['S01', 'notes.txt'])
    expect((sortFileTree(tree, 'size', false, priority)[0] as FileTreeFolder).children.map(node => node.name)).toEqual(['notes.txt', 'S01'])
    expect((sortFileTree(tree, 'name', true, priority)[0] as FileTreeFolder).children.map(node => node.name)).toEqual(['S01', 'notes.txt'])
    expect((show.children[0] as FileTreeFolder).children.map(node => node.name)).toEqual(['b.mkv', 'a.mkv'])
    const byProgress = sortFileTree(tree, 'progress', false, priority)
    const season = (byProgress[0] as FileTreeFolder).children.find(node => node.name === 'S01') as FileTreeFolder
    expect(season.children.map(node => node.name)).toEqual(['b.mkv', 'a.mkv'])
    // notes.txt hasn't started, so it comes before the folder, whose files have.
    expect((byProgress[0] as FileTreeFolder).children.map(node => node.name)).toEqual(['notes.txt', 'S01'])
  })

  it('keeps the matching files and the folders leading to them', () => {
    const found = filterFileTree(tree, 'A.MKV')
    expect(folderPaths(found)).toEqual(['Show', 'Show/S01'])
    expect(((found[0] as FileTreeFolder).children[0] as FileTreeFolder).children.map(node => node.name)).toEqual(['a.mkv'])
    expect(filterFileTree(tree, 'nothing')).toEqual([])
  })
})

describe('incognito file names', () => {
  it('replaces every part of a path the same way, keeping extensions', async () => {
    const { disguiseFiles, incognitoName } = await import('./incognito')
    const base = incognitoName('abc').replace(/\.iso$/, '')
    const files = disguiseFiles([{ name: 'Show/S01/a.mkv' }, { name: 'Show/b.srt' }], 'abc')
    expect(files.map(f => f.name)).toEqual([`${base}/${base}-extras-1/${base}-1.mkv`, `${base}/${base}-2.srt`])
  })
})
