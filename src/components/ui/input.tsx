'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// Shared by Input, Textarea, Select and Combobox. Phones get 16 px text so iOS does not
// zoom in on focus; from `sm` up the dashboard's 13 px applies.
export const fieldBase =
  'w-full rounded-ctl border bg-panel px-3 text-fg text-base sm:text-small placeholder:text-muted ' +
  'transition-[border-color,box-shadow] duration-160 ease-ds focus:outline-none focus-visible:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-plain-soft disabled:text-muted motion-reduce:transition-none'

export function fieldState(error?: string) {
  return error
    ? 'border-err bg-err-soft/40 focus-visible:border-err focus-visible:ring-err/20'
    : 'border-line hover:border-muted focus-visible:border-acc focus-visible:ring-acc/20'
}

export function FieldTooltip({ content }: { content: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center text-muted hover:text-fg focus-within:text-fg"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Giải thích chi tiết"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-fg/10 hover:bg-fg/20 text-muted hover:text-fg text-[11px] font-bold font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-acc"
      >
        i
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 sm:w-72 p-2.5 rounded-lg bg-panel border border-line shadow-lg text-xs leading-relaxed text-fg pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-line" />
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-panel" />
        </div>
      )}
    </div>
  )
}

export interface FieldChromeProps {
  inputId: string
  label?: React.ReactNode
  required?: boolean
  hint?: React.ReactNode
  error?: string
  tooltip?: React.ReactNode
  children: React.ReactNode
}

export function FieldChrome({ inputId, label, required, hint, error, tooltip, children }: FieldChromeProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <label htmlFor={inputId} className="block text-small font-medium text-fg">
            {label}
            {required && (
              <span className="text-err ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {tooltip && <FieldTooltip content={tooltip} />}
        </div>
      )}
      {children}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-small text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-small text-err">
          {error}
        </p>
      )}
    </div>
  )
}

export function describedBy(inputId: string, hint?: string, error?: string, own?: string) {
  const ids = [own, error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string
  hint?: React.ReactNode
  tooltip?: React.ReactNode
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, tooltip, icon, iconPosition = 'left', id, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error} tooltip={tooltip}>
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, typeof hint === 'string' ? hint : undefined, error, ownDescribedBy)}
            className={cn(
              fieldBase,
              'h-11 sm:h-10',
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              fieldState(error),
              className
            )}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted">
              {icon}
            </div>
          )}
        </div>
      </FieldChrome>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode
  error?: string
  hint?: React.ReactNode
  tooltip?: React.ReactNode
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, tooltip, id, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error} tooltip={tooltip}>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, typeof hint === 'string' ? hint : undefined, error, ownDescribedBy)}
          className={cn(fieldBase, 'py-2 min-h-[100px] resize-y', fieldState(error), className)}
          {...props}
        />
      </FieldChrome>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode
  error?: string
  hint?: React.ReactNode
  tooltip?: React.ReactNode
  options?: { value: string; label: string }[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, tooltip, options, placeholder, id, children, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error} tooltip={tooltip}>
        {/* Native select: the arrow and the option list follow color-scheme in the dark theme. */}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, typeof hint === 'string' ? hint : undefined, error, ownDescribedBy)}
          className={cn(fieldBase, 'h-11 sm:h-10', fieldState(error), className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options && options.length > 0
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
      </FieldChrome>
    )
  }
)

Select.displayName = 'Select'
