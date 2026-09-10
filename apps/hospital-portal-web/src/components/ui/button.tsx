'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  controlDensityButtonClass,
  type ControlDensity,
} from '@/lib/layout/control-density'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-ring disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-sm hover:shadow-md',
        secondary: 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 active:bg-gray-100',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-50 active:bg-gray-100',
        danger: 'bg-status-critical text-white hover:bg-red-600 active:bg-red-700 shadow-sm hover:shadow-md',
        success: 'bg-status-success text-white hover:bg-green-600 active:bg-green-700 shadow-sm',
        outline: 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
        link: 'bg-transparent underline-offset-4 hover:underline text-emerald-600 hover:text-emerald-700',
        // Legacy variants for backward compatibility
        default: 'bg-primary-500 text-white hover:bg-primary-600',
        destructive: 'bg-status-critical text-white hover:bg-red-600',
        subtle: 'bg-primary-100 text-primary-900 hover:bg-primary-200',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        // Legacy sizes for backward compatibility
        default: 'h-10 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  'aria-label'?: string
  /**
   * Opt-in only. `workstation` uses --control-height-workstation (40px ≥1600, 36px <1600)
   * for md/default sizes. Does not change default Button md globally.
   */
  density?: ControlDensity
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      density = 'default',
      asChild = false,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(
          buttonVariants({ variant, size }),
          controlDensityButtonClass(density, size),
          className,
        )}
        ref={ref}
        data-control-density={density}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
