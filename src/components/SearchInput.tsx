import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

// A search field: the shared field with a magnifying glass and its ×, taking the text instead of
// the change event.
// `className` sizes the wrapper; the field fills it.
export function SearchInput({ value, onValueChange, className, inputClassName, ...props }: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onValueChange: (value: string) => void
  inputClassName?: string
}) {
  return <Input type="search" value={value} onChange={(e) => onValueChange(e.target.value)} wrapperClassName={className} className={inputClassName} icon={<Search className="size-4" />} {...props} />
}
