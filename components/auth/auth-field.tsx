import * as React from "react";

export const inputClasses =
  "w-full h-11 px-4 text-base bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-[border-color,box-shadow] touch-manipulation aria-[invalid=true]:border-[#E5A3A3]/60";

/** Labelled input with its inline error, shared by the auth forms. */
export function AuthField({
  name,
  label,
  error,
  aside,
  ...props
}: { name: string; label: string; error?: string; aside?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="block text-sm font-medium text-[#A9A9A6]">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-[#E5A3A3]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Confirmation panel shown in place of a form once an email is on its way. */
export function SentNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="space-y-2">
      <h2 className="text-base font-semibold text-[#F4F4F2]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[#A9A9A6]">{children}</div>
    </div>
  );
}
