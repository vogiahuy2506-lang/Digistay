import type { PublicBlock, PublicProperty } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function FooterBlock({ property }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-gray-900 text-white py-10">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-gray-300 text-lg font-semibold mb-2">{property.name}</p>
        <p className="text-gray-400 text-sm mb-1">{property.address}, {property.city}</p>
        {property.phone && <p className="text-gray-400 text-sm">ĐT: {property.phone}</p>}
        <p className="text-gray-500 text-xs mt-6">
          © {year} {property.name}. Tất cả quyền được bảo lưu.
        </p>
        <p className="text-gray-600 text-xs mt-2">Powered by Digistay</p>
      </div>
    </footer>
  )
}
