import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ status?: string; cancel?: string }>
}

export const dynamic = 'force-dynamic'

/**
 * Where PayOS sends the guest back after paying or cancelling (Part 5).
 * Display only: the query string is set by the guest's browser and never
 * marks anything paid; the hotel learns about the money from the webhook.
 */
export default async function PaymentReturnPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const { status, cancel } = await searchParams

  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: { name: true, phone: true, websiteSettings: { select: { primaryColor: true } } },
  })
  if (!property) notFound()

  const cancelled = cancel === 'true' || status === 'CANCELLED'
  const color = property.websiteSettings?.primaryColor ?? '#3B82F6'

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {cancelled ? 'Bạn đã huỷ thanh toán' : 'Cảm ơn bạn đã thanh toán'}
        </h1>
        <p className="text-gray-600">
          {cancelled
            ? `Chưa có khoản tiền nào được chuyển. Nếu cần, hãy liên hệ ${property.name} để nhận lại link thanh toán.`
            : `${property.name} sẽ xác nhận ngay khi nhận được tiền. Bạn không cần làm gì thêm.`}
        </p>
        {property.phone && <p className="text-sm text-gray-500">Liên hệ khách sạn: {property.phone}</p>}
        <Link
          href={`/${subdomain}`}
          className="inline-block mt-2 px-5 py-2.5 rounded-lg text-white font-medium"
          style={{ backgroundColor: color }}
        >
          Về trang khách sạn
        </Link>
      </div>
    </main>
  )
}
