import * as React from "react";

export const inputClasses =
  "w-full h-11 px-4 text-base bg-[#000000] text-[#F4F4F2] rounded-input border border-white/[0.16] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-[#6F6F6B] transition-[border-color,box-shadow] touch-manipulation aria-[invalid=true]:border-[#E5A3A3]/60";

/** Labelled input with its inline error, shared by the auth forms. */
export const AuthField = React.forwardRef<
  HTMLInputElement,
  { name: string; label: string; error?: string; aside?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>
>(function AuthField({ name, label, error, aside, ...props }, ref) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="block text-sm font-medium text-[#A9A9A6]">
          {label}
        </label>
        {aside}
      </div>
      <input
        ref={ref}
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} aria-live="polite" className="text-sm text-[#E5A3A3]">
          {error}
        </p>
      )}
    </div>
  );
});
