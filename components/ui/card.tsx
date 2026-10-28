import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "raised" | "panel" | "inset" | "dark";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "raised", children, ...props }, ref) => {
    const variantClasses = {
      raised: "neu-raised bg-[#DEDEDA] text-[#171717] rounded-card p-6",
      panel: "neu-panel bg-[#DEDEDA] text-[#171717] rounded-card p-5",
      inset: "neu-inset bg-[#D2D2CE] text-[#171717] rounded-card p-5",
      dark: "dark-card bg-[#111111] text-[#F4F4F2] border border-white/10 rounded-card p-6 shadow-dark-card",
    };

    return (
      <div ref={ref} className={cn(variantClasses[variant], className)} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
