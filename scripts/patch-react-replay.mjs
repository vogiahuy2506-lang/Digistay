#!/usr/bin/env node
/**
 * Backports two React hydration fixes into the React that Next 15.5 bundles
 * (node_modules/next/dist/compiled/react-dom*, "19.2.0-canary-0bdb9206").
 * Run by `postinstall` and `prebuild`; safe to run twice.
 *
 * Both bugs hit when hydration meets a client component (or a streamed part
 * of the page) whose JS chunk is still loading, and the chunk arrives while
 * React pauses: React then "replays" that one fiber, and
 *   - react#35494: a replayed HTML element tries to claim its own first child
 *     as itself, so hydration fails on HTML that matches (React error #418,
 *     seen now and then on /reports and the hotel site; React throws the
 *     server HTML away and renders on the client, briefly showing both);
 *   - react#35518: the replay drops the fiber's `Forked` flag, so every
 *     useId below it differs from the server's (ids of labels, tabs...).
 * Both are fixed in React 19.3.0, which no Next 15 release bundles (15.5.28
 * is the last). When Next bundles React >= 19.3 this script does nothing;
 * if the bundled code ever changes shape, it fails so the install fails and
 * someone re-checks instead of shipping the bugs again.
 *
 * Pure functions are exported for tests; the CLI patches node_modules.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MARKER = '/* digistay: react#35494 + react#35518 backported (scripts/patch-react-replay.mjs) */'

/** The client builds Next can load (stable and experimental; dev, prod and profiling). */
export const CLIENT_BUILDS = ['react-dom', 'react-dom-experimental'].flatMap((pkg) =>
  [
    'react-dom-client.production.js',
    'react-dom-client.development.js',
    'react-dom-profiling.profiling.js',
    'react-dom-profiling.development.js',
  ].map((file) => `${pkg}/cjs/${file}`)
)

// Fiber flags: StaticMask, and StaticMask | Placement (resetWorkInProgress).
// react#35518 adds Forked (1 << 20) to StaticMask so a reset keeps it.
const FORKED = 1 << 20
const STATIC_MASK = 65011712
const STATIC_MASK_AND_PLACEMENT = 65011714

// react#35494's popHydrationStateOnInterruptedWork: put the cursor back on the
// element's own DOM node before the element is begun again.
const RESTORE_CURSOR = `function popHydrationStateOnInterruptedWork(fiber) {
  if (fiber !== hydrationParentFiber) return;
  if (!isHydrating) {
    popToNextHostParent(fiber);
    isHydrating = !0;
    return;
  }
  popToNextHostParent(fiber);
  5 === fiber.tag && null != fiber.stateNode && (nextHydratableInstance = fiber.stateNode);
}
`

/** "19.2.0-canary-0bdb9206-20250818" → [19, 2, 0] */
export function reconcilerVersion(source) {
  const match = source.match(/reconcilerVersion:\s*"(\d+)\.(\d+)\.(\d+)[^"]*"/)
  return match ? match.slice(1, 4).map(Number) : null
}

const hasUpstreamFix = ([major, minor]) => major > 19 || (major === 19 && minor >= 3)

/** Counts whole-number occurrences of n in source. */
const count = (source, n) => source.match(new RegExp(`\\b${n}\\b`, 'g'))?.length ?? 0

/**
 * Patches one react-dom client build. Returns { source, status } where status
 * is 'patched', 'already-patched' or 'not-needed'; throws when the code does
 * not look like the build this was written for.
 */
export function patchReactDomClient(source) {
  if (source.includes(MARKER)) return { source, status: 'already-patched' }
  const version = reconcilerVersion(source)
  if (!version) throw new Error('no reconcilerVersion found: not a react-dom client build')
  if (hasUpstreamFix(version)) return { source, status: 'not-needed' }

  const expect = (ok, what) => {
    if (!ok) throw new Error(`unexpected react-dom ${version.join('.')} build: ${what}`)
  }
  for (const name of ['function popToNextHostParent(fiber)', 'hydrationParentFiber', 'nextHydratableInstance', 'isHydrating']) {
    expect(source.includes(name), `missing ${name}`)
  }
  expect(count(source, STATIC_MASK) >= 2, `StaticMask ${STATIC_MASK} not found`)
  expect(count(source, STATIC_MASK_AND_PLACEMENT) === 1, `resetWorkInProgress mask ${STATIC_MASK_AND_PLACEMENT} not found once`)
  expect(/flags = current\.flags & 65011712;/.test(source), 'createWorkInProgress mask not found')
  expect(/flags &= 65011714;/.test(source), 'resetWorkInProgress mask not found')
  expect(count(source, STATIC_MASK | FORKED) === 0, 'patched mask already present without the marker')

  const replay = /case 5:\s*resetHooksOnUnwind\((\w+)\);/g
  const replays = [...source.matchAll(replay)]
  expect(replays.length === 1, `replay of a HostComponent found ${replays.length} times`)
  const popState = /\n([ \t]*)function popHydrationState\(fiber\) \{/
  expect(popState.test(source), 'popHydrationState not found')

  let out = source
    .replace(new RegExp(`\\b${STATIC_MASK}\\b`, 'g'), String(STATIC_MASK | FORKED))
    .replace(new RegExp(`\\b${STATIC_MASK_AND_PLACEMENT}\\b`, 'g'), String(STATIC_MASK_AND_PLACEMENT | FORKED))
    .replace(replay, (whole, fiber) => `${whole}\n      popHydrationStateOnInterruptedWork(${fiber});`)
    .replace(popState, (whole, indent) => `\n${indent}${RESTORE_CURSOR.replace(/\n(?=.)/g, `\n${indent}`)}${whole}`)
  // After the license comment, so tools that look for it still find it first.
  const header = out.match(/^\/\*\*[\s\S]*?\*\/\n/)
  out = header ? header[0] + MARKER + '\n' + out.slice(header[0].length) : MARKER + '\n' + out
  return { source: out, status: 'patched' }
}

function main() {
  const require = createRequire(import.meta.url)
  let nextDir
  try {
    nextDir = path.dirname(require.resolve('next/package.json'))
  } catch {
    console.log('patch-react-replay: next is not installed, nothing to patch')
    return
  }
  const summary = {}
  for (const build of CLIENT_BUILDS) {
    const file = path.join(nextDir, 'dist/compiled', build)
    if (!existsSync(file)) continue
    const { source, status } = patchReactDomClient(readFileSync(file, 'utf8'))
    if (status === 'patched') writeFileSync(file, source)
    ;(summary[status] ??= []).push(build)
  }
  const files = Object.values(summary).flat().length
  if (!files) throw new Error(`no react-dom client build found under ${nextDir}/dist/compiled`)
  for (const [status, builds] of Object.entries(summary)) console.log(`patch-react-replay: ${status}: ${builds.join(', ')}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`patch-react-replay: ${error.message}`)
    console.error('The React bundled by next changed: check whether it still needs react#35494 and react#35518 (see this script).')
    process.exit(1)
  }
}
