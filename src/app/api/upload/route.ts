import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadImage, uploadImageWithThumbnail, isValidImageType, isValidImageSize } from '@/lib/cloudinary'
import { prisma } from '@/lib/db'
import { invalidatePublicSite } from '@/lib/public-site/site'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * POST /api/upload
 * Upload image to Cloudinary
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      base64, 
      folder = 'digistay',
      propertyId,
      isThumbnail = false 
    } = body

    if (!base64) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp hình ảnh' },
        { status: 400 }
      )
    }

    // Validate base64 format
    const base64Regex = /^data:image\/\w+;base64,/
    const base64Data = base64Regex.test(base64) 
      ? base64 
      : `data:image/jpeg;base64,${base64}`

    // Extract mime type
    const mimeMatch = base64Data.match(/^data:(\w+\/[\w+]+);base64/)
    if (!mimeMatch) {
      return NextResponse.json(
        { success: false, error: 'Định dạng hình ảnh không hợp lệ' },
        { status: 400 }
      )
    }

    const mimeType = mimeMatch[1]
    if (!isValidImageType(mimeType)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ chấp nhận file JPG, PNG, GIF, WebP, AVIF, SVG' },
        { status: 400 }
      )
    }

    // Check file size (estimate: base64 is ~33% larger than actual)
    const base64Length = base64Data.length - (base64Data.indexOf(',') + 1)
    const estimatedSize = Math.ceil(base64Length * 0.75)
    if (!isValidImageSize(estimatedSize, 10)) {
      return NextResponse.json(
        { success: false, error: 'Kích thước file không được vượt quá 10MB' },
        { status: 400 }
      )
    }

    // Upload to Cloudinary
    const uploadFolder = folder.includes('/') ? folder : `digistay/${folder}`
    
    let result
    if (isThumbnail) {
      result = await uploadImageWithThumbnail(base64Data, { folder: uploadFolder })
    } else {
      result = await uploadImage(base64Data, { folder: uploadFolder })
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }

    // If propertyId provided, also create PropertyImage record
    if (propertyId) {
      // Verify user has access to property
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id } } },
            ],
          },
        },
        select: { id: true, workspaceId: true },
      })

      if (property) {
        await prisma.propertyImage.create({
          data: {
            propertyId,
            url: result.url!,
            thumbnail: result.thumbnailUrl || result.url,
            isPrimary: false,
          },
        })
        invalidatePublicSite(propertyId)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height,
        format: result.format,
      },
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải lên hình ảnh' },
      { status: 500 }
    )
  }
}
