import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * A screenshot of the real app in a browser window (address bar, three
 * dots). The picture fills the width and is cut at the bottom by `aspect`,
 * so a tall screenshot shows its top.
 */
export function BrowserFrame({
  url,
  src,
  alt,
  width,
  height,
  aspect,
  priority,
  className,
}: {
  url?: string
  src: string
  alt: string
  width: number
  height: number
  /** Width / height of the visible area, e.g. "1040/640". */
  aspect: string
  priority?: boolean
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-box border border-line bg-panel', className)}>
      {url && (
        <div className="flex h-6 items-center gap-3 border-b border-line/70 bg-plain-soft/60 px-2.5 sm:h-9 sm:px-3.5">
          <span aria-hidden className="hidden gap-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="truncate font-mono text-[10px] text-muted sm:text-[11.5px]">{url}</span>
        </div>
      )}
      <div className="relative overflow-hidden bg-page" style={{ aspectRatio: aspect }}>
        <Image src={src} alt={alt} width={width} height={height} priority={priority} className="block h-auto w-full" />
      </div>
    </div>
  )
}
