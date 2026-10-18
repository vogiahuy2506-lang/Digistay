/**
 * Cloudinary Upload Service (Stub)
 * Handles image uploads with automatic optimization
 * Note: Install cloudinary package and configure environment variables
 */

export interface UploadResult {
  success: boolean
  url?: string
  publicId?: string
  thumbnailUrl?: string
  width?: number
  height?: number
  format?: string
  error?: string
}

export interface UploadOptions {
  folder?: string
  resourceType?: 'image' | 'video' | 'raw'
  maxFileSize?: number
  /**
   * Optional transformation parameters. Kept loose on purpose — this
   * module is a stub right now, and we don't want to pin callers to
   * the full Cloudinary shape until the real implementation lands.
   */
  transformation?: Record<string, unknown>
}

/**
 * Upload image (stub implementation)
 */
export async function uploadImage(
  file: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  console.warn('Cloudinary not configured. Image upload is a stub.')
  
  // In production, this would upload to Cloudinary
  // For now, return the base64 data URL
  if (typeof file === 'string' && file.startsWith('data:')) {
    return {
      success: true,
      url: file,
      publicId: `stub_${Date.now()}`,
    }
  }
  
  return {
    success: false,
    error: 'Cloudinary not configured',
  }
}

/**
 * Upload image and generate thumbnail (stub implementation)
 */
export async function uploadImageWithThumbnail(
  file: string,
  options: UploadOptions = {}
): Promise<UploadResult & { thumbnailUrl?: string }> {
  const result = await uploadImage(file, options)
  return {
    ...result,
    thumbnailUrl: result.url,
  }
}

/**
 * Delete image (stub implementation)
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  console.warn('Cloudinary not configured. Delete is a stub.')
  return true
}

/**
 * Delete multiple images (stub implementation)
 */
export async function deleteImages(publicIds: string[]): Promise<boolean> {
  console.warn('Cloudinary not configured. Delete is a stub.')
  return true
}

/**
 * Get image URL with transformations (stub implementation)
 */
export function getTransformedImageUrl(
  publicId: string,
  transformations?: any
): string {
  return publicId
}

/**
 * Validate file type
 */
export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
  ]
  return allowedTypes.includes(mimeType)
}

/**
 * Validate file size
 */
export function isValidImageSize(size: number, maxMB: number = 10): boolean {
  return size <= maxMB * 1024 * 1024
}
