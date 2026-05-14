import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center space-x-2 text-sm', className)}>
      <Link
        href="/dashboard"
        className="text-gray-500 hover:text-emerald-600 transition-colors duration-150"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        
        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
            
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-gray-600 hover:text-emerald-600 transition-colors duration-150"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'font-medium',
                  isLast ? 'text-emerald-700' : 'text-gray-600'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

Breadcrumb.displayName = 'Breadcrumb'

export { Breadcrumb }
