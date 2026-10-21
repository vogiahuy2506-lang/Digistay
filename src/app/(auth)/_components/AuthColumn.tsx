import { frame } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'

/** The centred column of an account page under the marketing header (440 px; wider for sign-up, invitations). */
export function AuthColumn({ width = 440, children }: { width?: 440 | 480 | 560 | 640; children: React.ReactNode }) {
  const max = { 440: 'max-w-[440px]', 480: 'max-w-[480px]', 560: 'max-w-[560px]', 640: 'max-w-[640px]' }[width]
  return (
    <main className={cn(frame, 'flex justify-center pb-6 pt-10 lg:pt-16')}>
      <div className={cn('w-full', max)}>{children}</div>
    </main>
  )
}
