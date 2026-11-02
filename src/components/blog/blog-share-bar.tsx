'use client'

import * as React from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

interface BlogShareBarProps {
  url: string
  title: string
  labels: {
    share: string
    copyLink: string
    linkCopied: string
    shareFb: string
    shareZalo: string
  }
}

export function BlogShareBar({ url, title, labels }: BlogShareBarProps) {
  const [copied, setCopied] = React.useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback if clipboard API is restricted
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wider text-muted mr-1">{labels.share}</span>

      {/* Copy link button */}
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-panel hover:bg-fg/5 px-2.5 h-8 text-xs font-medium text-fg transition-colors"
        title={labels.copyLink}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-ok" />
            <span className="text-ok">{labels.linkCopied}</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-muted" />
            <span>{labels.copyLink}</span>
          </>
        )}
      </button>

      {/* Facebook */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center w-8 h-8 rounded-ctl border border-line bg-panel hover:bg-fg/5 text-fg text-xs font-medium transition-colors"
        title={labels.shareFb}
      >
        FB
      </a>

      {/* Zalo */}
      <a
        href={`https://zalo.me/share?url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center px-2 h-8 rounded-ctl border border-line bg-panel hover:bg-fg/5 text-fg text-xs font-medium transition-colors"
        title={labels.shareZalo}
      >
        Zalo
      </a>
    </div>
  )
}

