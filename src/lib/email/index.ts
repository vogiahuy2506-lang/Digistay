/**
 * Email service for Digistay (Stub).
 * 
 * In production, this would be backed by Resend (https://resend.com)
 * For development, emails are logged to console.
 */

export interface EmailRecipient {
  email: string
  name?: string
}

export interface SendResult {
  success: boolean
  sent: boolean
  id?: string
  error?: string
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

async function send(
  to: EmailRecipient,
  subject: string,
  html: string,
  text?: string
): Promise<SendResult> {
  // Dev fallback: log to console so developers can see the email.
  console.log(
    `[email:dev] Would send "${subject}" to ${to.email}\n` +
      `--- TEXT ---\n${text ?? html}\n---`
  )
  return { success: true, sent: false, error: 'Email service not configured' }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================
//  Booking confirmation
// ============================================

export interface BookingConfirmationData {
  guestName: string
  guestEmail: string
  bookingCode: string
  propertyName: string
  propertyAddress: string
  propertyPhone: string | null
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  totalAmount: number
  currency?: string
  manageUrl: string
}

export async function sendBookingConfirmation(
  data: BookingConfirmationData
): Promise<SendResult> {
  const { guestName, guestEmail, bookingCode, propertyName } = data
  const subject = `[${bookingCode}] Xac nhan dat phong tai ${propertyName}`
  const text = `Xac nhan dat phong: ${bookingCode}\nKhach san: ${propertyName}\nNgay: ${data.checkIn} - ${data.checkOut}`
  return send({ email: guestEmail, name: guestName }, subject, text, text)
}

// ============================================
//  Owner new-booking notification
// ============================================

export interface OwnerNewBookingData {
  ownerEmail: string
  ownerName?: string
  bookingCode: string
  guestName: string
  guestPhone: string
  guestEmail: string
  propertyName: string
  checkIn: string
  checkOut: string
  totalAmount: number
  currency?: string
  manageUrl: string
}

export async function sendOwnerNewBooking(
  data: OwnerNewBookingData
): Promise<SendResult> {
  const subject = `Don dat phong moi #${data.bookingCode} - ${data.propertyName}`
  const text = `Don dat phong: ${data.bookingCode}\nKhach: ${data.guestName}\nNgay: ${data.checkIn} - ${data.checkOut}`
  return send({ email: data.ownerEmail, name: data.ownerName }, subject, text, text)
}

// ============================================
//  Workspace invitation
// ============================================

export interface WorkspaceInviteData {
  recipientEmail: string
  recipientName?: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresAt: Date
}

export async function sendWorkspaceInvite(
  data: WorkspaceInviteData
): Promise<SendResult> {
  const subject = `${data.inviterName} moi ban tham gia ${data.workspaceName}`
  const text = `Loi moi tu: ${data.inviterName}\nWorkspace: ${data.workspaceName}\nVai tro: ${data.role}`
  return send({ email: data.recipientEmail, name: data.recipientName }, subject, text, text)
}

// ============================================
//  Invoice email
// ============================================

export interface InvoiceEmailData {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  bookingCode: string
  propertyName: string
  totalAmount: number
  taxAmount: number
  pdfUrl: string
  xmlUrl?: string
  currency?: string
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<SendResult> {
  const subject = `[${data.invoiceNumber}] Hoa don tu ${data.propertyName}`
  const text = `Hoa don: ${data.invoiceNumber}\nBooking: ${data.bookingCode}\nSo tien: ${data.totalAmount}`
  return send({ email: data.customerEmail, name: data.customerName }, subject, text, text)
}
