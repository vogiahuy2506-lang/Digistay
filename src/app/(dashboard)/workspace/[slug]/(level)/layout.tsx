import { PageContainer } from '@/components/layout'

/**
 * The workspace level (the property list, members, the plan, settings): the
 * property pages' column inside the shared sidebar frame (../layout.tsx).
 */
export default function WorkspaceLevelLayout({ children }: { children: React.ReactNode }) {
  return <PageContainer>{children}</PageContainer>
}
