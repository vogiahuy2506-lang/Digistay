/**
 * Rebuild the Digistay logo files the app loads, from the artwork in
 * assets/brand/. Run it after changing the artwork:
 *
 *   node scripts/prepare-logos.mjs
 *
 * Writes to public/:
 *   logo_digistay.png           square mark, transparent, light surfaces
 *   logo_digistay_dark.png      square mark for the dark theme
 *   logo_full_digistay.png      wide lockup, transparent, light surfaces
 *   logo_full_digistay_dark.png wide lockup for the dark theme
 *   favicon.ico, icon.png, apple-touch-icon.png   browser icons, from the mark
 */
import sharp from 'sharp'
import { statSync } from 'fs'
import { resolve } from 'path'

/** The artwork as delivered. Never edited in place: everything else is derived. */
const SRC = {
  icon: resolve('assets/brand/logo_digistay.png'),
  lockup: resolve('assets/brand/logo_full_digistay.png'),
}

/** The dark theme's text color (tokens.ts: fg). Used to recolour the artwork. */
const DARK_FG = '#F2EEE8'

/**
 * The lockup ships on its own off-white card, so it needs that card knocked out
 * before it can sit on a dark page.
 */
async function knockOutBackground(file) {
  const image = sharp(file).trim({ threshold: 2 })
  const { width, height } = await image.clone().metadata()
  const raw = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true })

  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const r = raw.data[i * raw.info.channels]
    const g = raw.data[i * raw.info.channels + 1]
    const b = raw.data[i * raw.info.channels + 2]
    // Near-white and near-neutral pixels are the card, not the artwork.
    const isCard = Math.min(r, g, b) >= 238 && Math.max(r, g, b) - Math.min(r, g, b) <= 12
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = isCard ? 0 : 255
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
}

/** The artwork with its dark ink swapped for the dark theme's text color. */
async function recolourForDark(pipeline) {
  const { width, height } = await pipeline.clone().metadata()
  // Keep the alpha: removeAlpha() would throw away the knocked-out card.
  const rgba = await pipeline.raw().toBuffer({ resolveWithObject: true })

  const out = Buffer.alloc(width * height * 4)
  const target = [
    parseInt(DARK_FG.slice(1, 3), 16),
    parseInt(DARK_FG.slice(3, 5), 16),
    parseInt(DARK_FG.slice(5, 7), 16),
  ]

  for (let i = 0; i < width * height; i++) {
    const r = rgba.data[i * rgba.info.channels]
    const g = rgba.data[i * rgba.info.channels + 1]
    const b = rgba.data[i * rgba.info.channels + 2]
    // Dark, low-saturation ink is the wordmark; the terracotta mark stays.
    const isInk = Math.max(r, g, b) <= 120 && Math.max(r, g, b) - Math.min(r, g, b) <= 24
    out[i * 4] = isInk ? target[0] : r
    out[i * 4 + 1] = isInk ? target[1] : g
    out[i * 4 + 2] = isInk ? target[2] : b
    // Keep the alpha the knock-out produced: the card stays transparent, so
    // the dark lockup sits on a dark page instead of a white box.
    out[i * 4 + 3] = rgba.data[i * rgba.info.channels + 3]
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
}

async function writeLogo(kind, width, transparentBg) {
  const base = await knockOutBackground(SRC[kind])

  await base
    .clone()
    .resize({ width })
    .png({ palette: true, colours: 96, compressionLevel: 9, effort: 10 })
    .toFile(`public/logo_${transparentBg ? 'full_' : ''}digistay.png`)

  const dark = await recolourForDark(base)
  await dark
    .resize({ width })
    .png({ palette: true, colours: 96, compressionLevel: 9, effort: 10 })
    .toFile(`public/logo_${transparentBg ? 'full_' : ''}digistay_dark.png`)
}

async function writeIcons() {
  const mark = await knockOutBackground(SRC.icon)

  await mark
    .clone()
    .resize({ width: 32 })
    .png()
    .toFile('/tmp/digistay-icon-32.png')

  // apple-touch-icon: iOS does not like transparency, so it gets the card back.
  await mark
    .clone()
    .flatten({ background: '#FBF9F6' })
    .resize(180, 180, { fit: 'contain', background: '#FBF9F6' })
    .png()
    .toFile('public/apple-touch-icon.png')

  await mark
    .clone()
    .flatten({ background: '#FBF9F6' })
    .resize(512, 512, { fit: 'contain', background: '#FBF9F6' })
    .png()
    .toFile('public/icon.png')

  await mark
    .clone()
    .resize({ width: 256 })
    .png()
    .toFile('public/logo_digistay.png')

  // The square mark for the dark theme: the same arch, its ink lightened.
  const dark = await recolourForDark(mark)
  await dark
    .clone()
    .resize({ width: 256 })
    .png()
    .toFile('public/logo_digistay_dark.png')
}

await writeLogo('lockup', 800, true)
await writeIcons()

for (const f of [
  'public/logo_full_digistay.png',
  'public/logo_full_digistay_dark.png',
  'public/logo_digistay.png',
  'public/logo_digistay_dark.png',
  'public/icon.png',
  'public/apple-touch-icon.png',
]) {
  console.log(f, Math.round(statSync(resolve(f)).size / 1024) + ' KB')
}