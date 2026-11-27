# Contributing

Thanks for helping. Every kind of contribution is welcome:

- **Code**: bug fixes, new features, and tidying up, as [pull requests](https://github.com/kajover/qbminimal/pulls). See [Code](#code) below.
- **Ideas and questions**: start a thread in [Discussions](https://github.com/kajover/qbminimal/discussions), or join one.
- **Bugs and feature requests**: [open an issue](https://github.com/kajover/qbminimal/issues/new/choose).
- **Reviews**: try open pull requests and say what works and what doesn't.
- **Translations**: the easiest place to start, with no programming and no setup, just a GitHub account.

## Translations

Each language is one file in [`src/i18n/locales`](src/i18n/locales), named by its language code, such as `de.json` for German or `pt-BR.json` for Portuguese (Brazil). Every line pairs the English text with its translation:

```json
"Add torrents": "Torrents hinzufügen",
"{count} selected": "{count} ausgewählt",
```

Most translations were made by machine and haven't been checked by native speakers yet, so corrections are very welcome.

### Fix or improve a translation on GitHub

1. Open your language's file. The [language list in the README](README.md#languages) links straight to each one.
2. Click the pencil (**Edit this file**). GitHub makes a copy for you if needed.
3. Change the text on the **right** of the colon. Use your browser's search (Ctrl+F or Cmd+F) to find the English text you saw in the app.
4. Click **Commit changes…**, then **Propose changes**, and open the pull request. Say briefly what you changed and why.

A check runs on every pull request and names any line it can't use. Fix what it lists, or ask in the pull request and someone will help.

Rules for a line:

- **Don't change the English text** on the left. The app looks translations up by it.
- **Keep every `{placeholder}`** exactly as written, like `{count}` or `{name}`. You can move it within the sentence, but don't translate or rename it.
- **Keep the quotes and the comma** at the end of the line. Inside the text, write a double quote as `\"`.
- **Leave product and protocol names as they are**: qBittorrent, qbminimal, RSS, DHT, PeX, uTP, UPnP, SSL, Web UI and similar.
- **Plural forms aren't supported**, so a text with `{count}` has to read right for any number. A form like "Torrents: {count}" usually works.
- **Use the words qBittorrent uses** in your language where they exist, so both apps match.

### Report a wrong translation instead

If you'd rather not edit a file, [open a translation issue](https://github.com/kajover/qbminimal/issues/new?template=translation.yml) with the English text, what the app shows, and what it should say.

### Add a new language

1. Copy any language file in `src/i18n/locales`, name the copy with your language code (`fi.json` for Finnish, for example), and translate the right-hand side.
2. Add the language to `LANGUAGES` in [`src/i18n/index.ts`](src/i18n/index.ts), written in the language itself: `{ code: 'fi', name: 'Suomi' }`.
3. For a language written right to left, also add its code to `RIGHT_TO_LEFT` in the same file.
4. Add a row to the language list in the README.

If that's more than you'd like to do, open an issue offering the language and we'll set up the file for you.

### When the app gains new text

New English text shows in English until a language has it. `npm run i18n:check`, which CI also runs, lists every text a language is missing and every line whose placeholders don't match.

## Code

Pull requests of any size are welcome, from a one-line fix to a new feature. For something large, a short issue or discussion first helps agree on the approach before you spend time on it.

```bash
npm install
npm run demo   # the app on sample data, no qBittorrent needed: open the address it prints, add ?signedin
npm run dev    # the app against your own qBittorrent at localhost:8080 (the proxy in vite.config.ts)
```

Before a pull request, run `npm run check`. It runs the type check, lint, tests, the translation check and a build, one line each, and shows output only for what fails. CI runs the same checks. While a change isn't finished, `npm run check -- --draft` counts new untranslated texts instead of failing on them (see [When the app gains new text](#when-the-app-gains-new-text)).

### Where things are

| Folder | What's in it |
| --- | --- |
| `src/components/<page>` | One folder per page: `torrents`, `search`, `rss`, `logs`, `settings`. Each page's main file is its `…View.tsx`. |
| `src/components` | Parts several pages share: `Layout.tsx` (menu, header, tab bar), `PageHeader.tsx`, `TableColumns.tsx` (resizing, fitting and dragging columns), `FilterSidebarParts.tsx`, `SearchInput.tsx`. |
| `src/components/ui` | Basic components (buttons, dialogs, menus), from shadcn/ui and Radix. |
| `src/hooks` | React hooks. `useApi.ts` has every query and change sent to qBittorrent, built on React Query. |
| `src/lib` | Code without React: the API client (`api.ts`), the demo's sample data (`demoClient.ts`), sorting and filtering, formatting, settings kept in the browser. Most of it has a `.test.ts` beside it. |
| `src/i18n` | `t()` and the translations, one JSON file per language in `locales`. |
| `scripts` | The checks, the release's update torrent, and the test that runs against a real qBittorrent in CI. |

### Things to know

- **Text** goes through `t('English text')`, never written out directly, so it can be translated. Never call `t()` when a module loads: the language can change while the app runs. Use a getter (`get label() { return t('Name') }`) or `perLanguage(() => …)`. A test guards this.
- **Wide and narrow screens**: use the `wide:` and `narrow:` variants (see `src/index.css`) and `WIDE` in `src/lib/pageScroll.ts`, not Tailwind's `md:`, so every part switches layout at the same point.
- **Right to left**: start and end classes (`ps-2`, `text-end`), never left and right, so the page mirrors for Arabic, Hebrew and Persian.
- **Shared parts first**: tables reuse `TableColumns.tsx`, sidebars `FilterSidebarParts.tsx`, long-press `useLongPress`, the bar for selected items `torrents/SelectionBar.tsx`. Extend them rather than copying them.
- **The demo** (`npm run demo`) uses `src/lib/demoClient.ts` in place of qBittorrent. A feature that calls a new API method needs it there too, so the demo and the screenshots keep working.
- **Comments** say why, in plain, short sentences.
