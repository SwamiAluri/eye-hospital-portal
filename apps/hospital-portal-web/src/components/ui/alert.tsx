import * as React from "react"
import { cn } from "@/lib/utils"

type AlertVariant = 'default' | 'destructive' | 'warning' | 'info'

const alertVariants: Record<AlertVariant, string> = {
  default: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  destructive: 'bg-red-50 text-red-900 border-red-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  info: 'bg-sky-50 text-sky-900 border-sky-200',
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn('relative w-full rounded-xl border p-4', alertVariants[variant], className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={`mb-1 font-medium leading-none tracking-tight ${className}`}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`text-sm [&_p]:leading-relaxed ${className}`}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
