/**
 * Sign-in and sign-up error messages. The server throws or returns them in
 * Vietnamese; the account pages show them in the visitor's language by
 * looking each one up in AUTH_ERROR_KEYS (keys under `auth` in
 * messages/*.json). Client-safe: no server imports.
 *
 * error-messages.test.ts fails when an /api/auth route returns a message
 * missing here, so a new one gets its translation.
 */
import { PASSWORD_TOO_SHORT } from '@/lib/validations'

export const LOGIN_ERRORS = {
  missing: 'Vui lòng nhập tên đăng nhập và mật khẩu',
  invalid: 'Tên đăng nhập hoặc mật khẩu không chính xác',
  tooMany: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.',
  locked: 'Tài khoản tạm khoá 30 phút do đăng nhập sai nhiều lần. Bạn có thể đặt lại mật khẩu để mở khoá ngay.',
  unverified: 'Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư đến của bạn.',
} as const

export const TWO_FACTOR_ERRORS = {
  invalidCode: 'Mã xác thực không đúng',
  locked: 'Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  expired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  alreadyEnabled: 'Xác thực hai lớp đã được bật',
  notPending: 'Hãy bắt đầu lại từ bước quét mã QR',
  passwordRequired: 'Vui lòng nhập mật khẩu',
  wrongPassword: 'Mật khẩu không đúng',
} as const

/** A key under `auth` in messages/*.json. */
export type AuthErrorKey =
  | `errors.${
      | 'invalid'
      | 'loginTooMany'
      | 'locked'
      | 'unverified'
      | 'twoFactorWrong'
      | 'twoFactorLocked'
      | 'twoFactorExpired'
      | 'usernameTaken'
      | 'emailTaken'
      | 'codeWrong'
      | 'codeTooManyTries'
      | 'resendCooldown'
      | 'tooManyCodes'
      | 'tooManyTries'
      | 'tooManyAccounts'
      | 'resetExpired'
      | 'alreadyVerified'
      | 'sendFailed'}`
  | `common.${'generic' | 'emailInvalid' | 'codeIncomplete' | 'passwordShort'}`
  | `login.${'missingLogin'}`
  | `register.${'nameError' | 'usernameShort' | 'usernameLong' | 'usernameChars'}`

export const AUTH_ERROR_KEYS: Record<string, AuthErrorKey> = {
  [LOGIN_ERRORS.missing]: 'login.missingLogin',
  [LOGIN_ERRORS.invalid]: 'errors.invalid',
  [LOGIN_ERRORS.tooMany]: 'errors.loginTooMany',
  [LOGIN_ERRORS.locked]: 'errors.locked',
  [LOGIN_ERRORS.unverified]: 'errors.unverified',
  [TWO_FACTOR_ERRORS.invalidCode]: 'errors.twoFactorWrong',
  [TWO_FACTOR_ERRORS.locked]: 'errors.twoFactorLocked',
  [TWO_FACTOR_ERRORS.expired]: 'errors.twoFactorExpired',
  // /api/auth/register and its schema (src/lib/validations)
  'Tên đăng nhập đã được sử dụng': 'errors.usernameTaken',
  'Email đã được sử dụng': 'errors.emailTaken',
  'Tên phải có ít nhất 2 ký tự': 'register.nameError',
  'Tên đăng nhập phải có ít nhất 3 ký tự': 'register.usernameShort',
  'Tên đăng nhập không quá 30 ký tự': 'register.usernameLong',
  'Chỉ chứa chữ, số và dấu gạch dưới': 'register.usernameChars',
  'Thiếu thông tin xác thực': 'common.generic',
  'Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.': 'errors.tooManyAccounts',
  'Đã xảy ra lỗi khi đăng ký': 'common.generic',
  // codes: /api/auth/otp/send, /otp/verify, /resend-verification
  'Mã OTP không hợp lệ hoặc đã hết hạn': 'errors.codeWrong',
  'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.': 'errors.codeTooManyTries',
  'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau.': 'errors.tooManyTries',
  'Vui lòng đợi 60 giây trước khi yêu cầu mã mới.': 'errors.resendCooldown',
  'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau 15 phút.': 'errors.tooManyCodes',
  'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.': 'errors.tooManyCodes',
  'Email đã được xác thực. Bạn có thể đăng nhập.': 'errors.alreadyVerified',
  'Không thể gửi email. Vui lòng thử lại.': 'errors.sendFailed',
  'Đã xảy ra lỗi khi gửi OTP': 'errors.sendFailed',
  'Vui lòng nhập email': 'common.emailInvalid',
  'Email không hợp lệ': 'common.emailInvalid',
  'Mục đích gửi mã không hợp lệ': 'common.generic',
  'Vui lòng nhập email và mã OTP': 'common.codeIncomplete',
  'Mã OTP phải gồm 6 chữ số': 'common.codeIncomplete',
  'Đã xảy ra lỗi khi xác thực': 'common.generic',
  'Đã xảy ra lỗi': 'common.generic',
  // /api/auth/reset-password
  'Vui lòng xác thực mã OTP rồi nhập mật khẩu mới': 'errors.resetExpired',
  'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng làm lại.': 'errors.resetExpired',
  [PASSWORD_TOO_SHORT]: 'common.passwordShort',
  'Đã xảy ra lỗi khi đặt lại mật khẩu': 'common.generic',
}
