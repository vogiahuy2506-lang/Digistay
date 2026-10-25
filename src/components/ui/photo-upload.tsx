'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import { Button } from './button'
import { toast } from './toast'
import { UploadClientError, uploadPhoto, type UploadTarget } from '@/lib/media/upload-client'

/** The words for what went wrong in an upload (dash.common.upload), for callers with their own file field. */
export function useUploadProblemText() {
  const t = useTranslations('dash.common.upload')
  return (error: unknown) =>
    error instanceof UploadClientError ? (error.problem === 'server' ? error.message : t(error.problem)) : t('failed')
}

/**
 * "Tải ảnh lên": pick photos from the device, store each (src/lib/media/upload-client.ts)
 * and hand its URL to `onUploaded` — which saves it where it belongs (a
 * property or room photo, a dish, the logo). Several files go one after the
 * other; a failed one is reported and the rest go on.
 */
export function PhotoUploadButton({
  target,
  onUploaded,
  multiple = false,
  maxSide = 2400,
  label,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
}: {
  target: UploadTarget
  onUploaded: (url: string) => void | Promise<void>
  multiple?: boolean
  maxSide?: number
  label?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}) {
  const t = useTranslations('dash.common.upload')
  const problemText = useUploadProblemText()
  const input = React.useRef<HTMLInputElement>(null)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)

  const upload = async (files: File[]) => {
    setProgress({ done: 0, total: files.length })
    try {
      for (const [i, file] of files.entries()) {
        try {
          await onUploaded(await uploadPhoto(file, target, maxSide))
        } catch (error) {
          toast.error(files.length > 1 ? `${file.name}: ${problemText(error)}` : problemText(error))
        }
        setProgress({ done: i + 1, total: files.length })
      }
    } finally {
      setProgress(null)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void upload(files)
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || !!progress}
        isLoading={!!progress}
        onClick={() => input.current?.click()}
      >
        {!progress && <Upload className="w-4 h-4 mr-2" aria-hidden="true" />}
        {progress
          ? progress.total > 1
            ? t('uploadingMany', { done: progress.done, total: progress.total })
            : t('uploading')
          : label ?? t(multiple ? 'buttonMany' : 'button')}
      </Button>
    </>
  )
}
