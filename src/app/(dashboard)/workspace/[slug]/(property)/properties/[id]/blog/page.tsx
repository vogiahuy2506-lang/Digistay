'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header, PageContainer } from '@/components/layout'
import { useCan } from '@/components/layout/workspace-context'
import { useLocale, useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Input,
  Loading,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { apiError } from '@/lib/i18n/api-errors'
import { cleanPostSlug, finishPostSlug, slugFromTitle } from '@/lib/marketing/blog'
import { routes } from '@/lib/utils/routes'
import {
  ArrowRight,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  MoreVertical,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import Image from 'next/image'

interface BlogPost {
  id: string
  title: string
  slug: string
  summary: string | null
  content: string
  coverImage: string | null
  isPublished: boolean
  publishedAt: string | null
  authorName: string | null
  metaTitle: string | null
  metaDescription: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  title: string
  slug: string
  slugEdited: boolean
  summary: string
  content: string
  coverImage: string
  isPublished: boolean
  authorName: string
  metaTitle: string
  metaDescription: string
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  slugEdited: false,
  summary: '',
  content: '',
  coverImage: '',
  isPublished: true,
  authorName: '',
  metaTitle: '',
  metaDescription: '',
}

export default function BlogManagementPage() {
  const { slug, id: propertyId } = useParams<{ slug: string; id: string }>()
  const canEdit = useCan('property_edit')
  const t = useTranslations('dash.blog')
  const locale = useLocale()

  const [posts, setPosts] = React.useState<BlogPost[] | null>(null)
  const [subdomain, setSubdomain] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<'all' | 'published' | 'draft'>('all')

  const [editing, setEditing] = React.useState<BlogPost | 'new' | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState('')
  const [showSeo, setShowSeo] = React.useState(false)

  const [deleting, setDeleting] = React.useState<BlogPost | null>(null)
  const [deletingBusy, setDeletingBusy] = React.useState(false)

  const fetchPosts = React.useCallback(async () => {
    try {
      const sp = new URLSearchParams()
      if (search.trim()) sp.set('q', search.trim())
      if (status !== 'all') sp.set('status', status)
      const res = await fetch(`/api/properties/${propertyId}/blog?${sp}`)
      const data = await res.json()
      if (data.success) {
        setPosts(data.data)
      } else {
        toast.error(t('toasts.loadFailed'), apiError(data.error))
      }
    } catch {
      toast.error(t('toasts.networkError'), t('toasts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [propertyId, search, status, t])

  // Lấy subdomain của property để tạo link xem thử
  React.useEffect(() => {
    fetch(`/api/properties/${propertyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.subdomain) {
          setSubdomain(d.data.subdomain)
        }
      })
      .catch(() => {})
  }, [propertyId])

  React.useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowSeo(false)
    setEditing('new')
  }

  const openEdit = (post: BlogPost) => {
    setForm({
      title: post.title,
      slug: post.slug,
      slugEdited: true,
      summary: post.summary ?? '',
      content: post.content,
      coverImage: post.coverImage ?? '',
      isPublished: post.isPublished,
      authorName: post.authorName ?? '',
      metaTitle: post.metaTitle ?? '',
      metaDescription: post.metaDescription ?? '',
    })
    setFormError('')
    setShowSeo(Boolean(post.metaTitle || post.metaDescription))
    setEditing(post)
  }

  const onTitleChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      title: val,
      slug: prev.slugEdited ? prev.slug : slugFromTitle(val),
    }))
  }

  const onSlugChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      slug: cleanPostSlug(val),
      slugEdited: val.trim() !== '',
    }))
  }

  const savePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')

    const payload = {
      title: form.title.trim(),
      slug: finishPostSlug(form.slug.trim()) || slugFromTitle(form.title),
      summary: form.summary.trim() || null,
      content: form.content.trim(),
      coverImage: form.coverImage.trim() || null,
      isPublished: form.isPublished,
      authorName: form.authorName.trim() || null,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
    }

    try {
      const isNew = editing === 'new'
      const url = isNew
        ? `/api/properties/${propertyId}/blog`
        : `/api/properties/${propertyId}/blog/${(editing as BlogPost).id}`
      const method = isNew ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(isNew ? t('toasts.created') : t('toasts.saved'))
        setEditing(null)
        fetchPosts()
      } else {
        setFormError(apiError(data.error) || t('toasts.saveFailed'))
      }
    } catch {
      setFormError(t('toasts.networkError'))
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !post.isPublished }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(post.isPublished ? t('toasts.toDraft') : t('toasts.toPublished'))
        fetchPosts()
      } else {
        toast.error(t('toasts.statusFailed'), apiError(data.error))
      }
    } catch {
      toast.error(t('toasts.networkError'), t('toasts.statusFailed'))
    }
  }

  const deletePost = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/blog/${deleting.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success(t('toasts.deleted'))
        setDeleting(null)
        fetchPosts()
      } else {
        toast.error(t('toasts.deleteFailed'), apiError(data.error))
      }
    } catch {
      toast.error(t('toasts.networkError'), t('toasts.deleteFailed'))
    } finally {
      setDeletingBusy(false)
    }
  }

  const publishedCount = React.useMemo(() => posts?.filter((p) => p.isPublished).length ?? 0, [posts])
  const draftCount = React.useMemo(() => posts?.filter((p) => !p.isPublished).length ?? 0, [posts])

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-2">
            {subdomain && (
              <a
                href={routes.publicBlog(subdomain)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-panel px-3 h-9 text-small font-medium text-fg hover:bg-fg/5 transition-colors duration-160"
              >
                <Globe className="w-4 h-4 text-muted" />
                {t('viewBlog')}
                <ExternalLink className="w-3.5 h-3.5 text-muted ml-0.5" />
              </a>
            )}
            {canEdit && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('newPost')}
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs & Search */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList variant="underline">
            <TabsTrigger value="all">
              {t('tabs.all')}
              <span className="ml-1.5 text-xs text-muted tabular-nums">{posts?.length ?? 0}</span>
            </TabsTrigger>
            <TabsTrigger value="published">
              {t('tabs.published')}
              <span className="ml-1.5 text-xs text-muted tabular-nums">{publishedCount}</span>
            </TabsTrigger>
            <TabsTrigger value="draft">
              {t('tabs.draft')}
              <span className="ml-1.5 text-xs text-muted tabular-nums">{draftCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="sm:w-72">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {loading ? (
        <Loading className="py-20" text={t('loading')} />
      ) : !posts || posts.length === 0 ? (
        <div className="mt-6 rounded-box border border-line bg-panel px-6 py-16 text-center">
          <Newspaper className="mx-auto w-10 h-10 text-muted/60 mb-3" />
          <p className="text-body font-medium text-fg">{t('empty.title')}</p>
          <p className="mt-1 text-small text-muted">{t('empty.text')}</p>
          {canEdit && (
            <Button className="mt-6" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t('empty.action')}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 divide-y divide-line border-t border-b border-line bg-panel/50 rounded-box overflow-hidden">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-panel transition-colors">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {post.coverImage ? (
                  <div className="relative w-20 h-14 rounded-ctl overflow-hidden shrink-0 border border-line bg-page">
                    <Image src={post.coverImage} alt={post.title} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-14 rounded-ctl flex items-center justify-center shrink-0 border border-line bg-fg/5 text-muted">
                    <FileText className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      onClick={() => canEdit && openEdit(post)}
                      className="text-body font-medium text-fg truncate hover:text-acc cursor-pointer"
                    >
                      {post.title}
                    </h3>
                    <Badge variant={post.isPublished ? 'ok' : 'plain'} size="sm">
                      {post.isPublished ? t('status.published') : t('status.draft')}
                    </Badge>
                  </div>

                  {post.summary && (
                    <p className="mt-1 text-small text-muted line-clamp-1">{post.summary}</p>
                  )}

                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted flex-wrap">
                    <span className="font-mono text-muted/80">/{post.slug}</span>
                    {post.authorName && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-muted/60" />
                        <span>{t('byAuthor', { name: post.authorName })}</span>
                      </>
                    )}
                    <span className="w-1 h-1 rounded-full bg-muted/60" />
                    <span>
                      {post.publishedAt
                        ? t('publishedOn', {
                            date: new Date(post.publishedAt).toLocaleDateString(
                              locale === 'en' ? 'en-US' : 'vi-VN'
                            ),
                          })
                        : t('createdOn', {
                            date: new Date(post.createdAt).toLocaleDateString(
                              locale === 'en' ? 'en-US' : 'vi-VN'
                            ),
                          })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {subdomain && post.isPublished && (
                  <a
                    href={routes.publicBlogPost(subdomain, post.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-ctl border border-line px-2.5 h-8 text-xs font-medium text-fg hover:bg-fg/5"
                    title={t('actions.viewPublicTooltip')}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {t('actions.view')}
                  </a>
                )}

                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(post)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    {t('actions.edit')}
                  </Button>
                )}

                {canEdit && (
                  <Dropdown
                    align="right"
                    trigger={
                      <button
                        type="button"
                        aria-label={t('actions.edit')}
                        className="w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                  >
                    <DropdownItem onClick={() => togglePublish(post)}>
                      {post.isPublished ? t('actions.unpublish') : t('actions.publish')}
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem danger icon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleting(post)}>
                      {t('actions.delete')}
                    </DropdownItem>
                  </Dropdown>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Soạn thảo bài viết */}
      <Modal
        isOpen={editing !== null}
        onClose={() => !saving && setEditing(null)}
        size="lg"
        title={editing === 'new' ? t('modal.newTitle') : t('modal.editTitle')}
      >
        <ModalHeader onClose={() => !saving && setEditing(null)}>
          <h2 className="text-lg font-semibold text-fg">
            {editing === 'new' ? t('modal.newHeader') : t('modal.editTitle')}
          </h2>
        </ModalHeader>
        <form onSubmit={savePost}>
          <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">
            {formError && (
              <div className="p-3 rounded-ctl bg-err-soft text-err text-small border border-err/20">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                {t('modal.titleLabel')} <span className="text-err">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={t('modal.titlePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                {t('modal.slugLabel')} <span className="text-err">*</span>
              </label>
              <div className="flex items-center gap-1 text-small text-muted">
                <span className="shrink-0">{subdomain ? `${subdomain}.digistay.vn/blog/` : '/blog/'}</span>
                <Input
                  value={form.slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="top-5-quan-an-ngon"
                  className="font-mono text-small"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-small font-medium text-fg mb-1.5">{t('modal.authorLabel')}</label>
                <Input
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  placeholder={t('modal.authorPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-small font-medium text-fg mb-1.5">{t('modal.coverLabel')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.coverImage}
                    onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                    placeholder={t('modal.coverPlaceholder')}
                    className="flex-1 text-small"
                  />
                  <PhotoUploadButton
                    target={{ propertyId }}
                    onUploaded={(url) => setForm({ ...form, coverImage: url })}
                    label={t('modal.uploadCover')}
                  />
                </div>
              </div>
            </div>

            {form.coverImage && (
              <div className="relative w-full h-40 rounded-ctl overflow-hidden border border-line bg-page">
                <Image src={form.coverImage} alt="Cover Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, coverImage: '' })}
                  className="absolute top-2 right-2 px-2 py-1 bg-ink/80 hover:bg-ink text-on-ink text-xs rounded-sm backdrop-blur transition-colors"
                >
                  {t('modal.removeCover')}
                </button>
              </div>
            )}

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                {t('modal.summaryLabel')}
              </label>
              <Textarea
                rows={2}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={t('modal.summaryPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                {t('modal.contentLabel')} <span className="text-err">*</span>
              </label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={t('modal.contentPlaceholder')}
                required
              />
              <p className="mt-1 text-xs text-muted">
                {t('modal.contentHint')}
              </p>
            </div>

            <div className="pt-2 border-t border-line">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded border-line text-acc focus:ring-acc"
                />
                <span className="text-small font-medium text-fg">
                  {t('modal.publishImmediately')}
                </span>
              </label>
            </div>

            {/* Cấu hình SEO nâng cao */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSeo((v) => !v)}
                className="text-xs font-semibold text-acc hover:underline flex items-center gap-1"
              >
                {showSeo ? t('modal.seoToggleHide') : t('modal.seoToggleShow')}
              </button>

              {showSeo && (
                <div className="mt-3 p-3.5 rounded-ctl border border-line bg-page/60 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-fg mb-1">
                      {t('modal.metaTitleLabel')}
                    </label>
                    <Input
                      value={form.metaTitle}
                      onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                      placeholder={t('modal.metaTitlePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg mb-1">
                      {t('modal.metaDescLabel')}
                    </label>
                    <Textarea
                      rows={2}
                      value={form.metaDescription}
                      onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                      placeholder={t('modal.metaDescPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {t('modal.cancel')}
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing === 'new' ? t('modal.createSubmit') : t('modal.editSubmit')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal isOpen={deleting !== null} onClose={() => !deletingBusy && setDeleting(null)} size="sm" title={t('deleteModal.title')}>
        <ModalHeader onClose={() => !deletingBusy && setDeleting(null)}>
          <h2 className="text-lg font-semibold text-fg">{t('deleteModal.title')}</h2>
        </ModalHeader>
        <ModalBody>
          <p className="text-body text-fg/80">
            {t.rich('deleteModal.confirmText', {
              title: deleting?.title ?? '',
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
            {t('deleteModal.cancel')}
          </Button>
          <Button variant="danger" onClick={deletePost} isLoading={deletingBusy}>
            {t('deleteModal.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
