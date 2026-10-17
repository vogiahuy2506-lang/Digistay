import { emailLayout } from './_layout'

interface Props {
  recipientEmail: string
  recipientName?: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresAt: Date
  siteUrl: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  RECEPTIONIST: 'Lễ tân',
  USER: 'Nhân viên',
}

export function renderWorkspaceInvite(p: Props): string {
  const roleLabel = ROLE_LABELS[p.role] ?? p.role
  const expiresStr = new Date(p.expiresAt).toLocaleDateString('vi-VN')

  const body = `
    <h1 style="margin: 0 0 16px; font-size: 24px;">Lời mời tham gia Workspace</h1>
    <p>Xin chào${p.recipientName ? ` <strong>${escapeHtml(p.recipientName)}</strong>` : ''},</p>
    <p><strong>${escapeHtml(p.inviterName)}</strong> đã mời bạn tham gia workspace <strong>${escapeHtml(p.workspaceName)}</strong> trên Digistay với vai trò <strong>${roleLabel}</strong>.</p>

    <p style="color: #6b7280; font-size: 14px;">Lời mời có hiệu lực đến <strong>${expiresStr}</strong>.</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${p.inviteUrl}" class="btn">Chấp nhận lời mời</a>
    </div>

    <p style="color: #6b7280; font-size: 13px;">Nếu bạn không mong đợi email này, vui lòng bỏ qua.</p>
  `

  return emailLayout({
    title: `Lời mời tham gia ${p.workspaceName}`,
    preheader: `${p.inviterName} mời bạn vào ${p.workspaceName}`,
    body,
    siteUrl: p.siteUrl,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
