#!/usr/bin/env node
// Lists text passed to t('...') that a translation doesn't cover yet, and translations no longer
// used. Run with: npm run i18n:check
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src')
const used = new Set()

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n' && entry.name !== 'test') walk(full)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      const source = ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, full.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const visit = (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) used.add(node.arguments[0].text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
}
walk(root)

let problems = 0
const localesDir = path.join(root, 'i18n', 'locales')
for (const file of fs.readdirSync(localesDir).filter(name => name.endsWith('.json')).sort()) {
  let catalog
  try {
    catalog = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'))
  } catch (error) {
    console.log(`${file}: not valid JSON (${error.message})`)
    problems++
    continue
  }
  const missing = [...used].filter(key => !(key in catalog))
  // Every {placeholder} in the English text has to stay in the translation, spelled the same.
  const names = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join()
  const broken = Object.entries(catalog).filter(([english, translated]) => typeof translated !== 'string' || names(english) !== names(translated))
  console.log(`${file}: ${Object.keys(catalog).length} translations, ${missing.length} missing`)
  for (const key of missing) console.log(`  missing: ${key}`)
  for (const [key] of broken) console.log(`  placeholders differ: ${key}`)
  problems += missing.length + broken.length
}
// Text shown through a variable, like column names, isn't found here and is listed in the catalogs by hand.
process.exitCode = problems ? 1 : 0
