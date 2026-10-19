'use client'

import * as React from 'react'

export interface MaterialSymbolProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string
  size?: number | string
  filled?: boolean
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
  grade?: -25 | 0 | 200
  opticalSize?: 20 | 24 | 40 | 48
  className?: string
}

/**
 * Material Symbol (outlined) icon.
 * Uses Google's Material Symbols font — no extra bundle.
 */
export const MaterialSymbol = React.forwardRef<SVGSVGElement, MaterialSymbolProps>(
  ({ name, size = 24, filled = false, weight = 400, grade = 0, opticalSize = 24, className, style, ...rest }, ref) => {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={`material-symbols-outlined ${className ?? ''}`}
        style={{
          fontSize: typeof size === 'number' ? `${size}px` : size,
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
          userSelect: 'none',
          lineHeight: 1,
          ...style,
        }}
        aria-hidden="true"
        {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {name}
      </span>
    )
  }
)

MaterialSymbol.displayName = 'MaterialSymbol'

export default MaterialSymbol
