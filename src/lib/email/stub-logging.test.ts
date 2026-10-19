/**
 * Without SMTP or Resend configured, emails go to the console stub. Outside
 * development that log must not contain the body (one-time codes, links).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendOtpEmail } from './index'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function captureLogs() {
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  })
  return lines
}

function unconfigure() {
  for (const k of ['EMAIL_SERVER_HOST', 'EMAIL_SERVER_PORT', 'EMAIL_SERVER_USER', 'EMAIL_SERVER_PASSWORD', 'RESEND_API_KEY']) {
    vi.stubEnv(k, '')
  }
}

describe('email stub logging', () => {
  it('hides the body (and the code) in production', async () => {
    unconfigure()
    vi.stubEnv('NODE_ENV', 'production')
    const lines = captureLogs()
    await sendOtpEmail({ recipientEmail: 'a@example.com', otp: '482913', purpose: 'forgot_password' })
    expect(lines.join('\n')).toContain('[email:stub]')
    expect(lines.join('\n')).not.toContain('482913')
  })

  it('still prints the body in development', async () => {
    unconfigure()
    vi.stubEnv('NODE_ENV', 'development')
    const lines = captureLogs()
    await sendOtpEmail({ recipientEmail: 'a@example.com', otp: '482913', purpose: 'forgot_password' })
    expect(lines.join('\n')).toContain('482913')
  })
})
