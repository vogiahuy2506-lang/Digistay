import { redirect } from 'next/navigation'

/** /admin opens on the customers. */
export default function AdminHome() {
  redirect('/admin/customers')
}
