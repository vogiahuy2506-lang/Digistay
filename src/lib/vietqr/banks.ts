/**
 * Vietnamese banks that take VietQR (NAPAS 247) transfers, with the 6-digit
 * acquirer BIN a VietQR payload names the bank by (tag 38, sub-tag 01.00).
 * Codes are the short codes of the NAPAS / VietQR bank list; `aliases` are
 * codes this app saved before (VietinBank was "VTB" or "CTG").
 *
 * The bank-accounts page offers this list, the API refuses any other code,
 * and src/lib/vietqr builds the QR from the BIN.
 */
export interface VietQrBank {
  code: string
  bin: string
  /** the name customers know, saved as BankAccount.bankName */
  shortName: string
  aliases?: string[]
}

export const VIETQR_BANKS: readonly VietQrBank[] = [
  { code: 'VCB', bin: '970436', shortName: 'Vietcombank' },
  { code: 'ICB', bin: '970415', shortName: 'VietinBank', aliases: ['VTB', 'CTG'] },
  { code: 'BIDV', bin: '970418', shortName: 'BIDV' },
  { code: 'VBA', bin: '970405', shortName: 'Agribank' },
  { code: 'TCB', bin: '970407', shortName: 'Techcombank' },
  { code: 'MB', bin: '970422', shortName: 'MB Bank' },
  { code: 'ACB', bin: '970416', shortName: 'ACB' },
  { code: 'VPB', bin: '970432', shortName: 'VPBank' },
  { code: 'TPB', bin: '970423', shortName: 'TPBank' },
  { code: 'STB', bin: '970403', shortName: 'Sacombank' },
  { code: 'HDB', bin: '970437', shortName: 'HDBank' },
  { code: 'VIB', bin: '970441', shortName: 'VIB' },
  { code: 'SHB', bin: '970443', shortName: 'SHB' },
  { code: 'EIB', bin: '970431', shortName: 'Eximbank' },
  { code: 'MSB', bin: '970426', shortName: 'MSB' },
  { code: 'SEAB', bin: '970440', shortName: 'SeABank' },
  { code: 'OCB', bin: '970448', shortName: 'OCB' },
  { code: 'LPB', bin: '970449', shortName: 'LPBank' },
  { code: 'NAB', bin: '970428', shortName: 'Nam A Bank' },
  { code: 'BAB', bin: '970409', shortName: 'Bac A Bank' },
  { code: 'ABB', bin: '970425', shortName: 'ABBANK' },
  { code: 'VAB', bin: '970427', shortName: 'VietABank' },
  { code: 'PVCB', bin: '970412', shortName: 'PVcomBank' },
  { code: 'VCCB', bin: '970454', shortName: 'BVBank (Viet Capital)' },
  { code: 'NCB', bin: '970419', shortName: 'NCB' },
  { code: 'SGICB', bin: '970400', shortName: 'Saigonbank' },
  { code: 'SCB', bin: '970429', shortName: 'SCB' },
  { code: 'KLB', bin: '970452', shortName: 'KienlongBank' },
  { code: 'PGB', bin: '970430', shortName: 'PGBank' },
  { code: 'BVB', bin: '970438', shortName: 'BaoViet Bank' },
  { code: 'VIETBANK', bin: '970433', shortName: 'VietBank' },
  { code: 'GPB', bin: '970408', shortName: 'GPBank' },
  { code: 'DOB', bin: '970406', shortName: 'DongA Bank' },
  { code: 'OCEANBANK', bin: '970414', shortName: 'OceanBank' },
  { code: 'CBB', bin: '970444', shortName: 'CBBank' },
  { code: 'COOPBANK', bin: '970446', shortName: 'Co-opBank' },
  { code: 'VRB', bin: '970421', shortName: 'VRB' },
  { code: 'IVB', bin: '970434', shortName: 'Indovina Bank' },
  { code: 'SHBVN', bin: '970424', shortName: 'Shinhan Bank' },
  { code: 'WVN', bin: '970457', shortName: 'Woori Bank' },
  { code: 'PBVN', bin: '970439', shortName: 'Public Bank' },
  { code: 'HLBVN', bin: '970442', shortName: 'Hong Leong Bank' },
  { code: 'UOB', bin: '970458', shortName: 'UOB' },
  { code: 'SCVN', bin: '970410', shortName: 'Standard Chartered' },
  { code: 'CAKE', bin: '546034', shortName: 'CAKE by VPBank' },
  { code: 'UBANK', bin: '546035', shortName: 'Ubank by VPBank' },
  { code: 'TIMO', bin: '963388', shortName: 'Timo' },
]

const byCode = new Map<string, VietQrBank>()
for (const bank of VIETQR_BANKS) {
  for (const key of [bank.code, bank.bin, ...(bank.aliases ?? [])]) byCode.set(key.toUpperCase(), bank)
}

/** The bank behind a code, an old alias or a BIN; undefined if unknown. */
export function findBank(code: string | null | undefined): VietQrBank | undefined {
  return code ? byCode.get(code.trim().toUpperCase()) : undefined
}

/** "Vietcombank (VCB)", or the code itself for a bank not in the list. */
export function bankLabel(code: string | null | undefined): string {
  const bank = findBank(code)
  return bank ? `${bank.shortName} (${bank.code})` : (code ?? '')
}
