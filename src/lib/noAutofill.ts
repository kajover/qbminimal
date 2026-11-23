// Settings are qBittorrent's, not the browser's: a username beside a password (the email login,
// the Web UI's) made Safari and password managers fill in a saved login by themselves. Every
// settings field says it takes no autofill (password fields, a new password, so no saved one goes
// in), and the common password managers are asked to leave them alone.
export const NO_AUTOFILL = { autoComplete: 'off', 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' } as const
