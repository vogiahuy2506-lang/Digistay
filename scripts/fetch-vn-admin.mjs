/**
 * Regenerates src/data/vn-admin/provinces.json and wards.json: Vietnam's
 * provinces and their wards / communes / special zones since the 2025
 * reorganisation (34 provinces, no district level; Nghị quyết 202/2025/QH15
 * and the resolutions after it).
 *
 * Source: a pinned release of thanglequoc/vietnamese-provinces-database (MIT),
 * built from the statistics office's official list (danhmuchanhchinh.nso.gov.vn)
 * and updated with every resolution since (it lists them in its README). It
 * was chosen over provinces.open-api.vn/api/v2 because, on 2026-10-26, that
 * API still had 22 communes of Đồng Nai and Bắc Ninh as "Xã" that became
 * "Phường" in 2026 (237/NQ-UBTVQH16, 388/NQ-UBTVQH16). `--cross-check`
 * compares the two.
 *
 * The app never calls an outside service at runtime: these files are the data.
 *
 *   node scripts/fetch-vn-admin.mjs                   # the pinned release below
 *   node scripts/fetch-vn-admin.mjs --release v5.3.0  # a newer one
 *   node scripts/fetch-vn-admin.mjs --cross-check     # also compare with provinces.open-api.vn
 *
 * Then review the diff (renamed or moved wards break nothing stored: a
 * property keeps the names it was saved with), update src/data/vn-admin/README.md
 * and run `npx vitest run vn-admin`.
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const REPO = 'thanglequoc/vietnamese-provinces-database'
const DEFAULT_RELEASE = 'v5.2.0'
const OUT = resolve('src/data/vn-admin')
const WARD_TYPES = ['Phường ', 'Xã ', 'Đặc khu ']

const args = process.argv.slice(2)
const release = args.includes('--release') ? args[args.indexOf('--release') + 1] : DEFAULT_RELEASE
const crossCheck = args.includes('--cross-check')

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

function fail(message) {
  console.error(`fetch-vn-admin: ${message}`)
  process.exit(1)
}

const raw = `https://raw.githubusercontent.com/${REPO}/${release}/json`
const [units, meta] = await Promise.all([
  getJson(`${raw}/full_json_generated_data_vn_units.json`),
  getJson(`${raw}/vn_provinces_metadata.json`),
])

// Sorted as Vietnamese readers expect (Đ after D, tones after the base
// letter) once here, so the app never sorts at runtime (Intl differs between
// Node and browsers).
const collator = new Intl.Collator('vi')
const byName = (a, b) => collator.compare(a.Name, b.Name) || a.Code.localeCompare(b.Code)

if (!Array.isArray(units) || units.length !== 34) fail(`expected 34 provinces, got ${units?.length}`)
const provinceCodes = new Set()
const wardCodes = new Set()
const provinces = []
const wards = {}
for (const p of [...units].sort(byName)) {
  if (!/^\d{2}$/.test(p.Code) || provinceCodes.has(p.Code)) fail(`bad or repeated province code ${p.Code}`)
  provinceCodes.add(p.Code)
  const kind = p.AdministrativeUnitShortName === 'Thành phố' ? 'city' : p.AdministrativeUnitShortName === 'Tỉnh' ? 'province' : null
  if (!kind || !p.Name || !p.FullName?.endsWith(p.Name)) fail(`unexpected province ${JSON.stringify(p.FullName)}`)
  provinces.push({ code: p.Code, name: p.Name, fullName: p.FullName, nameEn: p.NameEn, kind })
  wards[p.Code] = [...p.Wards].sort(byName).map((w) => {
    if (!/^\d{5}$/.test(w.Code) || wardCodes.has(w.Code)) fail(`bad or repeated ward code ${w.Code}`)
    if (w.ProvinceCode !== p.Code) fail(`ward ${w.Code} lists province ${w.ProvinceCode}, sits in ${p.Code}`)
    // The type and the name, capitalised: the official list has one "xã Bắc Sơn" (Lạng Sơn).
    const name = `${w.AdministrativeUnitShortName} ${w.Name}`
    if (!WARD_TYPES.some((t) => name.startsWith(t)) || name.toLowerCase() !== w.FullName?.toLowerCase()) {
      fail(`unexpected ward ${JSON.stringify(w.FullName)}`)
    }
    if (name !== w.FullName) console.log(`  ${w.Code}: "${w.FullName}" written as "${name}"`)
    wardCodes.add(w.Code)
    return [w.Code, name]
  })
}
// 3,321 after the 2025 reorganisation; a later resolution may merge or split a few.
if (wardCodes.size < 3200 || wardCodes.size > 3400) fail(`unexpected number of wards: ${wardCodes.size}`)

const fetchedAt = new Date().toISOString().slice(0, 10)
const header = {
  source: `https://github.com/${REPO} (release ${release}, MIT), from danhmuchanhchinh.nso.gov.vn`,
  release,
  latestDecree: meta.LatestDecree,
  datasetGeneratedAt: meta.GeneratedAt,
  fetchedAt,
}

// One entry per line: a regenerated file reviews as a short diff.
const lines = (items) => items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')
writeFileSync(
  resolve(OUT, 'provinces.json'),
  `{\n${Object.entries(header).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n` +
    `  "provinces": [\n${lines(provinces)}\n  ]\n}\n`
)
writeFileSync(
  resolve(OUT, 'wards.json'),
  `{\n${Object.entries(wards).sort(([a], [b]) => a.localeCompare(b)).map(([code, list]) => `  ${JSON.stringify(code)}: [\n${lines(list)}\n  ]`).join(',\n')}\n}\n`
)
console.log(`fetch-vn-admin: ${provinces.length} provinces, ${wardCodes.size} wards (release ${release}, ${meta.LatestDecree})`)

if (crossCheck) {
  // provinces.open-api.vn/api/v2 uses the same official codes. Tone marks are
  // placed differently in places (Hòa / Hoà): compared without them.
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[’']/g, "'").toLowerCase()
  const [apiProvinces, apiWards] = await Promise.all([
    getJson('https://provinces.open-api.vn/api/v2/p/'),
    getJson('https://provinces.open-api.vn/api/v2/w/'),
  ])
  const ours = new Map(provinces.map((p) => [Number(p.code), p.fullName]))
  for (const p of apiProvinces) {
    if (!ours.has(p.code)) console.warn(`  open-api province ${p.code} ${p.name}: not in ours`)
    else if (fold(ours.get(p.code)) !== fold(p.name)) console.warn(`  province ${p.code}: ours ${ours.get(p.code)}, open-api ${p.name}`)
  }
  const ourWards = new Map(Object.entries(wards).flatMap(([pc, list]) => list.map(([code, name]) => [Number(code), { pc: Number(pc), name }])))
  let differences = 0
  for (const w of apiWards) {
    const mine = ourWards.get(w.code)
    if (!mine || mine.pc !== w.province_code || fold(mine.name) !== fold(w.name)) {
      differences++
      console.warn(`  ward ${w.code}: ours ${mine ? `${mine.name} (${mine.pc})` : '-'}, open-api ${w.name} (${w.province_code})`)
    }
  }
  console.log(`cross-check: open-api has ${apiProvinces.length} provinces, ${apiWards.length} wards; ${differences} ward differences`)
}
