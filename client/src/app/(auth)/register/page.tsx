import { AuthForm } from "@/components/forms/auth-form";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Create space
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Register for EduTo
        </h1>
        <p className="text-sm text-slate-500">
          Teachers can spin up organizations, invite students and co-manage
          classrooms.
        </p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
