'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

/** A data: URL (the QR the server rendered) as a PNG blob, synchronously: the share sheet needs the click's user gesture. */
function pngOf(dataUrl: string): Blob {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}

/** iPhone and iPad (iPadOS reports itself as a Mac with touch). */
function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * "Lưu ảnh QR": a guest booking on their phone cannot scan their own
 * screen, so they save the QR and pick it in their banking app.
 *
 * - iPhone / iPad: the share sheet with the PNG ("Lưu hình ảnh"), where
 *   Safari has it (iOS 15+). Safari does not save downloaded data: URLs to
 *   Photos, and in-app browsers (Zalo, Facebook) have no share sheet: there
 *   the QR opens large with "nhấn giữ để lưu ảnh", which works everywhere.
 * - Elsewhere (Android, computers): a normal PNG download.
 */
export function SaveQrButton({ image, fileName, className }: { image: string; fileName: string; className?: string }) {
  const t = useTranslations('site.booking.deposit')
  const [preview, setPreview] = React.useState(false)
  const closeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!preview) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [preview])

  const save = async () => {
    const blob = pngOf(image)
    if (isIos()) {
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          return
        } catch (error) {
          // Closed the sheet: nothing to do. Refused (no gesture, a webview quirk): the large QR.
          if ((error as Error).name === 'AbortError') return
        }
      }
      setPreview(true)
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <>
      <button
        type="button"
        onClick={save}
        className={
          className ??
          'flex h-10 w-full max-w-[280px] items-center justify-center gap-2 border border-line bg-panel px-4 text-[13.5px] font-medium text-fg hover:border-ink'
        }
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {t('saveQr')}
      </button>
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('saveQrTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(false)}
        >
          <div className="w-full max-w-[360px] border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the server's data: URL, long-pressed to save */}
            <img src={image} alt={t('saveQrTitle')} className="aspect-square w-full bg-white p-2" />
            <p className="mt-4 text-[14px] leading-[1.55] text-fg">{t('saveQrHint')}</p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setPreview(false)}
              className="mt-4 flex h-11 w-full items-center justify-center bg-ink text-[14px] font-medium text-on-ink"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
