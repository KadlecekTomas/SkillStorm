"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessAlert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { PermissionKey } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { showToastOnce } from "@/utils/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/http/client";
import Link from "next/link";

const profileSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
});

const passwordSchema = z
  .object({
    current: z.string().min(6),
    next: z.string().min(6),
    confirm: z.string().min(6),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Passwords must match",
    path: ["confirm"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function SettingsPage(): React.JSX.Element {
  const { hasOrganization } = useAuth();
  const { can } = usePermissions();
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "Alex Novak",
      email: "alex@skillstorm.dev",
    },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current: "",
      next: "",
      confirm: "",
    },
  });
  const [submitted, setSubmitted] = useState(false);
  const [origin, setOrigin] = useState("");
  const [inviteRole, setInviteRole] = useState<"STUDENT" | "TEACHER" | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const canInviteStudents = can(PermissionKey.INVITE_STUDENTS);
  const canInviteTeachers = can(PermissionKey.INVITE_TEACHERS);
  const canInvite = hasOrganization && (canInviteStudents || canInviteTeachers);
  const inviteRoleOptions = useMemo<Array<{ value: "STUDENT" | "TEACHER"; label: string }>>(() => {
    const options: Array<{ value: "STUDENT" | "TEACHER"; label: string }> = [];
    if (canInviteStudents) options.push({ value: "STUDENT", label: "Student" });
    if (canInviteTeachers) options.push({ value: "TEACHER", label: "Teacher" });
    return options;
  }, [canInviteStudents, canInviteTeachers]);

  useEffect(() => {
    if (!inviteRoleOptions.length) {
      setInviteRole(null);
      return;
    }
    const firstOption = inviteRoleOptions[0];
    if (!firstOption) {
      return;
    }
    if (!inviteRole || !inviteRoleOptions.some((opt) => opt.value === inviteRole)) {
      setInviteRole(firstOption.value);
    }
  }, [inviteRole, inviteRoleOptions]);

  const inviteLink = inviteCode && origin
    ? `${origin}/register?mode=JOIN_ORG&inviteToken=${encodeURIComponent(inviteCode)}`
    : "";

  const generateInvite = useCallback(async () => {
    if (!inviteRole || !canInvite) {
      setInviteCode("");
      setInviteError(null);
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    try {
      const invite = await fetchWithAuth<{
        id: string;
        inviteToken?: string;
        code: string;
        expiresAt: string;
      }>("POST", "/invites", {
        body: {
          type: "ORG_ONLY",
          role: inviteRole,
        },
      });
      setInviteCode(invite?.inviteToken ?? invite?.code ?? "");
    } catch (e) {
      setInviteCode("");
      setInviteError(
        e instanceof Error ? e.message : "Pozvánku se nepodařilo vytvořit.",
      );
    } finally {
      setInviteLoading(false);
    }
  }, [canInvite, inviteRole]);

  useEffect(() => {
    if (!canInvite || !inviteRole) return;
    void generateInvite();
  }, [canInvite, inviteRole, generateInvite]);

  const copyToClipboard = async (value: string, message: string) => {
    if (!value) {
      showToastOnce("Nejdřív vyber školu.", { type: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showToastOnce(message, { type: "success" });
    } catch {
      showToastOnce("Nepodařilo se zkopírovat.", { type: "error" });
    }
  };

  const onProfileSubmit = () => {
    setSubmitted(true);
  };
  const onPasswordSubmit = () => {
    setSubmitted(true);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="mt-4 space-y-4">
          <Input placeholder="Full name" {...profileForm.register("fullName")} />
          <Input placeholder="Email" type="email" {...profileForm.register("email")} />
          <Button type="submit" className="w-full">
            Save profile
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="mt-4 space-y-4">
          <Input placeholder="Current password" type="password" {...passwordForm.register("current")} />
          <Input placeholder="New password" type="password" {...passwordForm.register("next")} />
          <Input placeholder="Confirm new password" type="password" {...passwordForm.register("confirm")} />
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </Card>

      <Card className="md:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">Notifications & GDPR</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">
              Weekly analytics digest
            </span>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">
              GDPR data export reminders
            </span>
            <Switch />
          </label>
        </div>
      </Card>

      {submitted && (
        <SuccessAlert
          title="Settings updated"
          description="All changes synced with EduTo backend."
        />
      )}

      {canInvite && (
        <Card className="md:col-span-2 flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Invite members
          </h3>
          <p className="text-sm text-slate-600">
            Sdílej kód nebo odkaz s předvybranou rolí.
          </p>
          {inviteLoading && (
            <p className="text-sm text-slate-600">Generuji pozvánku…</p>
          )}
          {inviteError && (
            <p className="text-sm text-red-600">{inviteError}</p>
          )}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Role pozvánky
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  className="min-w-[180px] rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  value={inviteRole ?? ""}
                  onChange={(event) =>
                    setInviteRole(event.target.value as "STUDENT" | "TEACHER")
                  }
                >
                  {inviteRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Invite code
              </label>
              <div className="flex flex-wrap gap-2">
                <Input readOnly value={inviteCode} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(inviteCode, "Kód zkopírován.")}
                  disabled={!inviteCode || inviteLoading}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Invite link
              </label>
              <div className="flex flex-wrap gap-2">
                <Input readOnly value={inviteLink} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(inviteLink, "Pozvánka zkopírována.")}
                  disabled={!inviteLink || inviteLoading}
                >
                  Zkopírovat pozvánku
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void generateInvite()}
                  disabled={inviteLoading || !inviteRole}
                >
                  Obnovit
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {can(PermissionKey.MANAGE_TEACHERS) && (
        <Card className="md:col-span-2 flex flex-col gap-3 rounded-3xl border border-dashed border-blue-200 bg-blue-50/70 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Manage teachers
          </h3>
          <p className="text-sm text-slate-600">
            Přístup pouze pro ředitele nebo ownera. Umožňuje přidávat a odebírat učitele.
          </p>
          <Button asChild className="w-fit rounded-2xl" variant="outline">
            <Link href="/app/settings/teachers">Open teacher manager</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
