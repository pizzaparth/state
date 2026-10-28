import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "raised" | "inverse" | "inset" | "flat" | "dark-cta";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "raised", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-all select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] touch-manipulation";

    const variantClasses = {
      raised:
        "neu-btn-raised bg-[#DEDEDA] text-[#171717] hover:bg-[#E6E6E2]",
      inverse:
        "neu-inverse bg-[#101010] text-[#F2F2EF] hover:bg-[#171717] border border-white/10 shadow-lg",
      inset:
        "neu-inset-sm bg-[#D2D2CE] text-[#171717]",
      flat:
        "bg-transparent text-[#171717] hover:bg-black/5",
      "dark-cta":
        "bg-[#F1F1EE] text-[#090909] hover:bg-white border border-white/20 font-semibold shadow-dark-glow",
    };

    const sizeClasses = {
      sm: "h-8 px-3 text-xs rounded-control min-h-[32px]",
      md: "h-10 px-4 text-sm rounded-control min-h-[40px]",
      lg: "h-12 px-6 text-base rounded-input min-h-[48px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden="true" />}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
