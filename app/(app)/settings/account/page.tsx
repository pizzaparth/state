import * as React from "react";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Settings
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Account
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Name, email, username, timezone, and data export.
        </p>
      </div>
    </div>
  );
}
