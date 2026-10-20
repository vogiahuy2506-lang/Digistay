'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// Shared by Input, Textarea and Select. Phones get 16 px text so iOS does not
// zoom in on focus; from `sm` up the dashboard's 13 px applies.
const fieldBase =
  'w-full rounded-ctl border bg-panel px-3 text-fg text-base sm:text-small placeholder:text-muted ' +
  'transition-[border-color,box-shadow] duration-160 ease-ds focus:outline-none focus-visible:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-plain-soft disabled:text-muted motion-reduce:transition-none'

function fieldState(error?: string) {
  return error
    ? 'border-err bg-err-soft/40 focus-visible:border-err focus-visible:ring-err/20'
    : 'border-line hover:border-muted focus-visible:border-acc focus-visible:ring-acc/20'
}

interface FieldChromeProps {
  inputId: string
  label?: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}

function FieldChrome({ inputId, label, required, hint, error, children }: FieldChromeProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-small font-medium text-fg mb-1.5">
          {label}
          {required && (
            <span className="text-err ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
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

function describedBy(inputId: string, hint?: string, error?: string, own?: string) {
  const ids = [own, error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, iconPosition = 'left', id, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error}>
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
            aria-describedby={describedBy(inputId, hint, error, ownDescribedBy)}
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
  label?: string
  error?: string
  hint?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, hint, error, ownDescribedBy)}
          className={cn(fieldBase, 'py-2 min-h-[100px] resize-y', fieldState(error), className)}
          {...props}
        />
      </FieldChrome>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options?: { value: string; label: string }[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, children, 'aria-describedby': ownDescribedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <FieldChrome inputId={inputId} label={label} required={props.required} hint={hint} error={error}>
        {/* Native select: the arrow and the option list follow color-scheme in the dark theme. */}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, hint, error, ownDescribedBy)}
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
