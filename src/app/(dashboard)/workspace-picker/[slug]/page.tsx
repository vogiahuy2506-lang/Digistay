import { redirect } from 'next/navigation'

/** See ../layout.tsx: the list of workspaces. */
export default function WorkspacePickerPage(): never {
  redirect('/workspaces')
}
