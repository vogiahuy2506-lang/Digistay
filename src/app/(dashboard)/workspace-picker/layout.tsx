import { redirect } from 'next/navigation'

// An old address of the workspace home: every /workspace-picker URL goes to
// the list of workspaces, as it always did (this layout sits above [slug], so
// Next never passed it a slug and it redirected before rendering anything).
export default function WorkspacePickerLayout(): never {
  redirect('/workspaces')
}
