import { jsonTokens, type JsonTokenKind } from '@/lib/logDetails'

const JSON_COLORS: Record<JsonTokenKind, string> = {
  key: 'text-sky-700 dark:text-sky-400',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-amber-700 dark:text-amber-400',
  literal: 'text-violet-700 dark:text-violet-400',
  plain: 'text-muted-foreground',
}

// JSON as a block of colored text, to read and copy, as in a log entry or a file's info.
export function JsonView({ json }: { json: string }) {
  return (
    <pre className="min-w-0 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
      {jsonTokens(json).map((token, index) => <span key={index} className={JSON_COLORS[token.kind]}>{token.text}</span>)}
    </pre>
  )
}
