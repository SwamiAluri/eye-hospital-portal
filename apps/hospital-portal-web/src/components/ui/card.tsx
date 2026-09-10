import * as React from "react"
import { cn } from "@/lib/utils"

export type CardDensity = "responsive" | "comfortable"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hover?: boolean
    accent?: boolean
    /**
     * responsive (default): --widget-pad follows density band (24px ≥1600, 16px <1600).
     * comfortable: locks padding at 24px (protect clinical / counselling surfaces).
     */
    density?: CardDensity
  }
>(({ className, hover = false, accent = false, density = "responsive", style, ...props }, ref) => (
  <div
    ref={ref}
    data-card-density={density}
    className={cn(
      "rounded-xl border border-gray-100 bg-white text-gray-900 shadow-sm",
      hover && "transition-shadow duration-200 hover:shadow-md",
      accent && "border-l-4 border-l-primary-500",
      className
    )}
    style={
      density === "comfortable"
        ? ({ ...style, ["--widget-pad" as string]: "24px" } as React.CSSProperties)
        : style
    }
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-[var(--widget-pad)]", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-sans font-bold leading-none tracking-tight text-gray-900",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-600", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-[var(--widget-pad)] pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-[var(--widget-pad)] pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
