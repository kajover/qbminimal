import { createLucideIcon, type IconNode, type LucideIcon } from 'lucide-react'

// Status icons drawn inside a circle, so every status reads as the same kind of mark. Lucide has
// circled versions of some; the rest are its own drawings, shrunk into a circle here.

type Shape = [tag: 'path', attrs: { d: string }][]

const SERVER_FRAME: Shape = [
  ['path', { d: 'M6 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2' }],
  ['path', { d: 'M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2' }],
  ['path', { d: 'M6 6h.01' }],
  ['path', { d: 'M6 18h.01' }],
]

// Like Lucide's crashed server, with an exclamation mark where the lightning bolt is: a tracker
// that answered with a warning.
const SERVER_ALERT: Shape = [...SERVER_FRAME, ['path', { d: 'M12 5v8' }], ['path', { d: 'M12 18h.01' }]]
export const ServerAlert: LucideIcon = createLucideIcon('server-alert', SERVER_ALERT.map(([tag, attrs], i) => [tag, { ...attrs, key: `s${i}` }]) as IconNode)

const SHAPES = {
  hourglass: [
    ['path', { d: 'M5 22h14' }], ['path', { d: 'M5 2h14' }],
    ['path', { d: 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22' }],
    ['path', { d: 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' }],
  ],
  activity: [['path', { d: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2' }]],
  // The same line as the pulse, flat: inactive.
  flat: [['path', { d: 'M22 12H2' }]],
  listChecks: [
    ['path', { d: 'M13 5h8' }], ['path', { d: 'M13 12h8' }], ['path', { d: 'M13 19h8' }],
    ['path', { d: 'm3 17 2 2 4-4' }], ['path', { d: 'm3 7 2 2 4-4' }],
  ],
  folderInput: [
    ['path', { d: 'M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1' }],
    ['path', { d: 'M2 13h10' }], ['path', { d: 'm9 16 3-3-3-3' }],
  ],
  serverCrash: [...SERVER_FRAME, ['path', { d: 'm13 6-4 6h6l-4 6' }]],
  serverAlert: SERVER_ALERT,
  serverOff: [
    ['path', { d: 'M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5' }], ['path', { d: 'M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z' }],
    ['path', { d: 'M22 17v-1a2 2 0 0 0-2-2h-1' }], ['path', { d: 'M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z' }],
    ['path', { d: 'M6 18h.01' }], ['path', { d: 'm2 2 20 20' }],
  ],
  fileX: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }], ['path', { d: 'm14.5 12.5-5 5' }], ['path', { d: 'm9.5 12.5 5 5' }],
  ],
  hardDrive: [
    ['path', { d: 'M10 16h.01' }], ['path', { d: 'M6 16h.01' }], ['path', { d: 'M21.946 12.013H2.054' }],
    ['path', { d: 'M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }],
  ],
} satisfies Record<string, Shape>

// The drawing at half size in the middle of a circle, its lines thickened to match the circle's.
function circled(name: keyof typeof SHAPES): LucideIcon {
  const inner = SHAPES[name].map(([tag, attrs], i) => [tag, { ...attrs, transform: 'translate(6 6) scale(0.5)', strokeWidth: 3.5, key: `p${i}` }])
  return createLucideIcon(`circle-${name}`, [['circle', { cx: '12', cy: '12', r: '10', key: 'c' }], ...inner] as IconNode)
}

export const CircleHourglass = circled('hourglass')
export const CircleActivity = circled('activity')
export const CircleFlat = circled('flat')
export const CircleListChecks = circled('listChecks')
export const CircleFolderInput = circled('folderInput')
export const CircleServerCrash = circled('serverCrash')
export const CircleServerAlert = circled('serverAlert')
export const CircleServerOff = circled('serverOff')
export const CircleFileX = circled('fileX')
export const CircleHardDrive = circled('hardDrive')
