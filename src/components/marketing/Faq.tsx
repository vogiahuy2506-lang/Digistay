'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { revealDelay, softText } from './styles'

/**
 * Questions and answers, the first one open. An answer slides open and shut
 * (its row grows from 0fr to 1fr) and the "+" turns into "−"; a closed
 * answer is `inert`, out of the tab order and the accessibility tree.
 * `reveal`: the rows rise into view one after another (RevealObserver).
 */
export function Faq({ items, reveal, className }: { items: { q: string; a: string }[]; reveal?: boolean; className?: string }) {
  const id = React.useId()
  const [open, setOpen] = React.useState<ReadonlySet<number>>(() => new Set([0]))
  const toggle = (i: number) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (!next.delete(i)) next.add(i)
      return next
    })

  return (
    <div className={cn('border-t border-line', className)}>
      {items.map((item, i) => {
        const isOpen = open.has(i)
        return (
          <div key={item.q} data-reveal={reveal || undefined} style={reveal ? revealDelay(i * 60) : undefined} className="border-b border-line">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${i}`}
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-6 py-[18px] text-left text-[15.5px] font-medium text-fg lg:py-[22px] lg:text-[17px]"
              >
                {item.q}
                <span aria-hidden className="relative flex h-7 w-7 flex-none items-center justify-center rounded-ctl border border-line">
                  <span className="absolute h-px w-3 bg-current" />
                  <span
                    className={cn(
                      'absolute h-3 w-px bg-current transition-transform duration-250 ease-ds motion-reduce:transition-none',
                      isOpen && 'rotate-90',
                    )}
                  />
                </span>
              </button>
            </h3>
            <div
              id={`${id}-${i}`}
              role="region"
              aria-label={item.q}
              inert={!isOpen}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-[400ms] ease-ds motion-reduce:transition-none',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <p className={cn('pb-[18px] text-[14.5px] leading-[1.65] lg:pb-6 lg:pr-16 lg:text-[15px] lg:leading-[1.7]', softText)}>{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
