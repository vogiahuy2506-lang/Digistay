/**
 * Utility functions for exporting tabular data to CSV and Excel (.xls).
 * Handles UTF-8 BOM for Vietnamese character encoding, RFC 4180 CSV escaping,
 * and styled HTML/XML spreadsheet tables compatible with Excel, Sheets, and LibreOffice.
 */

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If contains quote, comma, or newline, escape quotes and wrap in quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  // UTF-8 BOM (\uFEFF) ensures Excel opens Vietnamese accents without garbled text
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n')
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const csvContent = generateCsv(headers, rows)
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  downloadFile(csvContent, safeFilename, 'text/csv;charset=utf-8;')
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateExcelHtml(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  summary?: { label: string; value: string | number }[]
): string {
  const summaryHtml = summary && summary.length > 0
    ? `
      <div style="background-color: #f3f4f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
        <table style="border: none; margin: 0; padding: 0;">
          <tr>
            ${summary.map((s) => `
              <td style="border: none; padding: 4px 20px 4px 0; font-size: 13px; color: #4b5563;">
                <strong>${escapeHtml(s.label)}:</strong> <span style="color: #111827; font-weight: bold;">${escapeHtml(s.value)}</span>
              </td>
            `).join('')}
          </tr>
        </table>
      </div>
    `
    : ''

  const rowsHtml = rows.map((row, index) => {
    const bg = index % 2 === 1 ? 'background-color: #f9fafb;' : 'background-color: #ffffff;'
    return `
      <tr style="${bg}">
        ${row.map((cell) => `
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; font-size: 13px; color: #1f2937; mso-number-format:'\\@';">
            ${escapeHtml(cell)}
          </td>
        `).join('')}
      </tr>
    `
  }).join('')

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${escapeHtml(title.slice(0, 31))}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; }
        h2 { color: #111827; font-size: 18px; margin-bottom: 8px; }
        .exported-time { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; }
        th { background-color: #0f172a; color: #ffffff; font-weight: 600; font-size: 13px; text-align: left; padding: 10px 12px; border: 1px solid #0f172a; }
      </style>
    </head>
    <body>
      <h2>${escapeHtml(title)}</h2>
      <div class="exported-time">Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</div>
      ${summaryHtml}
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `
}

export function exportToExcel(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  summary?: { label: string; value: string | number }[]
) {
  const excelContent = generateExcelHtml(title, headers, rows, summary)
  const safeFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`
  downloadFile(excelContent, safeFilename, 'application/vnd.ms-excel;charset=utf-8;')
}
