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
npm run dev
```

Before a pull request, run `npm run lint`, `npm test`, `npm run typecheck` and `npm run i18n:check`. CI runs them too. Use start and end classes (`ps-2`, `text-end`) rather than left and right ones, so the page mirrors for right-to-left languages.
