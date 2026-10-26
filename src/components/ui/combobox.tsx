'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { foldVietnamese } from '@/lib/utils/fold'
import { FieldChrome, describedBy, fieldBase, fieldState } from './input'

export interface ComboboxOption {
  value: string
  label: string
  /** Shown muted after the label, e.g. "Thành phố". */
  hint?: string
  /** Other words that find the option: a full or English name. */
  keywords?: string
}

/** The word of `label` at which `q` starts as a phrase (0: the label starts with it); Infinity when none does. */
function phraseWord(label: string, q: string): number {
  const words = label.split(' ')
  for (let i = 0; i < words.length; i++) {
    if (words.slice(i).join(' ').startsWith(q)) return i
  }
  return Infinity
}

/**
 * The options the typed text finds: every word of it, ignoring tone marks
 * and case ("ba dinh" finds "Phường Ba Đình"). Best first: the text starting
 * the label, then its second word ("dinh": "Phường Định Công" before
 * "Phường Ba Đình"), and so on, then the rest; the given order within each.
 */
export function matchOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = foldVietnamese(query)
  if (!q) return options
  const words = q.split(' ')
  const found: { option: ComboboxOption; rank: number; index: number }[] = []
  options.forEach((option, index) => {
    const label = foldVietnamese(option.label)
    const all = option.keywords ? `${label} ${foldVietnamese(option.keywords)}` : label
    if (!words.every((w) => all.includes(w))) return
    found.push({ option, rank: phraseWord(label, q), index })
  })
  return found.sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank)).map((f) => f.option)
}

interface ComboboxProps {
  label: string
  options: ComboboxOption[]
  /** The chosen option's value; "" for none. */
  value: string
  onChange: (value: string) => void
  /** Shown for a value not (yet) among the options: a saved name while its list loads. */
  valueLabel?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
  error?: string
  /** When the typed text finds nothing. */
  noMatchText: string
  /** Read out as the list changes: how many options there are. */
  countText: (count: number) => string
  /** The arrow button's name, e.g. "Mở danh sách". */
  toggleLabel: string
  /** The × that clears an optional choice; none when omitted or required. */
  clearLabel?: string
  id?: string
}

/**
 * A text box that filters a list, for lists too long for a <select>: the
 * 34 provinces, a province's 100+ wards (WAI-ARIA combobox with a listbox).
 * Only an option of the list can be chosen; leaving the box puts the chosen
 * one back. Keys: ↓/↑ open and move, Enter chooses (never submits the form
 * while the list is open), Esc closes the list and nothing else (an
 * enclosing Modal stays open, see dialog-behavior.ts). The list opens in
 * place, not in a portal, so it follows the nearest data-theme.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  valueLabel,
  placeholder,
  required,
  disabled,
  hint,
  error,
  noMatchText,
  countText,
  toggleLabel,
  clearLabel,
  id,
}: ComboboxProps) {
  const generatedId = React.useId()
  const inputId = id || generatedId
  const listId = `${inputId}-list`
  const optionId = (index: number) => `${inputId}-option-${index}`
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  // null: not typing, the box shows the chosen option.
  const [query, setQuery] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)

  const selected = options.find((o) => o.value === value)
  const shown = selected?.label ?? (value ? valueLabel ?? '' : '')
  const matches = React.useMemo(() => matchOptions(options, query ?? ''), [options, query])
  const activeIndex = open && matches.length > 0 ? Math.min(active, matches.length - 1) : -1

  const openList = () => {
    if (disabled) return
    setOpen(true)
    setActive(Math.max(0, matches.findIndex((o) => o.value === value)))
  }
  const close = () => {
    setOpen(false)
    setQuery(null)
  }
  const choose = (option: ComboboxOption) => {
    onChange(option.value)
    close()
  }

  // Keep the active option in view, scrolling the list only (not the page or a modal).
  React.useEffect(() => {
    const list = listRef.current
    const item = activeIndex >= 0 ? (list?.children[activeIndex] as HTMLElement | undefined) : undefined
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [activeIndex])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else setActive(Math.max(0, Math.min(matches.length - 1, activeIndex + (e.key === 'ArrowDown' ? 1 : -1))))
        break
      case 'Enter':
        if (open) {
          e.preventDefault()
          if (activeIndex >= 0) choose(matches[activeIndex])
        }
        break
      case 'Escape':
        if (open || query !== null) {
          e.preventDefault()
          close()
        }
        break
    }
  }

  const clearable = Boolean(clearLabel && !required && value && !disabled)

  return (
    <FieldChrome inputId={inputId} label={label} required={required} hint={hint} error={error}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, hint, error)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={query ?? shown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => (open ? undefined : openList())}
          onKeyDown={onKeyDown}
          onBlur={close}
          className={cn(fieldBase, 'h-11 sm:h-10', clearable ? 'pr-16' : 'pr-9', fieldState(error))}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
          {clearable && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={clearLabel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('')
                close()
              }}
              className="flex h-8 w-7 items-center justify-center rounded-ctl text-muted hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={toggleLabel}
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (open) return close()
              inputRef.current?.focus()
              openList()
            }}
            className="flex h-8 w-7 items-center justify-center rounded-ctl text-muted hover:text-fg disabled:opacity-50"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>
        {/* Pressing in the list must not take the focus from the box (that would close it). */}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open || matches.length === 0}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-box border border-line bg-raised py-1 text-fg shadow-lift"
        >
          {open &&
            matches.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                onClick={() => choose(option)}
                onMouseMove={() => index !== activeIndex && setActive(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2.5 text-base sm:py-1.5 sm:text-small',
                  index === activeIndex && 'bg-plain-soft'
                )}
              >
                <Check className={cn('h-4 w-4 shrink-0 text-acc', option.value !== value && 'invisible')} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="shrink-0 text-small text-muted">{option.hint}</span>}
              </li>
            ))}
        </ul>
        {open && matches.length === 0 && (
          <p className="absolute left-0 right-0 z-30 mt-1 rounded-box border border-line bg-raised px-3 py-2.5 text-small text-muted shadow-lift">
            {noMatchText}
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {open ? countText(matches.length) : ''}
        </p>
      </div>
    </FieldChrome>
  )
}
