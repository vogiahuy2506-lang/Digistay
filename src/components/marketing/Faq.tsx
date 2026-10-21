import { cn } from '@/lib/utils'
import { softText } from './styles'

/**
 * Questions and answers as <details>: no script needed, the first one open.
 * "+" turns into "−" when a question is open.
 */
export function Faq({ items, className }: { items: { q: string; a: string }[]; className?: string }) {
  return (
    <div className={cn('border-t border-line', className)}>
      {items.map((item, i) => (
        <details key={item.q} open={i === 0} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[18px] text-[15.5px] font-medium text-fg lg:py-[22px] lg:text-[17px] [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden
              className="flex h-7 w-7 flex-none items-center justify-center rounded-ctl border border-line text-[16px] font-normal"
            >
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">−</span>
            </span>
          </summary>
          <p className={cn('pb-[18px] text-[14.5px] leading-[1.65] lg:pb-6 lg:pr-16 lg:text-[15px] lg:leading-[1.7]', softText)}>{item.a}</p>
        </details>
      ))}
    </div>
  )
}
