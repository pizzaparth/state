import * as React from "react";

export const inputClasses =
  "w-full h-11 px-4 text-base bg-white text-[#0A0A0A] rounded-input border border-black/[0.08] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-[#71717A] transition-[border-color,box-shadow] touch-manipulation aria-[invalid=true]:border-[#B42318]/60";

/** Labelled input with its inline error, shared by the auth forms. */
export const AuthField = React.forwardRef<
  HTMLInputElement,
  { name: string; label: string; error?: string; aside?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>
>(function AuthField({ name, label, error, aside, ...props }, ref) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="block text-sm font-medium text-[#52525B]">
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
        <p id={`${name}-error`} aria-live="polite" className="text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
});
