import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80",
        secondary:
          "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-800/80",
        success:
          "border-transparent bg-green-500/20 text-green-400 hover:bg-green-500/30",
        destructive:
          "border-transparent bg-red-500/20 text-red-400 hover:bg-red-500/30",
        warning:
          "border-transparent bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30",
        outline: "text-zinc-100 border-zinc-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
