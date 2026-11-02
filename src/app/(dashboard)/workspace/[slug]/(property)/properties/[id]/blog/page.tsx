'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header, PageContainer } from '@/components/layout'
import { useCan } from '@/components/layout/workspace-context'
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
        toast.error('Lỗi tải bài viết', apiError(data.error))
      }
    } catch {
      toast.error('Lỗi kết nối', 'Không thể tải danh sách bài viết')
    } finally {
      setLoading(false)
    }
  }, [propertyId, search, status])

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
        toast.success(isNew ? 'Đã tạo bài viết mới' : 'Đã lưu thay đổi bài viết')
        setEditing(null)
        fetchPosts()
      } else {
        setFormError(apiError(data.error) || 'Không thể lưu bài viết')
      }
    } catch {
      setFormError('Lỗi kết nối khi lưu bài viết')
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
        toast.success(post.isPublished ? 'Đã chuyển thành bản nháp' : 'Đã xuất bản bài viết')
        fetchPosts()
      } else {
        toast.error('Thất bại', apiError(data.error))
      }
    } catch {
      toast.error('Lỗi kết nối', 'Không thể đổi trạng thái bài viết')
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
        toast.success('Đã xóa bài viết')
        setDeleting(null)
        fetchPosts()
      } else {
        toast.error('Lỗi khi xóa', apiError(data.error))
      }
    } catch {
      toast.error('Lỗi kết nối', 'Không thể xóa bài viết')
    } finally {
      setDeletingBusy(false)
    }
  }

  const publishedCount = React.useMemo(() => posts?.filter((p) => p.isPublished).length ?? 0, [posts])
  const draftCount = React.useMemo(() => posts?.filter((p) => !p.isPublished).length ?? 0, [posts])

  return (
    <PageContainer>
      <Header
        title="Bài viết & Tin tức"
        description="Đăng tải bài viết giới thiệu món ăn ngon, cẩm nang du lịch và điểm đến xung quanh khách sạn."
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
                Xem trang Blog
                <ExternalLink className="w-3.5 h-3.5 text-muted ml-0.5" />
              </a>
            )}
            {canEdit && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4 mr-1.5" />
                Viết bài mới
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
              Tất cả
              <span className="ml-1.5 text-xs text-muted tabular-nums">{posts?.length ?? 0}</span>
            </TabsTrigger>
            <TabsTrigger value="published">
              Đã xuất bản
              <span className="ml-1.5 text-xs text-muted tabular-nums">{publishedCount}</span>
            </TabsTrigger>
            <TabsTrigger value="draft">
              Bản nháp
              <span className="ml-1.5 text-xs text-muted tabular-nums">{draftCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="sm:w-72">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, đường dẫn..."
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {loading ? (
        <Loading className="py-20" text="Đang tải danh sách bài viết..." />
      ) : !posts || posts.length === 0 ? (
        <div className="mt-6 rounded-box border border-line bg-panel px-6 py-16 text-center">
          <Newspaper className="mx-auto w-10 h-10 text-muted/60 mb-3" />
          <p className="text-body font-medium text-fg">Chưa có bài viết nào</p>
          <p className="mt-1 text-small text-muted">
            Đăng các bài viết về ẩm thực địa phương, cẩm nang tham quan du lịch để thu hút thêm du khách.
          </p>
          {canEdit && (
            <Button className="mt-6" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1.5" />
              Tạo bài viết đầu tiên
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
                      {post.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
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
                        <span>Tác giả: {post.authorName}</span>
                      </>
                    )}
                    <span className="w-1 h-1 rounded-full bg-muted/60" />
                    <span>
                      {post.publishedAt
                        ? `Ngày đăng: ${new Date(post.publishedAt).toLocaleDateString('vi-VN')}`
                        : `Tạo ngày: ${new Date(post.createdAt).toLocaleDateString('vi-VN')}`}
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
                    title="Xem trên trang công khai"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem
                  </a>
                )}

                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(post)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Sửa
                  </Button>
                )}

                {canEdit && (
                  <Dropdown
                    align="right"
                    trigger={
                      <button
                        type="button"
                        className="w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                  >
                    <DropdownItem onClick={() => togglePublish(post)}>
                      {post.isPublished ? 'Chuyển về bản nháp' : 'Xuất bản bài viết'}
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem danger icon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleting(post)}>
                      Xóa bài viết
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
        title={editing === 'new' ? 'Viết bài mới' : 'Chỉnh sửa bài viết'}
      >
        <ModalHeader onClose={() => !saving && setEditing(null)}>
          <h2 className="text-lg font-semibold text-fg">
            {editing === 'new' ? 'Viết bài blog & tin tức mới' : 'Chỉnh sửa bài viết'}
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
                Tiêu đề bài viết <span className="text-err">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="VD: Top 5 quán ăn ngon gần khách sạn không thể bỏ lỡ"
                required
              />
            </div>

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                Đường dẫn tĩnh (Slug URL) <span className="text-err">*</span>
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
                <label className="block text-small font-medium text-fg mb-1.5">Tác giả bài viết</label>
                <Input
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  placeholder="VD: Lễ tân khách sạn / Ban quản lý"
                />
              </div>
              <div>
                <label className="block text-small font-medium text-fg mb-1.5">Ảnh bìa (Cover Image)</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.coverImage}
                    onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                    placeholder="https://... hoặc tải ảnh lên"
                    className="flex-1 text-small"
                  />
                  <PhotoUploadButton
                    target={{ propertyId }}
                    onUploaded={(url) => setForm({ ...form, coverImage: url })}
                    label="Tải ảnh"
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
                  className="absolute top-2 right-2 px-2 py-1 bg-black/70 hover:bg-black text-white text-xs rounded-sm backdrop-blur"
                >
                  Gỡ ảnh
                </button>
              </div>
            )}

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                Đoạn tóm tắt ngắn (Summary)
              </label>
              <Textarea
                rows={2}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Đoạn văn ngắn 1-2 câu tóm tắt nội dung bài viết hiển thị ở danh sách bài và thẻ chia sẻ mạng xã hội."
              />
            </div>

            <div>
              <label className="block text-small font-medium text-fg mb-1.5">
                Nội dung bài viết <span className="text-err">*</span>
              </label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Soạn nội dung chi tiết bài viết ở đây. Bạn có thể xuống dòng, chia đoạn văn bản hoặc dán nội dung từ tài liệu."
                required
              />
              <p className="mt-1 text-xs text-muted">
                Hỗ trợ định dạng văn bản tự nhiên, ngắt dòng thành các đoạn và chèn link.
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
                  Xuất bản ngay lên website công khai của cơ sở
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
                {showSeo ? 'Ẩn cấu hình SEO nâng cao ▲' : 'Tuỳ chỉnh thẻ SEO & Mạng xã hội ▼'}
              </button>

              {showSeo && (
                <div className="mt-3 p-3.5 rounded-ctl border border-line bg-page/60 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-fg mb-1">
                      Tiêu đề SEO (Meta Title)
                    </label>
                    <Input
                      value={form.metaTitle}
                      onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                      placeholder="Mặc định lấy theo tiêu đề bài viết"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg mb-1">
                      Mô tả SEO (Meta Description)
                    </label>
                    <Textarea
                      rows={2}
                      value={form.metaDescription}
                      onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                      placeholder="Mặc định lấy theo đoạn tóm tắt bài viết"
                    />
                  </div>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Huỷ
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing === 'new' ? 'Tạo bài viết' : 'Lưu thay đổi'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal isOpen={deleting !== null} onClose={() => !deletingBusy && setDeleting(null)} size="sm" title="Xóa bài viết">
        <ModalHeader onClose={() => !deletingBusy && setDeleting(null)}>
          <h2 className="text-lg font-semibold text-fg">Xóa bài viết?</h2>
        </ModalHeader>
        <ModalBody>
          <p className="text-body text-fg/80">
            Bạn có chắc chắn muốn xóa bài viết <b>&ldquo;{deleting?.title}&rdquo;</b>? Bài viết sẽ được gỡ khỏi trang công khai.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={deletePost} isLoading={deletingBusy}>
            Xóa bài viết
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
