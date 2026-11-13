// Runs every check a change has to pass, one after another, and prints one line for each that
// passes. Output is shown only for a check that fails, which stops the run.
//   npm run check
import { spawnSync } from 'node:child_process'

const CHECKS = [
  ['typecheck', ['run', '-s', 'typecheck']],
  ['lint', ['run', '-s', 'lint']],
  ['tests', ['run', '-s', 'test', '--', '--reporter=dot']],
  ['translations', ['run', '-s', 'i18n:check']],
  ['build', ['exec', '--', 'vite', 'build', '--logLevel', 'error']],
]

for (const [name, args] of CHECKS) {
  const started = Date.now()
  const run = spawnSync('npm', args, { encoding: 'utf8' })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  // Without colour codes, so the summary and errors read plainly.
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '')
  // The translation check lists every catalog; one with keys missing fails it.
  const failed = run.status !== 0 || (name === 'translations' && /missing: /.test(output))
  if (failed) {
    console.log(`✗ ${name} (${seconds}s)\n`)
    console.log(output.trim().split('\n').slice(-60).join('\n'))
    process.exit(1)
  }
  const summary = name === 'tests' ? output.match(/Tests\s+(\d+ passed[^\n]*)/)?.[1]?.trim() : undefined
  console.log(`✓ ${name} (${seconds}s)${summary ? `: ${summary}` : ''}`)
}
