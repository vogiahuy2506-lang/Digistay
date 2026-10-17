import {
  Wifi,
  Car,
  Utensils,
  Waves,
  Dumbbell,
  Coffee,
  Sun,
  Shield,
  Tv,
  Wind,
  Snowflake,
  Bath,
  Briefcase,
  Music,
  Phone,
  Users,
  PawPrint,
  Wine,
  GlassWater,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/**
 * Maps a stored icon name (e.g. "wifi", "pool") to a Lucide icon.
 * Falls back to Sparkles for unknown names.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  car: Car,
  parking: Car,
  restaurant: Utensils,
  food: Utensils,
  pool: Waves,
  swimming: Waves,
  gym: Dumbbell,
  fitness: Dumbbell,
  coffee: Coffee,
  bar: Coffee,
  spa: Sun,
  security: Shield,
  tv: Tv,
  television: Tv,
  ac: Wind,
  aircon: Wind,
  'air-conditioner': Snowflake,
  bathtub: Bath,
  bath: Bath,
  work: Briefcase,
  business: Briefcase,
  music: Music,
  karaoke: Music,
  phone: Phone,
  pets: PawPrint,
  'pet-friendly': PawPrint,
  bar2: Wine,
  drinks: GlassWater,
  default: Sparkles,
}

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Sparkles
  const key = name.toLowerCase().trim()
  return ICON_MAP[key] ?? ICON_MAP.default
}
