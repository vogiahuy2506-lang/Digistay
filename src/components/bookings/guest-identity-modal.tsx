'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IdCard, Plus, Trash2, Users, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Loading,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  toast,
} from '@/components/ui'

export interface StayGuestInput {
  name: string
  idType: string
  idNumber: string
  nationality: string
  birthDate: string
  gender: string
}

const QUICK_NATIONALITIES = ['Việt Nam', 'Hàn Quốc', 'Trung Quốc', 'Nhật Bản', 'Mỹ', 'Úc', 'Anh']

export function GuestIdentityModal({
  bookingId,
  bookingCode,
  guestName,
  isOpen,
  onClose,
  onSaved,
}: {
  bookingId: string | null
  bookingCode?: string
  guestName?: string
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const t = useTranslations('dash.bookings.guestIdentity')
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const [displayCode, setDisplayCode] = React.useState(bookingCode || '')
  const [displayGuest, setDisplayGuest] = React.useState(guestName || '')
  const [idType, setIdType] = React.useState('CCCD')
  const [idNumber, setIdNumber] = React.useState('')
  const [nationality, setNationality] = React.useState('Việt Nam')
  const [birthDate, setBirthDate] = React.useState('')
  const [gender, setGender] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [stayGuests, setStayGuests] = React.useState<StayGuestInput[]>([])

  React.useEffect(() => {
    if (!isOpen || !bookingId) return
    let cancelled = false
    setLoading(true)
    setError('')

    fetch(`/api/bookings/${bookingId}/guest-identity`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success && json.data) {
          const d = json.data
          setDisplayCode(d.bookingCode || bookingCode || '')
          setDisplayGuest(d.guestName || guestName || '')
          setIdType(d.guestIdType || 'CCCD')
          setIdNumber(d.guestIdNumber || '')
          setNationality(d.guestNationality || 'Việt Nam')
          setBirthDate(d.guestBirthDate ? String(d.guestBirthDate).slice(0, 10) : '')
          setGender(d.guestGender || '')
          setAddress(d.guestAddress || '')
          setStayGuests(
            Array.isArray(d.stayGuests)
              ? d.stayGuests.map((g: any) => ({
                  name: g.name || '',
                  idType: g.idType || 'CCCD',
                  idNumber: g.idNumber || '',
                  nationality: g.nationality || 'Việt Nam',
                  birthDate: g.birthDate ? String(g.birthDate).slice(0, 10) : '',
                  gender: g.gender || '',
                }))
              : []
          )
        } else {
          setError(json.error || t('loadError'))
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('networkError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, bookingId, bookingCode, guestName, t])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingId) return
    setSaving(true)
    setError('')

    try {
      const cleanedStayGuests = stayGuests
        .filter((g) => g.name.trim())
        .map((g) => ({
          name: g.name.trim(),
          idType: g.idType || 'CCCD',
          idNumber: g.idNumber.trim() || undefined,
          nationality: g.nationality.trim() || 'Việt Nam',
          birthDate: g.birthDate || undefined,
          gender: g.gender || undefined,
        }))

      const res = await fetch(`/api/bookings/${bookingId}/guest-identity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIdType: idType,
          guestIdNumber: idNumber.trim() || null,
          guestNationality: nationality.trim() || 'Việt Nam',
          guestBirthDate: birthDate || null,
          guestGender: gender || null,
          guestAddress: address.trim() || null,
          stayGuests: cleanedStayGuests,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || t('saveError'))
        return
      }
      toast.success(t('saveSuccess'))
      onSaved?.()
      onClose()
    } catch {
      setError(t('networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleSave} className="flex flex-col min-h-0">
        <ModalHeader onClose={onClose}>
          <div className="flex items-center gap-2.5 pr-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <IdCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">
                {t('modalTitle', { code: displayCode ? `· ${displayCode}` : '' })}
              </h3>
              <p className="text-xs text-muted">
                {t('primaryGuest', { name: displayGuest || '—' })} · {t('purposeNote')}
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {loading ? (
            <Loading className="py-12" />
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-xl bg-err-soft border border-err/30 text-err text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Primary Guest Identity */}
              <div className="rounded-xl border border-line bg-raised/60 p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    {t('primarySection')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label={t('idType')}
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                  >
                    <option value="CCCD">{t('idTypeCccd')}</option>
                    <option value="PASSPORT">{t('idTypePassport')}</option>
                    <option value="OTHER">{t('idTypeOther')}</option>
                  </Select>

                  <Input
                    label={t('idNumber')}
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={idType === 'PASSPORT' ? t('idNumberPlaceholderPassport') : t('idNumberPlaceholderCccd')}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    type="date"
                    label={t('birthDate')}
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />

                  <Select
                    label={t('gender')}
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">{t('genderSelect')}</option>
                    <option value="MALE">{t('genderMale')}</option>
                    <option value="FEMALE">{t('genderFemale')}</option>
                    <option value="OTHER">{t('genderOther')}</option>
                  </Select>

                  <Input
                    label={t('nationality')}
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Việt Nam"
                  />
                </div>

                {/* Quick Nationality Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted mr-1">{t('quickSelect')}</span>
                  {QUICK_NATIONALITIES.map((nat) => (
                    <button
                      key={nat}
                      type="button"
                      onClick={() => setNationality(nat)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                        nationality === nat
                          ? 'bg-acc-soft border-acc/40 text-acc'
                          : 'bg-panel border-line text-muted hover:text-fg'
                      }`}
                    >
                      {nat}
                    </button>
                  ))}
                </div>

                <Input
                  label={t('address')}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('addressPlaceholder')}
                />
              </div>

              {/* Companion Guests */}
              <div className="rounded-xl border border-line bg-raised/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{t('companionSection', { count: stayGuests.length })}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStayGuests((prev) => [
                        ...prev,
                        { name: '', idType: 'CCCD', idNumber: '', nationality: 'Việt Nam', birthDate: '', gender: '' },
                      ])
                    }
                    className="h-7 px-2.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {t('addCompanion')}
                  </Button>
                </div>

                {stayGuests.length === 0 ? (
                  <p className="text-xs text-muted">
                    {t('companionHint')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {stayGuests.map((sg, idx) => (
                        <motion.div
                          key={`guest-${idx}`}
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.18 }}
                          className="p-3 rounded-xl bg-panel border border-line space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted">{t('companionIndex', { index: idx + 1 })}</span>
                            <button
                              type="button"
                              onClick={() => setStayGuests((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-xs text-err hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t('removeCompanion')}</span>
                            </button>
                          </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <Input
                            label={t('companionName')}
                            value={sg.name}
                            onChange={(e) =>
                              setStayGuests((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                              )
                            }
                            placeholder={t('companionNamePlaceholder')}
                          />
                          <div className="grid grid-cols-5 gap-2">
                            <div className="col-span-2">
                              <Select
                                label={t('idType')}
                                value={sg.idType}
                                onChange={(e) =>
                                  setStayGuests((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, idType: e.target.value } : item))
                                  )
                                }
                              >
                                <option value="CCCD">{t('idTypeCccd')}</option>
                                <option value="PASSPORT">{t('idTypePassport')}</option>
                                <option value="OTHER">{t('idTypeOther')}</option>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Input
                                label={t('idNumber')}
                                value={sg.idNumber}
                                onChange={(e) =>
                                  setStayGuests((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, idNumber: e.target.value } : item))
                                  )
                                }
                                placeholder="079..."
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <Input
                            type="date"
                            label={t('birthDate')}
                            value={sg.birthDate}
                            onChange={(e) =>
                              setStayGuests((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, birthDate: e.target.value } : item))
                              )
                            }
                          />
                          <Select
                            label={t('gender')}
                            value={sg.gender}
                            onChange={(e) =>
                              setStayGuests((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, gender: e.target.value } : item))
                              )
                            }
                          >
                            <option value="">{t('genderSelect')}</option>
                            <option value="MALE">{t('genderMale')}</option>
                            <option value="FEMALE">{t('genderFemale')}</option>
                            <option value="OTHER">{t('genderOther')}</option>
                          </Select>
                          <Input
                            label={t('nationality')}
                            value={sg.nationality}
                            onChange={(e) =>
                              setStayGuests((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, nationality: e.target.value } : item))
                              )
                            }
                            placeholder="Việt Nam"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                )}
              </div>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" isLoading={saving} disabled={loading}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? t('saving') : t('save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
