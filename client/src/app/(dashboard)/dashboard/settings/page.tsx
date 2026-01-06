"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";

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

export default function SettingsPage() {
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

  const onProfileSubmit = (values: ProfileValues) => {
    console.log(values);
    setSubmitted(true);
  };
  const onPasswordSubmit = (values: PasswordValues) => {
    console.log(values);
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
        <Alert
          title="Settings updated"
          description="All changes synced with EduTo backend."
          variant="success"
        />
      )}

      <PermissionGate permission={PermissionKey.MANAGE_TEACHERS}>
        <Card className="md:col-span-2 flex flex-col gap-3 rounded-3xl border border-dashed border-blue-200 bg-blue-50/70 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Manage teachers
          </h3>
          <p className="text-sm text-slate-600">
            Přístup pouze pro ředitele nebo ownera. Umožňuje přidávat a odebírat učitele.
          </p>
          <Button className="w-fit rounded-2xl" variant="outline">
            Open teacher manager
          </Button>
        </Card>
      </PermissionGate>
    </div>
  );
}
