import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

// What a page had open or picked (the selection, the open details, the filters), kept while the
// app runs, so switching to another page and back finds it as it was left. Only in memory: a
// reload starts fresh, and logging out forgets it. Without a key it's plain state.
const memory = new Map<string, unknown>()

export function useRemembered<T>(key: string | undefined, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (key !== undefined && memory.has(key) ? memory.get(key) as T : initial instanceof Function ? initial() : initial))
  useEffect(() => { if (key !== undefined) memory.set(key, value) }, [key, value])
  return [value, setValue]
}

export const isRemembered = (key: string) => memory.has(key)
export const forget = (...keys: string[]) => keys.forEach(key => memory.delete(key))
export const forgetPages = () => memory.clear()
