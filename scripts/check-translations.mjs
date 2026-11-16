#!/usr/bin/env node
// Lists text passed to t('...') that a translation doesn't cover yet, and translations no longer
// used. Run with: npm run i18n:check
import fs from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src')
const used = new Set()

// The text of every t('...') call: a plain string, or a template without ${} in it.
function visit(node) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach(visit)
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 't') {
    const first = node.arguments[0]
    if (first?.type === 'Literal' && typeof first.value === 'string') used.add(first.value)
    else if (first?.type === 'TemplateLiteral' && first.expressions.length === 0) used.add(first.quasis[0].value.cooked)
  }
  for (const key in node) if (key !== 'parent') visit(node[key])
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n' && entry.name !== 'test') walk(full)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      const { program, errors } = parseSync(full, fs.readFileSync(full, 'utf8'))
      if (errors.length) throw new Error(`${full}: ${errors[0].message}`)
      visit(program)
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
