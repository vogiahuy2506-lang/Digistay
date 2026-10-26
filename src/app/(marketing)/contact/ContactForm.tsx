'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { inkButton, lineButton, softText } from '@/components/marketing/styles'
import type { ContactTopic } from '@/lib/marketing/contact'

const TOPICS: ContactTopic[] = ['sales', 'support', 'partnership']
type Field = 'name' | 'email' | 'phone' | 'message'
type Values = Record<Field | 'hotel', string> & { topic: ContactTopic }

const EMPTY: Values = { name: '', hotel: '', email: '', phone: '', topic: 'sales', message: '' }

/** The checks of src/lib/marketing/contact.ts (contactSchema), to answer before sending. */
function problems(v: Values): Field[] {
  const digits = v.phone.replace(/\D/g, '').length
  return [
    !v.name.trim() && 'name',
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim()) && 'email',
    (!/^[\d\s+().-]*$/.test(v.phone.trim()) || digits < 8 || digits > 15) && 'phone',
    v.message.trim().length < 5 && 'message',
  ].filter(Boolean) as Field[]
}

/**
 * The /contact form (Claude Design "Digistay Lien He"): sends to
 * /api/public/contact, which emails the Digistay team. Says it was received
 * only when the server says so; on a failure what was typed stays.
 */
export function ContactForm() {
  const t = useTranslations('marketing.contact')
  const [values, setValues] = React.useState<Values>(EMPTY)
  const [tried, setTried] = React.useState(false)
  const [state, setState] = React.useState<'editing' | 'sending' | 'done' | 'failed' | 'tooMany'>('editing')
  const errors = tried ? problems(values) : []
  const busy = state === 'sending'

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problems(values).length > 0) return
    setState('sending')
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      setState(res.ok ? 'done' : res.status === 429 ? 'tooMany' : 'failed')
    } catch {
      setState('failed')
    }
  }

  if (state === 'done') {
    return (
      <div className="py-6 lg:py-10" role="status">
        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-soft text-[20px] text-ok">
          ✓
        </span>
        <h2 className="mt-5 font-serif text-[30px] font-medium leading-[1.2]">{t('done.title')}</h2>
        <p className={cn('mt-3 text-[15.5px] leading-[1.7]', softText)}>
          {t.rich('done.text', {
            topic: t(`form.topics.${values.topic}`),
            email: values.email.trim(),
            phone: values.phone.trim(),
            b: (chunks) => <b className="font-semibold text-fg">{chunks}</b>,
          })}
        </p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setValues((v) => ({ ...v, topic: 'sales', message: '' }))
              setTried(false)
              setState('editing')
            }}
            className={cn(lineButton, 'h-12 px-6 text-[15px]')}
          >
            {t('done.another')}
          </button>
          <Link href="/" className={cn(inkButton, 'h-12 px-6 text-[15px]')}>
            {t('done.home')}
          </Link>
        </div>
      </div>
    )
  }

  const input = (bad: boolean) =>
    cn(
      'h-[46px] w-full rounded-ctl border bg-panel px-3.5 text-[15px] text-fg placeholder:text-muted/80 transition-[border-color,box-shadow] duration-160',
      'focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60',
      bad ? 'border-err bg-err-soft/40' : 'border-line',
    )
  const error = (f: Field) =>
    errors.includes(f) && (
      <span id={`contact-${f}-error`} className="text-[13px] text-err">
        ⚠ {t(`errors.${f}`)}
      </span>
    )
  const described = (f: Field) => (errors.includes(f) ? `contact-${f}-error` : undefined)

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-[13px] text-muted">
        <span aria-hidden className="text-err">*</span> {t('form.requiredNote')}
      </p>
      {(state === 'failed' || state === 'tooMany') && (
        <p role="alert" className="rounded-ctl border border-err/30 bg-err-soft px-4 py-3 text-[14px] leading-[1.55] text-fg">
          <b className="font-semibold text-err">⚠ {t('errors.failTitle')}</b>{' '}
          {state === 'tooMany' ? t('errors.tooMany') : t('errors.failText')}
        </p>
      )}
      {errors.length > 0 && (
        <p role="alert" className="rounded-ctl bg-err-soft px-4 py-3 text-[14px] font-medium text-err">
          ⚠ {t('errors.summary', { count: errors.length })}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-[18px]">
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium">
            {t('form.name')}
            <Required />
          </span>
          <input
            value={values.name}
            onChange={set('name')}
            disabled={busy}
            autoComplete="name"
            aria-required="true"
            aria-invalid={errors.includes('name')}
            aria-describedby={described('name')}
            className={input(errors.includes('name'))}
          />
          {error('name')}
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium">{t('form.hotel')}</span>
          <input
            value={values.hotel}
            onChange={set('hotel')}
            disabled={busy}
            autoComplete="organization"
            placeholder={t('form.hotelPlaceholder')}
            className={input(false)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium">
            {t('form.email')}
            <Required />
          </span>
          <input
            type="email"
            inputMode="email"
            value={values.email}
            onChange={set('email')}
            disabled={busy}
            autoComplete="email"
            aria-required="true"
            aria-invalid={errors.includes('email')}
            aria-describedby={described('email')}
            className={input(errors.includes('email'))}
          />
          {error('email')}
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium">
            {t('form.phone')}
            <Required />
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={set('phone')}
            disabled={busy}
            autoComplete="tel"
            aria-required="true"
            aria-invalid={errors.includes('phone')}
            aria-describedby={described('phone')}
            className={input(errors.includes('phone'))}
          />
          {error('phone')}
        </label>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-[14px] font-medium">{t('form.topic')}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => {
            const on = values.topic === topic
            return (
              <label
                key={topic}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-2.5 rounded-ctl border px-4 text-[15px] transition-colors duration-160 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-acc',
                  on ? 'border-ink bg-plain-soft/60 ring-1 ring-ink' : 'border-line bg-panel hover:border-muted',
                )}
              >
                <input
                  type="radio"
                  name="topic"
                  value={topic}
                  checked={on}
                  disabled={busy}
                  onChange={() => setValues((v) => ({ ...v, topic }))}
                  className="sr-only"
                />
                <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full border border-ink/70">
                  {on && <span className="h-2 w-2 rounded-full bg-ink" />}
                </span>
                {t(`form.topics.${topic}`)}
              </label>
            )
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-medium">
          {t('form.message')}
          <Required />
        </span>
        <textarea
          value={values.message}
          onChange={set('message')}
          disabled={busy}
          rows={5}
          placeholder={t(`form.hints.${values.topic}`)}
          aria-required="true"
          aria-invalid={errors.includes('message')}
          aria-describedby={described('message')}
          className={cn(input(errors.includes('message')), 'h-auto min-h-[150px] resize-y py-3 leading-[1.6]')}
        />
        {error('message')}
      </label>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button type="submit" disabled={busy} className={cn(inkButton, 'h-[52px] shrink-0 whitespace-nowrap px-7 text-[15px] disabled:bg-muted')}>
          {busy ? t('form.sending') : state === 'failed' || state === 'tooMany' ? t('form.retry') : t('form.submit')}
        </button>
        <p className="text-[13px] leading-[1.55] text-muted">
          {t.rich('form.privacy', {
            link: (chunks) => (
              <Link href="/privacy" className="text-fg underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  )
}

/** The mark of a field the form cannot be sent without (the input says so with aria-required). */
function Required() {
  return (
    <span aria-hidden className="ml-0.5 text-err">
      *
    </span>
  )
}
