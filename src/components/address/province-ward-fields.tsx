'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { PROVINCES, mergedInto } from '@/lib/vn-admin/provinces'

/** A property's province and ward as the pickers hold them: official codes, "" for none. */
export interface LocationValue {
  provinceCode: string
  wardCode: string
}

interface WardItem {
  code: string
  name: string
}

// One request per province per page load, shared by every picker on the page;
// a failed one is asked again on the next try.
const wardRequests = new Map<string, Promise<WardItem[]>>()

function loadWards(provinceCode: string): Promise<WardItem[]> {
  let request = wardRequests.get(provinceCode)
  if (!request) {
    request = fetch(`/api/vn-admin/provinces/${encodeURIComponent(provinceCode)}/wards`).then(async (res) => {
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) throw new Error(`wards of ${provinceCode}: HTTP ${res.status}`)
      return body.data as WardItem[]
    })
    request.catch(() => wardRequests.delete(provinceCode))
    wardRequests.set(provinceCode, request)
  }
  return request
}

/** The texts both pickers share. */
function usePickerTexts() {
  const t = useTranslations('dash.property.address')
  return {
    t,
    common: {
      placeholder: t('placeholder'),
      noMatchText: t('noMatch'),
      countText: (count: number) => t('count', { count }),
      toggleLabel: t('showList'),
      clearLabel: t('clear'),
    },
  }
}

interface ProvincePickerProps {
  value: string
  onChange: (provinceCode: string) => void
  required?: boolean
  /**
   * The saved city when it is not one of the 34 (a merged province such as
   * "Bình Dương", a town): the picker starts empty and says why.
   */
  legacyCity?: string
}

/** Tỉnh/Thành phố: the 34 provinces and centrally-run cities, type to filter (names, full names, English names). */
export function ProvincePicker({ value, onChange, required, legacyCity }: ProvincePickerProps) {
  const { t, common } = usePickerTexts()
  const options = React.useMemo<ComboboxOption[]>(
    () => PROVINCES.map((p) => ({ value: p.code, label: p.name, hint: t(`kind.${p.kind}`), keywords: `${p.fullName} ${p.nameEn}` })),
    [t]
  )
  const successor = mergedInto(legacyCity)
  const hint =
    legacyCity && !value
      ? successor
        ? t('legacyMerged', { city: legacyCity, province: successor.name })
        : t('legacy', { city: legacyCity })
      : undefined
  return (
    <Combobox
      {...common}
      label={t('province')}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      hint={hint}
    />
  )
}

interface WardPickerProps {
  provinceCode: string
  value: string
  onChange: (wardCode: string) => void
  required?: boolean
  /** The saved ward's name, shown while its province's list loads. */
  savedName?: string
}

/** Phường/Xã: the chosen province's wards, communes and special zones, loaded when the province is chosen. */
export function WardPicker({ provinceCode, value, onChange, required, savedName }: WardPickerProps) {
  const { t, common } = usePickerTexts()
  const [attempt, setAttempt] = React.useState(0)
  // Keyed by province: another province's list never shows while the new one loads.
  const [loaded, setLoaded] = React.useState<{ provinceCode: string; wards?: WardItem[]; failed?: boolean }>({ provinceCode: '' })

  React.useEffect(() => {
    if (!provinceCode) return
    let cancelled = false
    loadWards(provinceCode).then(
      (wards) => !cancelled && setLoaded({ provinceCode, wards }),
      () => !cancelled && setLoaded({ provinceCode, failed: true })
    )
    return () => {
      cancelled = true
    }
  }, [provinceCode, attempt])

  const current = loaded.provinceCode === provinceCode ? loaded : null
  const wards = current?.wards
  const failed = Boolean(current?.failed)
  const options = React.useMemo<ComboboxOption[]>(() => (wards ?? []).map((w) => ({ value: w.code, label: w.name })), [wards])
  const placeholder = !provinceCode ? t('wardPickProvinceFirst') : !wards && !failed ? t('wardLoading') : common.placeholder

  return (
    <div>
      <Combobox
        {...common}
        label={t('ward')}
        options={options}
        value={value}
        onChange={onChange}
        valueLabel={savedName}
        placeholder={placeholder}
        required={required}
        disabled={!provinceCode || !wards}
        error={failed ? t('wardLoadFailed') : undefined}
      />
      {failed && (
        <button
          type="button"
          onClick={() => {
            setLoaded({ provinceCode: '' })
            setAttempt((n) => n + 1)
          }}
          className="mt-1 text-small font-medium text-acc underline underline-offset-2 hover:no-underline"
        >
          {t('retry')}
        </button>
      )}
    </div>
  )
}

interface ProvinceWardFieldsProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  /** The province must be chosen (not for an old row being edited, see legacyCity). */
  required?: boolean
  wardRequired?: boolean
  legacyCity?: string
  /** The saved ward's name, for wardCode as it was saved. */
  savedWardName?: string
  /** The grid of the two pickers, to match the form's other rows. */
  className?: string
}

/**
 * The address's province, then its ward, side by side. Changing the
 * province clears the ward (it belonged to the other one). Since July 2025
 * there is no district level: no Quận/Huyện here.
 */
export function ProvinceWardFields({
  value,
  onChange,
  required,
  wardRequired,
  legacyCity,
  savedWardName,
  className = 'grid grid-cols-1 sm:grid-cols-2 gap-4',
}: ProvinceWardFieldsProps) {
  return (
    <div className={className}>
      <ProvincePicker
        value={value.provinceCode}
        onChange={(provinceCode) => provinceCode !== value.provinceCode && onChange({ provinceCode, wardCode: '' })}
        required={required}
        legacyCity={legacyCity}
      />
      <WardPicker
        provinceCode={value.provinceCode}
        value={value.wardCode}
        onChange={(wardCode) => onChange({ ...value, wardCode })}
        required={wardRequired && Boolean(value.provinceCode)}
        savedName={savedWardName}
      />
    </div>
  )
}
