"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { inviteMemberAction, leaveOrganisationAction, removeMemberAction, revokeInvitationAction, setMemberRoleAction } from "@/app/(app)/actions";
import { ASSIGNABLE_ROLES, inviteMemberSchema } from "@/lib/validation";
import { useNotice } from "./notice";

type Role = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", member: "Member", viewer: "Viewer" };

const selectClass = "app-field h-9 rounded-[12px] bg-[#000000] px-2 text-sm text-[#F2F2EF] focus:border-white/45 focus:outline-none disabled:opacity-60";

/** Roles this manager can hand out: only the owner makes admins. */
const rolesFor = (managerRole: string): Role[] => (managerRole === "owner" ? [...ASSIGNABLE_ROLES] : ["member", "viewer"]);

/** Email and role; the server emails a single-use link. */
export function InviteMember({ organisationId, managerRole }: { organisationId: string; managerRole: string }) {
  const notify = useNotice();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("member");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <form
      noValidate
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const parsed = inviteMemberSchema.safeParse({ organisationId, email, role });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the email address.");
          inputRef.current?.focus();
          return;
        }
        startTransition(async () => {
          const result = await inviteMemberAction(parsed.data);
          if (!result.ok) {
            setError(result.error);
            inputRef.current?.focus();
            return;
          }
          setEmail("");
          setError(null);
          notify(`Invited ${result.data.email}.`);
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="invite-email" className="sr-only">
          Email
        </label>
        <input
          ref={inputRef}
          id="invite-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="ana@example.com…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "invite-error" : undefined}
          className="app-input h-11 min-w-0 flex-1 rounded-[14px] px-3 text-base"
        />
        <label htmlFor="invite-role" className="sr-only">
          Role
        </label>
        <select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${selectClass} h-11 rounded-[14px] px-3 text-base`}>
          {rolesFor(managerRole).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center justify-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Invite
        </button>
      </div>
      <p id="invite-error" aria-live="polite" className="min-h-5 text-sm text-[#F0A39B]">
        {error}
      </p>
    </form>
  );
}

/** Role picker for one member; changes save at once. */
export function MemberRole({ organisationId, userId, name, role, managerRole }: { organisationId: string; userId: string; name: string; role: Role; managerRole: string }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(role);
  const [pending, startTransition] = React.useTransition();
  const options = rolesFor(managerRole);

  return (
    <select
      aria-label={`Role for ${name}`}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Role;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await setMemberRoleAction({ organisationId, userId, role: next });
          if (!result.ok) {
            setValue(previous);
            notify(result.error);
          } else notify(`${name} is now ${ROLE_LABEL[next].toLowerCase()}.`);
        });
      }}
      className={selectClass}
    >
      {(options.includes(value) ? options : [value, ...options]).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

/**
 * Two-step destructive button: the first press asks, the second runs. Escape or leaving
 * the button cancels.
 */
function ConfirmButton({ label, confirmLabel, run }: { label: string; confirmLabel: string; run: () => Promise<void> }) {
  const [armed, setArmed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? startTransition(run) : setArmed(true))}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setArmed(false);
      }}
      className={
        armed
          ? "inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#F0A39B]/50 px-3 text-sm font-medium text-[#F0A39B] disabled:opacity-60"
          : "app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {armed ? confirmLabel : label}
    </button>
  );
}

export function RemoveMember({ organisationId, userId, name }: { organisationId: string; userId: string; name: string }) {
  const notify = useNotice();
  return (
    <ConfirmButton
      label="Remove"
      confirmLabel={`Remove ${name.split(" ")[0]}?`}
      run={async () => {
        const result = await removeMemberAction({ organisationId, userId });
        notify(result.ok ? `Removed ${name}.` : result.error);
      }}
    />
  );
}

export function RevokeInvitation({ invitationId, email }: { invitationId: string; email: string }) {
  const notify = useNotice();
  return (
    <ConfirmButton
      label="Revoke"
      confirmLabel="Revoke?"
      run={async () => {
        const result = await revokeInvitationAction({ invitationId });
        notify(result.ok ? `Revoked the invitation for ${email}.` : result.error);
      }}
    />
  );
}

export function LeaveOrganisation({ organisationId, name }: { organisationId: string; name: string }) {
  const router = useRouter();
  const notify = useNotice();
  return (
    <ConfirmButton
      label="Leave…"
      confirmLabel={`Leave ${name}?`}
      run={async () => {
        const result = await leaveOrganisationAction({ organisationId });
        if (!result.ok) return notify(result.error);
        notify(`You left ${name}.`);
        router.replace("/platform/org" as Route);
      }}
    />
  );
}
