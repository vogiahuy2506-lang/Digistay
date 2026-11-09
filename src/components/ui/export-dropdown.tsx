'use client'

import * as React from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { Button } from './button'
import { Dropdown, DropdownItem } from './dropdown'

export interface ExportDropdownProps {
  onExportExcel: () => void | Promise<void>
  onExportCsv: () => void | Promise<void>
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  className?: string
}

export function ExportDropdown({
  onExportExcel,
  onExportCsv,
  disabled = false,
  label = 'Xuất dữ liệu',
  size = 'sm',
  variant = 'outline',
  className,
}: ExportDropdownProps) {
  const [loading, setLoading] = React.useState(false)

  const handleExcel = async () => {
    try {
      setLoading(true)
      await onExportExcel()
    } finally {
      setLoading(false)
    }
  }

  const handleCsv = async () => {
    try {
      setLoading(true)
      await onExportCsv()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dropdown
      align="right"
      trigger={
        <Button
          variant={variant}
          size={size}
          disabled={disabled || loading}
          className={`flex items-center gap-1.5 ${className || ''}`}
        >
          <Download className="w-4 h-4" />
          <span>{label}</span>
          <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
        </Button>
      }
    >
      <DropdownItem onClick={handleExcel} className="flex items-center gap-2 cursor-pointer">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <span>Xuất file Excel (.xls)</span>
      </DropdownItem>
      <DropdownItem onClick={handleCsv} className="flex items-center gap-2 cursor-pointer">
        <FileText className="w-4 h-4 text-blue-600" />
        <span>Xuất file CSV (.csv)</span>
      </DropdownItem>
    </Dropdown>
  )
}
