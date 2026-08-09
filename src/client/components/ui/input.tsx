import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-sm text-[var(--text)] shadow-sm outline-none transition-colors",
        "placeholder:text-[var(--text-mute)] focus-visible:border-[var(--amber)] focus-visible:ring-2 focus-visible:ring-[var(--amber-soft)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
