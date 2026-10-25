/**
 * Shared classes of Digistay's own public pages (Claude Design "Digistay Gioi
 * Thieu", "Digistay Bang Gia"): links styled as buttons, section headings.
 * Light theme only; colors are the role tokens (src/styles/tokens.ts).
 */

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page'

/** The main call to action: warm ink (light in the dark theme), a shade softer on hover. */
export const inkButton =
  'inline-flex items-center justify-center rounded-ctl bg-ink font-medium text-on-ink transition-[background-color,transform] duration-160 ease-ds hover:-translate-y-px hover:bg-ink/90 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ' +
  focus

/** The second action next to it: an ink outline. */
export const lineButton =
  'inline-flex items-center justify-center rounded-ctl border border-ink font-medium text-fg transition-colors duration-160 ease-ds hover:bg-panel ' +
  focus

/** A plain link in running text or a list. */
export const textLink = 'font-medium text-fg underline-offset-4 hover:underline ' + focus

/** Page-wide horizontal frame: 20 px gutters on phones, 80 px from lg (1440 design). */
export const frame = 'mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-20'

/** "Những gì Digistay làm được hôm nay", "Bảng giá"... */
export const sectionTitle =
  'font-serif text-[32px] font-medium leading-[1.18] tracking-[-0.015em] text-fg lg:text-[52px] lg:leading-[1.15] lg:tracking-[-0.02em]'

/** Body copy one step softer than headings (#4A4741 in the design). */
export const softText = 'text-fg/80'

/** `style` for a `data-reveal` element (Reveal.tsx) that should start a little after its neighbours. */
export const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties
