import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "dark-cta" | "dark-secondary" | "light-cta" | "light-secondary";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  /** Render the single child (e.g. a <Link>) with button styling instead of a <button>. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "dark-secondary", size = "md", isLoading, asChild, children, disabled, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-[background-color,border-color,box-shadow,color,transform] select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent touch-manipulation mi-lift mi-nudge";

    const variantClasses = {
      "dark-cta": "bg-accent text-accent-ink hover:bg-accent-hover border border-accent font-semibold",
      "dark-secondary": "bg-[#F2F2F2] text-[#0A0A0A] hover:bg-[#E8E8E8] border border-transparent",
      // Black primary, grey secondary
      "light-cta": "bg-[#0A0A0A] text-white hover:bg-[#262626] border border-[#0A0A0A] font-semibold",
      "light-secondary": "bg-[#F2F2F2] text-[#0A0A0A] hover:bg-[#E8E8E8] border border-transparent",
    };

    const sizeClasses = {
      sm: "h-8 px-3 text-xs rounded-control min-h-[32px]",
      md: "h-10 px-4 text-sm rounded-control min-h-[40px]",
      lg: "h-12 px-6 text-base rounded-input min-h-[48px]",
    };

    const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={classes}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden="true" />}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
