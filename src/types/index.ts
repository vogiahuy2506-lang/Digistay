import 'next-auth'
import { UserRole, WorkspaceRole, PropertyType, BedType } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
  }
}

// Re-export Prisma types for convenience
export type { UserRole, WorkspaceRole, PropertyType, BedType }

// Simple Property type for workspace listing
export interface SimpleProperty {
  id: string
  name: string
  slug: string
  type: PropertyType
  address: string
  city: string
  subdomain: string
  isActive: boolean
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Extended Types with Relations
export interface WorkspaceWithMembers {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  domain: string | null
  ownerId: string
  settings: Record<string, unknown>
  members: WorkspaceMemberWithUser[]
  properties: SimpleProperty[]
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceMemberWithUser {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export interface PropertyWithDetails {
  id: string
  workspaceId: string
  name: string
  slug: string
  type: PropertyType
  address: string
  city: string
  district: string | null
  ward: string | null
  country: string
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
  logo: string | null
  coverImage: string | null
  description: string | null
  subdomain: string
  isActive: boolean
  roomTypes: RoomTypeWithDetails[]
  amenities: Amenity[]
  images: PropertyImage[]
  pricing: PricingConfig[]
  createdAt: Date
  updatedAt: Date
}

export interface RoomTypeWithDetails {
  id: string
  propertyId: string
  name: string
  slug: string
  description: string | null
  area: number | null
  bedType: BedType
  maxAdults: number
  maxChildren: number
  totalRooms: number
  availableRooms: number
  baseOccupancy: number
  maxOccupancy: number
  isActive: boolean
  images: RoomTypeImage[]
  amenities: Amenity[]
  pricing: RoomTypePricing[]
  createdAt: Date
  updatedAt: Date
}

export interface Amenity {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string
}

export interface PropertyImage {
  id: string
  propertyId: string
  url: string
  thumbnail: string | null
  alt: string | null
  category: string | null
  width: number | null
  height: number | null
  size: number | null
  isPrimary: boolean
  sortOrder: number
  createdAt: Date
}

export interface RoomTypeImage {
  id: string
  roomTypeId: string
  url: string
  thumbnail: string | null
  alt: string | null
  isPrimary: boolean
  sortOrder: number
  createdAt: Date
}

export interface PricingConfig {
  id: string
  propertyId: string
  name: string
  weekdayPrice: number
  weekendPrice: number
  extraAdultPrice: number
  extraChildPrice: number
  hourlyPrice: number | null
  minHours: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface RoomTypePricing {
  id: string
  roomTypeId: string
  pricingId: string
  weekdayPrice: number
  weekendPrice: number
  extraAdultPrice: number
  extraChildPrice: number
  createdAt: Date
  updatedAt: Date
}

// Form Types for UI
export interface CreatePropertyFormData {
  name: string
  type: PropertyType
  address: string
  city: string
  district?: string
  ward?: string
  country: string
  postalCode?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  subdomain: string
}

export interface CreateRoomTypeFormData {
  name: string
  description?: string
  area?: number
  bedType: BedType
  maxAdults: number
  maxChildren: number
  totalRooms: number
  baseOccupancy: number
  maxOccupancy: number
  amenityIds?: string[]
}

export interface CreatePricingFormData {
  name: string
  weekdayPrice: number
  weekendPrice: number
  extraAdultPrice?: number
  extraChildPrice?: number
  hourlyPrice?: number
  minHours?: number
}

export interface CreatePolicyFormData {
  checkInTime: string
  checkOutTime: string
  cancellationHours?: number
  cancellationPolicy?: string
  childrenAllowed: boolean
  minChildAge: number
  petsAllowed: boolean
  smokingAllowed: boolean
  additionalRules?: string
}

// Dashboard Stats
export interface DashboardStats {
  totalProperties: number
  totalRooms: number
  activeRooms: number
  occupancyRate: number
  totalRevenue: number
  pendingBookings: number
  recentActivities: Activity[]
}

export interface Activity {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string | null
  userName: string | null
  changes: Record<string, unknown> | null
  createdAt: Date
}

// Breadcrumb Types
export interface Breadcrumb {
  label: string
  href?: string
}

// Filter & Sort Types
export interface FilterOptions {
  search?: string
  type?: PropertyType
  status?: 'active' | 'inactive'
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}
