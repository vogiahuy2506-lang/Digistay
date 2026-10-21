import { cn } from '@/lib/utils'

/** The red square and "Digistay": Digistay's own logo (brand color, never on hotel sites). */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={cn('flex items-center font-semibold text-brand', size === 'md' ? 'gap-2.5 text-[18px]' : 'gap-2 text-[17px]')}>
      <span aria-hidden className={cn('rounded-[3px] bg-brand', size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      Digistay
    </span>
  )
}
