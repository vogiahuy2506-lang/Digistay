// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CLIENT_BUILDS, MARKER, patchReactDomClient, reconcilerVersion } from './patch-react-replay.mjs'

const require = createRequire(import.meta.url)
const compiled = path.join(path.dirname(require.resolve('next/package.json')), 'dist/compiled')

// The bundled builds require('next/dist/compiled/react' | 'react-dom' |
// 'scheduler'), whose index picks a build by NODE_ENV ("test" here): point
// each build at its own flavour instead, so the production one is tested too.
const resolveFilename = Module._resolveFilename
beforeAll(() => {
  Module._resolveFilename = function (request, parent, ...rest) {
    const from = parent?.filename ?? ''
    const pkg = request.match(/^next\/dist\/compiled\/(react|react-dom|scheduler)$/)?.[1]
    if (pkg && from.startsWith(compiled)) {
      const flavour = from.includes('.production.') ? 'production' : 'development'
      return path.join(compiled, pkg, 'cjs', `${pkg}.${flavour}.js`)
    }
    return resolveFilename.call(this, request, parent, ...rest)
  }
})
afterAll(() => {
  Module._resolveFilename = resolveFilename
})

const load = (flavour) => ({
  React: require(path.join(compiled, `react/cjs/react.${flavour}.js`)),
  client: require(path.join(compiled, `react-dom/cjs/react-dom-client.${flavour}.js`)),
  server: require(path.join(compiled, `react-dom/cjs/react-dom-server-legacy.node.${flavour}.js`)),
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))
async function until(check, what) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await tick()
  }
  throw new Error(`timed out waiting for ${what}`)
}

/**
 * A lazy node like the ones the RSC client hands React for a part of the page
 * (or a client component's module) that has not arrived yet: a thenable with a
 * status, which is what sends React down its replay path. It arrives right
 * after React first asks for it, while React has paused (the bug needs that:
 * a later arrival restarts hydration from the root, which works).
 */
function pendingLazy(value) {
  const listeners = []
  const thenable = {
    status: 'pending',
    then: (resolve, reject) => listeners.push([resolve, reject]),
  }
  const lazy = {
    $$typeof: Symbol.for('react.lazy'),
    _payload: thenable,
    _init: (t) => {
      if (t.status === 'fulfilled') return t.value
      if (!lazy.initialized) queueMicrotask(resolve)
      lazy.initialized = true
      throw t
    },
  }
  function resolve() {
    thenable.status = 'fulfilled'
    thenable.value = value
    for (const [onFulfilled] of listeners) onFulfilled(value)
  }
  return lazy
}

function hydrate({ React, client }, container, element) {
  const errors = []
  // Time-sliced, as Next hydrates: React pauses when the lazy node suspends.
  React.startTransition(() => {
    client.hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error.message) })
  })
  return errors
}

describe.each(['production', 'development'])('the bundled react-dom client (%s)', (flavour) => {
  it('hydrates an element whose child arrives while hydration is paused (react#35494, error #418)', async () => {
    const react = load(flavour)
    const { createElement: h } = react.React
    const lazy = pendingLazy('value')
    const container = document.createElement('div')
    container.innerHTML = '<label>value</label>'
    document.body.append(container)

    const errors = hydrate(react, container, h('label', null, lazy))
    await until(() => lazy.initialized, 'React to reach the lazy child')
    const hydrated = () => Object.keys(container.firstChild ?? {}).some((key) => key.startsWith('__reactFiber$'))
    await until(hydrated, 'hydration')
    await tick()

    expect(errors).toEqual([])
    expect(container.innerHTML).toBe('<label>value</label>')
    container.remove()
  })

  it('keeps useId stable for a component whose module arrives while hydration is paused (react#35518)', async () => {
    const react = load(flavour)
    const { createElement: h, useId } = react.React
    const seen = []
    function Field() {
      const id = useId()
      seen.push(id)
      return h('input', { id })
    }
    const server = react.server.renderToString(h('form', null, h('b'), h(Field)))
    const serverId = server.match(/id="([^"]+)"/)[1]
    seen.length = 0 // the server render ran Field too

    // The client component's module is still loading: its type is a lazy reference.
    const lazy = pendingLazy(Field)
    const container = document.createElement('div')
    container.innerHTML = server
    document.body.append(container)
    const errors = hydrate(react, container, h('form', null, h('b'), h(lazy)))
    await until(() => seen.length > 0, 'Field to render')

    expect(seen[0]).toBe(serverId)
    expect(errors).toEqual([])
    container.remove()
  })
})

describe('the installed next', () => {
  it.each(CLIENT_BUILDS)('has %s patched (postinstall)', (build) => {
    const source = readFileSync(path.join(compiled, build), 'utf8')
    const version = reconcilerVersion(source)
    if (version[0] === 19 && version[1] < 3) expect(source).toContain(MARKER)
  })
})

describe('patchReactDomClient', () => {
  const build = (version = '19.2.0-canary-0bdb9206-20250818') => `/**
 * @license React
 */
'use strict';
var hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = !1;
function popToNextHostParent(fiber) {}
function popHydrationState(fiber) {
  return isHydrating;
}
function createWorkInProgress(current, workInProgress) {
  workInProgress.flags = current.flags & 65011712;
}
function resetWorkInProgress(workInProgress) {
  workInProgress.flags &= 65011714;
}
function bubbleProperties(child, subtreeFlags) {
  subtreeFlags |= child.subtreeFlags & 65011712;
}
function replaySuspendedUnitOfWork(next) {
  switch (next.tag) {
    case 5:
      resetHooksOnUnwind(next);
    default:
      unwindInterruptedWork(current, next);
  }
}
var internals = { reconcilerVersion: "${version}" };
`

  it('keeps Forked through a reset and puts the cursor back before a replayed element', () => {
    const { source, status } = patchReactDomClient(build())
    expect(status).toBe('patched')
    expect(source).toContain('flags = current.flags & 66060288;')
    expect(source).toContain('flags &= 66060290;')
    expect(source).toContain('subtreeFlags & 66060288;')
    expect(source).not.toMatch(/6501171[24]/)
    expect(source).toMatch(/resetHooksOnUnwind\(next\);\n\s*popHydrationStateOnInterruptedWork\(next\);\n\s*default:/)
    expect(source).toMatch(/function popHydrationStateOnInterruptedWork\(fiber\) \{[\s\S]*\}\n+function popHydrationState\(fiber\)/)
    expect(source.startsWith(`/**\n * @license React\n */\n${MARKER}\n`)).toBe(true)
    // The patched file still runs.
    expect(() => new Function(source.replace(/resetHooksOnUnwind|unwindInterruptedWork/g, 'void'))).not.toThrow()
  })

  it('leaves a patched file alone', () => {
    const once = patchReactDomClient(build()).source
    expect(patchReactDomClient(once)).toEqual({ source: once, status: 'already-patched' })
  })

  it('does nothing once Next bundles React 19.3 or later, which has both fixes', () => {
    const source = build('19.3.0-canary-1234abcd-20260901')
    expect(patchReactDomClient(source)).toEqual({ source, status: 'not-needed' })
  })

  it('refuses a build whose code changed shape, so the install fails instead of shipping the bugs', () => {
    expect(() => patchReactDomClient(build().replace('resetHooksOnUnwind(next);', 'resetHooks(next);'))).toThrow(/replay of a HostComponent found 0 times/)
    expect(() => patchReactDomClient(build().replace('flags &= 65011714;', 'flags &= 1;'))).toThrow(/65011714/)
    expect(() => patchReactDomClient('var x = 1;')).toThrow(/reconcilerVersion/)
  })
})
