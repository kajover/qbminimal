import type { ComponentProps } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// A search field with its own clear button, the same in every browser (Firefox has none, and
// Safari's and Chrome's differ). `className` sizes the wrapper; the field fills it.
export function SearchInput({ value, onValueChange, className, inputClassName, ...props }: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onValueChange: (value: string) => void
  inputClassName?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn('pe-8 [&::-webkit-search-cancel-button]:appearance-none', inputClassName)}
        {...props}
      />
      {value && (
        <button
          type="button"
          className="absolute inset-y-0 end-0 flex w-8 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t('Clear')}
          title={t('Clear')}
          onClick={() => onValueChange('')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
