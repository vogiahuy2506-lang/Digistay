/**
 * Auto-issue the moment a booking is fully paid (task 38). The scheduled job
 * used to be the only way, so a guest could wait up to 10 minutes for the
 * invoice; UKNOW issues when the payment is recorded and keeps its job for
 * retries, and so do we now.
 *
 * syncBookingPayments() (src/lib/payments/booking-payments.ts), which every
 * path that records money calls (PayOS webhook / reconcile, staff cash and
 * confirmations, check-out...), calls this when the booking turns PAID.
 * Right after the response, jobs.ts autoIssueBooking() issues the invoice if
 * the hotel has auto-issue on, then emails it. The transaction that recorded
 * the payment has committed by then; if it rolled back, the booking is not
 * PAID and nothing happens.
 *
 * Outside a request (scripts, tests) there is no "after the response": the
 * job issues it on its next run. The Mắt Bão code is imported only when it
 * runs, so the payment code does not load it.
 */
import { after } from 'next/server'

export function autoIssueAfterResponse(bookingId: string) {
  try {
    after(async () => {
      try {
        const { autoIssueBooking } = await import('./jobs')
        await autoIssueBooking(bookingId)
      } catch (error) {
        // The job tries again; the reason of a refused invoice is on it for staff.
        console.error('[einvoice] auto-issue after payment failed:', error)
      }
    })
  } catch {
    // Not in a request: jobs.ts picks it up.
  }
}
