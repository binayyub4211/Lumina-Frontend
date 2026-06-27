'use client'

type SkeletonTextWidth = 'sm' | 'md' | 'lg' | 'full'

export interface SkeletonTextProps {
  lines?: number
  width?: SkeletonTextWidth
  className?: string
}

const widthClass: Record<SkeletonTextWidth, string> = {
  sm: 'skeleton-text--sm',
  md: 'skeleton-text--md',
  lg: 'skeleton-text--lg',
  full: 'skeleton-text--full',
}

export function SkeletonText({ lines = 3, width = 'lg', className = '' }: SkeletonTextProps) {
  return (
    <div className={`${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`skeleton skeleton-text ${i === lines - 1 ? widthClass[width] : 'skeleton-text--full'}`}
        />
      ))}
    </div>
  )
}
