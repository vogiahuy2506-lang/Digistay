/**
 * The choices of a workspace's settings, shared by the create / edit dialog on
 * /workspaces and the workspace settings page, so both show the same lists.
 * Values are what createWorkspaceSchema accepts and the settings JSON keeps.
 * Labels: messages workspaces.form.businessTypes.*, .currencies.* and .timezones.*
 */
export const BUSINESS_TYPES = ['boutique_hotel', 'resort', 'homestay'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const CURRENCIES = ['VND', 'USD', 'EUR'] as const

export const TIMEZONES = [
  { value: 'GMT+07:00', key: 'gmt7' },
  { value: 'GMT+08:00', key: 'gmt8' },
  { value: 'GMT+09:00', key: 'gmt9' },
] as const

/** A workspace's saved settings JSON, read into the form (unknown values give the defaults). */
export function workspaceSettingsOf(settings: unknown): { businessType: BusinessType; currency: string; timezone: string } {
  const saved = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback
  return {
    businessType: pick(saved.businessType, BUSINESS_TYPES, 'boutique_hotel'),
    currency: pick(saved.currency, CURRENCIES, 'VND'),
    timezone: pick(saved.timezone, TIMEZONES.map((tz) => tz.value), 'GMT+07:00'),
  }
}
