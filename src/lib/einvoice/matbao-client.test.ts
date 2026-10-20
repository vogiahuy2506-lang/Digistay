import { describe, it, expect, vi, afterEach } from 'vitest'
import { MatbaoClient, MatbaoError, clearMatbaoTokens } from './matbao-client'

const account = { environment: 'DEMO' as const, taxCode: '0312345678', username: 'u', password: 'p' }
const PDF = Buffer.from('%PDF-1.4 test')

/** fetch answering login, then download-invoice with `download`, then any PDF link. */
function stubFetch(download: object, pdfResponse = () => new Response(PDF)) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    if (url.endsWith('/api/auth/login')) return Response.json({ accessToken: 't' })
    if (url.endsWith('/api/invoice/download-invoice')) return Response.json(download)
    return pdfResponse()
  }))
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearMatbaoTokens()
})

describe('MatbaoClient.downloadPdf', () => {
  it('follows a PDF link only to a Mắt Bão host over HTTPS', async () => {
    const calls = stubFetch({ link_file: 'https://portal.matbao.in/files/hd.pdf' })
    expect(await new MatbaoClient(account).downloadPdf({ maTraCuu: 'DS1' })).toEqual(PDF)
    expect(calls.at(-1)).toBe('https://portal.matbao.in/files/hd.pdf')

    for (const link of ['https://evil.example/hd.pdf', 'http://portal.matbao.in/hd.pdf', 'https://matbao.in.evil.example/x']) {
      clearMatbaoTokens()
      const seen = stubFetch({ link_file: link })
      await expect(new MatbaoClient(account).downloadPdf({ maTraCuu: 'DS1' })).rejects.toThrow('không thuộc Mắt Bão')
      expect(seen).not.toContain(link)
    }
  })

  it('refuses something that is not a PDF', async () => {
    stubFetch({ data_PDF_Base64: Buffer.from('<html>login</html>').toString('base64') })
    await expect(new MatbaoClient(account).downloadPdf({ maTraCuu: 'DS1' })).rejects.toBeInstanceOf(MatbaoError)
  })
})
