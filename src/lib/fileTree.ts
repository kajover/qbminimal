import type { TorrentFile } from '@/types'

export interface FileTreeFolder {
  kind: 'folder'
  name: string
  // Path inside the torrent, with "/" between folders.
  path: string
  children: FileTreeNode[]
  size: number
  // Bytes downloaded, for the folder's progress.
  done: number
  // Every file index below this folder, to change them all at once.
  indexes: number[]
  // Whether all, none, or some of the files below are wanted.
  wanted: 'all' | 'none' | 'some'
}

export interface FileTreeFile {
  kind: 'file'
  name: string
  path: string
  file: TorrentFile
}

export type FileTreeNode = FileTreeFolder | FileTreeFile

const byName = (a: FileTreeNode, b: FileTreeNode) =>
  a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'folder' ? -1 : 1

// Turns qBittorrent's flat file list into folders and files, folders first, both in name order.
export function buildFileTree(files: TorrentFile[]): FileTreeNode[] {
  const root: FileTreeFolder = { kind: 'folder', name: '', path: '', children: [], size: 0, done: 0, indexes: [], wanted: 'none' }

  for (const file of files) {
    const parts = file.name.split('/')
    let folder = root
    parts.slice(0, -1).forEach((part, depth) => {
      const path = parts.slice(0, depth + 1).join('/')
      let next = folder.children.find((node): node is FileTreeFolder => node.kind === 'folder' && node.path === path)
      if (!next) {
        next = { kind: 'folder', name: part, path, children: [], size: 0, done: 0, indexes: [], wanted: 'none' }
        folder.children.push(next)
      }
      folder = next
    })
    folder.children.push({ kind: 'file', name: parts[parts.length - 1], path: file.name, file })
  }

  // Totals are filled in from the bottom up.
  const finish = (folder: FileTreeFolder): void => {
    let wanted = 0
    for (const node of folder.children) {
      if (node.kind === 'folder') {
        finish(node)
        folder.size += node.size
        folder.done += node.done
        folder.indexes.push(...node.indexes)
        wanted += node.wanted === 'all' ? node.indexes.length : node.wanted === 'some' ? 0.5 : 0
      } else {
        folder.size += node.file.size
        folder.done += node.file.size * node.file.progress
        folder.indexes.push(node.file.index)
        if (node.file.priority > 0) wanted++
      }
    }
    folder.wanted = wanted === 0 ? 'none' : wanted === folder.indexes.length ? 'all' : 'some'
    folder.children.sort(byName)
  }
  finish(root)
  return root.children
}

export type FileSortField = 'name' | 'progress' | 'size' | 'priority'

const progressOf = (node: FileTreeNode) => (node.kind === 'file' ? node.file.progress : node.size > 0 ? node.done / node.size : 0)
const sizeOf = (node: FileTreeNode) => (node.kind === 'file' ? node.file.size : node.size)

// The tree with each folder's contents in the given order. `priorityOf`
// gives a folder's priority (its files', or -1 when they differ).
export function sortFileTree(nodes: FileTreeNode[], field: FileSortField, descending: boolean, priorityOf: (node: FileTreeNode) => number): FileTreeNode[] {
  const value = (node: FileTreeNode): number => (field === 'progress' ? progressOf(node) : field === 'size' ? sizeOf(node) : priorityOf(node))
  // By name, folders come first as in a file manager; by size, progress or priority, folders and
  // files are sorted together, so the order follows the values alone.
  const compare = (a: FileTreeNode, b: FileTreeNode) => {
    if (field === 'name' && a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    const order = field === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true }) : value(a) - value(b) || a.name.localeCompare(b.name, undefined, { numeric: true })
    return descending ? -order : order
  }
  return [...nodes].sort(compare).map(node => (node.kind === 'folder' ? { ...node, children: sortFileTree(node.children, field, descending, priorityOf) } : node))
}

// Only the files whose path holds the text, with the folders leading to them; a folder whose own
// name matches keeps everything inside it.
export function filterFileTree(nodes: FileTreeNode[], text: string): FileTreeNode[] {
  const wanted = text.trim().toLowerCase()
  if (!wanted) return nodes
  return nodes.flatMap((node): FileTreeNode[] => {
    if (node.name.toLowerCase().includes(wanted)) return [node]
    if (node.kind === 'file') return []
    const children = filterFileTree(node.children, wanted)
    return children.length ? [{ ...node, children }] : []
  })
}

// Every folder's path, to open or close them all at once.
export function folderPaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap(node => (node.kind === 'folder' ? [node.path, ...folderPaths(node.children)] : []))
}

// Every file's and folder's path, to open all their details at once.
export function allNodePaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap(node => (node.kind === 'folder' ? [node.path, ...allNodePaths(node.children)] : [node.path]))
}
