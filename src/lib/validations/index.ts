import { z } from 'zod'
import { RESERVED_SUBDOMAINS } from '@/lib/subdomains'
import { isStoredImageUrl } from '@/lib/media/image-url'

/** Minimum length for NEW passwords; existing ones keep working. */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_TOO_SHORT = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`

// Auth Validations
export const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  username: z.string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(30, 'Tên đăng nhập không quá 30 ký tự')
    .regex(/^[a-zA-Z0-9_]+$/, 'Chỉ chứa chữ, số và dấu gạch dưới'),
  email: z.string().email('Email không hợp lệ'),
  phone: z.string().optional(),
  password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
  password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu không khớp',
  path: ['confirmPassword'],
})

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  bio: z.string().max(500, 'Bio không được quá 500 ký tự').optional(),
})

// Workspace Validations
export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Tên workspace phải có ít nhất 2 ký tự').max(100, 'Tên workspace không được quá 100 ký tự'),
  description: z.string().max(500, 'Mô tả không được quá 500 ký tự').optional(),
  domain: z.string().url('Domain không hợp lệ').optional().or(z.literal('')),
  slug: z.string().min(2, 'Tên rút gọn phải có ít nhất 2 ký tự').max(100, 'Tên rút gọn không được quá 100 ký tự').regex(/^[a-z0-9-]+$/, 'Tên rút gọn chỉ chứa chữ thường, số và dấu gạch ngang').optional(),
  businessType: z.enum(['boutique_hotel', 'resort', 'homestay']).optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  logo: z.string().url('Logo phải là URL hợp lệ').optional().or(z.literal('')),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Tên workspace phải có ít nhất 2 ký tự').max(100, 'Tên workspace không được quá 100 ký tự').optional(),
  description: z.string().max(500, 'Mô tả không được quá 500 ký tự').optional(),
  domain: z.string().url('Domain không hợp lệ').optional().or(z.literal('')),
  logo: z.string().url('Logo phải là URL hợp lệ').optional().or(z.literal('')),
  businessType: z.enum(['boutique_hotel', 'resort', 'homestay']).optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
})

// Invitation Validations
export const inviteMemberSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER']),
})

// Property Validations
export const propertyTypeEnum = z.enum(['HOTEL', 'HOMESTAY', 'RESORT', 'RESTAURANT', 'VILLA', 'MOTEL', 'OTHER'])

export const createPropertySchema = z.object({
  name: z.string().min(2, 'Tên cơ sở phải có ít nhất 2 ký tự').max(200, 'Tên cơ sở không được quá 200 ký tự'),
  type: propertyTypeEnum,
  address: z.string().min(5, 'Địa chỉ phải có ít nhất 5 ký tự'),
  city: z.string().min(2, 'Thành phố phải có ít nhất 2 ký tự'),
  district: z.string().optional(),
  ward: z.string().optional(),
  country: z.string().default('Vietnam'),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  website: z.string().url('Website không hợp lệ').optional().or(z.literal('')),
  description: z.string().max(2000, 'Mô tả không được quá 2000 ký tự').optional(),
  subdomain: z
    .string()
    .min(3, 'Subdomain phải có ít nhất 3 ký tự')
    .max(50, 'Subdomain không được quá 50 ký tự')
    .regex(/^[a-z0-9-]+$/, 'Subdomain chỉ chứa chữ thường, số và dấu gạch ngang')
    .refine((s) => !s.startsWith('-') && !s.endsWith('-'), 'Subdomain không được bắt đầu hay kết thúc bằng dấu gạch ngang')
    .refine((s) => !RESERVED_SUBDOMAINS.has(s), 'Tên này dành riêng cho hệ thống, vui lòng chọn tên khác'),
})

export const updatePropertySchema = z.object({
  name: z.string().min(2, 'Tên cơ sở phải có ít nhất 2 ký tự').max(200, 'Tên cơ sở không được quá 200 ký tự').optional(),
  type: propertyTypeEnum.optional(),
  address: z.string().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').optional(),
  city: z.string().min(2, 'Thành phố phải có ít nhất 2 ký tự').optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  website: z.string().url('Website không hợp lệ').optional().or(z.literal('')),
  description: z.string().max(2000, 'Mô tả không được quá 2000 ký tự').optional(),
  isActive: z.boolean().optional(),
})

// Room Type Validations
export const bedTypeEnum = z.enum(['SINGLE', 'DOUBLE', 'TWIN', 'TRIPLE', 'QUADRUPLE', 'KING', 'QUEEN', 'SUITE', 'BUNK'])

export const createRoomTypeSchema = z.object({
  name: z.string().min(2, 'Tên hạng phòng phải có ít nhất 2 ký tự').max(100, 'Tên hạng phòng không được quá 100 ký tự'),
  description: z.string().max(1000, 'Mô tả không được quá 1000 ký tự').optional(),
  area: z.number().positive('Diện tích phải lớn hơn 0').optional(),
  bedType: bedTypeEnum,
  maxAdults: z.number().int().min(1, 'Số người lớn tối đa phải ít nhất là 1').max(10),
  maxChildren: z.number().int().min(0).max(10),
  totalRooms: z.number().int().min(1, 'Số phòng phải ít nhất là 1'),
  baseOccupancy: z.number().int().min(1).max(10).default(2),
  maxOccupancy: z.number().int().min(1).max(20),
  amenityIds: z.array(z.string()).optional(),
})

export const updateRoomTypeSchema = z.object({
  name: z.string().min(2, 'Tên hạng phòng phải có ít nhất 2 ký tự').max(100, 'Tên hạng phòng không được quá 100 ký tự').optional(),
  description: z.string().max(1000, 'Mô tả không được quá 1000 ký tự').optional(),
  area: z.number().positive('Diện tích phải lớn hơn 0').optional().nullable(),
  bedType: bedTypeEnum.optional(),
  maxAdults: z.number().int().min(1).max(10).optional(),
  maxChildren: z.number().int().min(0).max(10).optional(),
  totalRooms: z.number().int().min(1).optional(),
  baseOccupancy: z.number().int().min(1).max(10).optional(),
  maxOccupancy: z.number().int().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  amenityIds: z.array(z.string()).optional(),
})

// Pricing Validations
export const createPricingSchema = z.object({
  name: z.string().min(1, 'Tên bảng giá phải có ít nhất 1 ký tự').max(100),
  weekdayPrice: z.number().positive('Giá phải lớn hơn 0'),
  weekendPrice: z.number().positive('Giá phải lớn hơn 0'),
  extraAdultPrice: z.number().min(0).default(0),
  extraChildPrice: z.number().min(0).default(0),
  hourlyPrice: z.number().positive().optional(),
  minHours: z.number().int().positive().optional(),
})

export const updatePricingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  weekdayPrice: z.number().positive().optional(),
  weekendPrice: z.number().positive().optional(),
  extraAdultPrice: z.number().min(0).optional(),
  extraChildPrice: z.number().min(0).optional(),
  hourlyPrice: z.number().positive().optional().nullable(),
  minHours: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
})

// Policy Validations
export const createPolicySchema = z.object({
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ không hợp lệ (định dạng HH:MM)').default('14:00'),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ không hợp lệ (định dạng HH:MM)').default('12:00'),
  cancellationHours: z.number().int().positive().optional(),
  cancellationPolicy: z.string().max(2000).optional(),
  childrenAllowed: z.boolean().default(true),
  minChildAge: z.number().int().min(0).max(18).default(0),
  petsAllowed: z.boolean().default(false),
  smokingAllowed: z.boolean().default(false),
  additionalRules: z.string().max(5000).optional(),
})

export const updatePolicySchema = createPolicySchema.partial()

// Image Validations
export const uploadImageSchema = z.object({
  url: z.string().url('URL hình ảnh không hợp lệ').refine(isStoredImageUrl, 'Link ảnh phải bắt đầu bằng https://'),
  thumbnail: z.string().url('URL thumbnail không hợp lệ').refine(isStoredImageUrl, 'Link ảnh phải bắt đầu bằng https://').optional(),
  alt: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
})

// Amenity Validations
export const amenitySchema = z.object({
  name: z.string().min(1, 'Tên tiện ích phải có ít nhất 1 ký tự').max(100),
  icon: z.string().max(50).optional(),
  category: z.string().max(50).default('general'),
})

// Types
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>
export type CreatePricingInput = z.infer<typeof createPricingSchema>
export type UpdatePricingInput = z.infer<typeof updatePricingSchema>
export type CreatePolicyInput = z.infer<typeof createPolicySchema>
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>
export type UploadImageInput = z.infer<typeof uploadImageSchema>
export type AmenityInput = z.infer<typeof amenitySchema>
