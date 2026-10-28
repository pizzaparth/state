import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full h-11 px-4 text-sm bg-[#D2D2CE] text-[#171717] rounded-input",
            "shadow-neu-inset-sm placeholder:text-[#8B8B86]",
            "border border-transparent focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20",
            "transition-all touch-manipulation",
            error && "border-red-500/50 focus:border-red-500",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-600 px-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
