// @vitest-environment happy-dom
/**
 * Keyboard and focus behavior of SidePanel, Modal and Dropdown, rendered into a
 * real (happy-dom) document.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SidePanel, SidePanelBody, SidePanelHeader } from './side-panel'
import { Modal, ModalHeader } from './modal'
import { Dropdown, DropdownItem } from './dropdown'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function setPhone(isPhone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isPhone && query.includes('max-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function render(ui: React.ReactElement) {
  act(() => root.render(ui))
}

function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
}

beforeEach(() => {
  setPhone(false)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.style.overflow = ''
  vi.unstubAllGlobals()
})

function PanelHarness({ withModal = false, withMenu = false }: { withModal?: boolean; withMenu?: boolean }) {
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [modalOpen, setModalOpen] = React.useState(withModal)
  return (
    <div>
      <button id='open-panel' onClick={() => setPanelOpen(true)}>
        Mở
      </button>
      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} label="Đặt phòng MB-1">
        <SidePanelHeader>MB-1</SidePanelHeader>
        <SidePanelBody>
          <button id="inside">Nhận phòng</button>
          {withMenu && (
            <Dropdown trigger={<button id="menu-trigger">…</button>}>
              <DropdownItem>Hủy đặt phòng</DropdownItem>
            </Dropdown>
          )}
        </SidePanelBody>
        <Modal isOpen={panelOpen && modalOpen} onClose={() => setModalOpen(false)}>
          <ModalHeader>Hủy đặt phòng?</ModalHeader>
          <button id="modal-first">Không</button>
          <button id="modal-last">Hủy</button>
        </Modal>
      </SidePanel>
    </div>
  )
}

function openPanel() {
  const opener = document.getElementById('open-panel') as HTMLButtonElement
  opener.focus()
  act(() => opener.click())
}

describe('SidePanel', () => {
  it('moves focus into the panel and gives it back to the opener on Escape', () => {
    render(<PanelHarness />)
    openPanel()
    const panel = document.querySelector('[role="dialog"]')!
    expect(panel.getAttribute('aria-label')).toBe('Đặt phòng MB-1')
    expect(panel.contains(document.activeElement)).toBe(true)

    press('Escape')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement?.id).toBe('open-panel')
  })

  it('stays non-modal on wide screens: no aria-modal, page still scrolls', () => {
    render(<PanelHarness />)
    openPanel()
    expect(document.querySelector('[role="dialog"]')!.hasAttribute('aria-modal')).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('becomes a modal on phones: aria-modal and scroll lock, released on close', () => {
    setPhone(true)
    render(<PanelHarness />)
    openPanel()
    expect(document.querySelector('[role="dialog"]')!.getAttribute('aria-modal')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    press('Escape')
    expect(document.body.style.overflow).toBe('')
  })

  it('closes from its close button', () => {
    render(<PanelHarness />)
    openPanel()
    act(() => (document.querySelector('[aria-label="Đóng"]') as HTMLButtonElement).click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('stacked dialogs', () => {
  it('Escape closes the confirm modal first, then the panel', () => {
    render(<PanelHarness withModal />)
    openPanel()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2)

    press('Escape')
    const left = document.querySelectorAll('[role="dialog"]')
    expect(left).toHaveLength(1)
    expect(left[0].getAttribute('aria-label')).toBe('Đặt phòng MB-1')

    press('Escape')
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0)
  })

  it('Escape in an open menu inside the panel closes only the menu', () => {
    render(<PanelHarness withMenu />)
    openPanel()
    const trigger = document.getElementById('menu-trigger') as HTMLButtonElement
    trigger.focus()
    act(() => trigger.click())
    expect(document.querySelector('[role="menu"]')).not.toBeNull()

    press('Escape')
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('Modal', () => {
  it('is named by its header and keeps Tab inside', () => {
    render(<PanelHarness withModal />)
    openPanel()
    const modal = document.querySelector('[aria-modal="true"]') as HTMLElement
    const labelId = modal.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)?.textContent).toBe('Hủy đặt phòng?')

    // happy-dom has no layout, so give every button a box for the visibility filter.
    for (const b of Array.from(modal.querySelectorAll('button'))) {
      b.getClientRects = () => [{}] as unknown as DOMRectList
    }
    ;(document.getElementById('modal-last') as HTMLElement).focus()
    press('Tab')
    // The header's close button is not rendered (no onClose), so "Không" comes first.
    expect(document.activeElement?.id).toBe('modal-first')
    press('Tab', { shiftKey: true })
    expect(document.activeElement?.id).toBe('modal-last')
  })
})
