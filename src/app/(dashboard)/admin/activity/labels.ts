import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

/**
 * The activity log's words (messages/dash/<locale>/adminActivity.json): the
 * generic actions as a verb on any entity ("Xoá · Đặt phòng"), the specific
 * ones with their own label, unknown ones as their code. labels.test.ts
 * keeps these lists and the messages' keys the same.
 */
export const VERBS = ['CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'RESTORE', 'PURGE', 'PUBLISH'] as const
export const ACTIONS = [
  'PAYOS_PAID',
  'PAYOS_AMOUNT_MISMATCH',
  'CONFIRM_PAYMENT',
  'TRANSFER_CLAIMED',
  'ROOM_ASSIGNED',
  'NO_SHOW',
  'EXTEND',
  'SEND_EMAIL',
  'CREATE_REPLACEMENT',
  'CREATE_ADJUSTMENT',
  'INVOICE_REPLACED',
  'INVOICE_ADJUSTED',
  'EINVOICE_CQT_REFUSED',
  'EINVOICE_CONNECTED',
  'EINVOICE_DISCONNECTED',
  'EINVOICE_OPTIONS',
  'PAYOS_CONNECTED',
  'PAYOS_DISCONNECTED',
  'DEPOSIT_MODE_CHANGED',
  'VERIFY_DOMAIN',
  'SSL_REQUEST',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_DISABLED',
  'TWO_FACTOR_RECOVERY_CODE_USED',
  'TWO_FACTOR_RECOVERY_CODES_REGENERATED',
  'TWO_FACTOR_RESET_BY_OPERATOR',
  'MEMBER_INVITED',
  'MEMBER_UPDATED',
  'MEMBER_LOCKED',
  'MEMBER_UNLOCKED',
  'MEMBER_REMOVED',
  'MEMBER_LEFT',
  'INVITE_RESENT',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
  'PLAN_PAID',
  'PLAN_AMOUNT_MISMATCH',
  'PLAN_ORDER_CANCELLED',
  'PLAN_ORDER_REVIEWED',
  'PLAN_SET_BY_OPERATOR',
  'USER_LOCKED',
  'USER_UNLOCKED',
] as const
export const ENTITIES = [
  'BOOKING',
  'PAYMENT',
  'INVOICE',
  'PROPERTY',
  'ROOM_TYPE',
  'ROOM',
  'PRICING',
  'MAINTENANCE_LOCK',
  'IMAGE',
  'WEBSITE',
  'WEBSITE_SETTINGS',
  'WORKSPACE',
  'MEMBER',
  'INVITATION',
  'USER',
  'SUBSCRIPTION',
  'SUBSCRIPTION_PAYMENT',
] as const

type Verb = (typeof VERBS)[number]
type Action = (typeof ACTIONS)[number]
type Entity = (typeof ENTITIES)[number]
const isVerb = (code: string): code is Verb => VERBS.includes(code as Verb)
const isAction = (code: string): code is Action => ACTIONS.includes(code as Action)
const isEntity = (code: string): code is Entity => ENTITIES.includes(code as Entity)

export function useActivityLabels() {
  const t = useTranslations('dash.adminActivity')
  return useMemo(() => {
    const entity = (type: string) => (isEntity(type) ? t(`entities.${type}`) : type)
    return {
      entity,
      /** An action on its own (the filter's choices). */
      action: (code: string) => (isVerb(code) ? t(`verbs.${code}`) : isAction(code) ? t(`actions.${code}`) : code),
      /** What a row did: "Xoá · Đặt phòng", "Xác nhận thanh toán", or the raw code. */
      what: (code: string, type: string) =>
        isVerb(code) ? t('what', { verb: t(`verbs.${code}`), entity: entity(type) }) : isAction(code) ? t(`actions.${code}`) : code,
    }
  }, [t])
}

export interface DetailLine {
  key: string
  value: string
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isPrimitive = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value)

/**
 * A row's changes or metadata as "key: value" lines, nested objects as
 * dotted keys ("translations.en.name"); times through `time`. Null when it
 * is not an object: the page shows it as JSON then.
 */
export function detailLines(value: unknown, time: (iso: string) => string = (iso) => iso): DetailLine[] | null {
  if (!isPlainObject(value)) return null
  const text = (v: unknown): string => {
    if (v === null) return 'null'
    if (typeof v === 'string') return ISO_TIME.test(v) ? time(v) : v
    if (Array.isArray(v) && v.every(isPrimitive)) return v.map(text).join(', ')
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  const lines: DetailLine[] = []
  const walk = (object: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [k, v] of Object.entries(object)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (isPlainObject(v) && Object.keys(v).length && depth < 3) walk(v, key, depth + 1)
      else lines.push({ key, value: text(v) })
    }
  }
  walk(value, '', 0)
  return lines
}
