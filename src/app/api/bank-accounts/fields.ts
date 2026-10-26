import { z } from 'zod'
import { findBank, toBankName } from '@/lib/vietqr'

/**
 * A bank account's fields as they are saved: a bank the VietQR list knows
 * (its code, so a QR can always name the bank's BIN), the account number
 * without spaces, and the holder's name as banks print it (upper case, no
 * diacritics), which is what the guest's banking app shows.
 */
export const bankAccountFields = {
  bankName: z.string().trim().min(2),
  bankCode: z
    .string()
    .refine((code) => Boolean(findBank(code)), 'Ngân hàng không hỗ trợ VietQR')
    .transform((code) => findBank(code)!.code),
  accountNumber: z
    .string()
    .transform((value) => value.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(/^[0-9A-Za-z]{6,30}$/, 'Số tài khoản không hợp lệ')),
  accountHolder: z
    .string()
    .transform(toBankName)
    .pipe(z.string().min(2, 'Vui lòng nhập tên chủ tài khoản')),
}
