'use client'

import * as React from 'react'
import { setApiErrorDictionary, type ApiErrorDictionary } from '@/lib/i18n/api-errors'

/**
 * Hands the English dictionary of the API's messages to apiError()
 * (src/lib/i18n/api-errors.ts). The root layout passes it on English pages
 * only, so Vietnamese pages don't download it.
 */
export function ApiErrorsProvider({ dictionary, children }: { dictionary?: ApiErrorDictionary; children: React.ReactNode }) {
  // Set while rendering, before any handler can run. Only in the browser: on
  // the server the module is shared by every request.
  if (typeof window !== 'undefined') setApiErrorDictionary(dictionary)
  return <>{children}</>
}
