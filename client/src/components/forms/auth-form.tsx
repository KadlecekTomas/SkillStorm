"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { apiClient } from "@/utils/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { showToastOnce } from "@/utils/toast";

const roleOptions = ["STUDENT", "TEACHER", "DIRECTOR"] as const;

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "Minimum 6 characters" }),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, { message: "Name must contain at least 2 characters" }),
  role: z.enum(roleOptions, { required_error: "Please select a role" }),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type AuthFormProps = {
  mode: "login" | "register";
};

export const AuthForm = ({ mode }: AuthFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const { login, loading: authLoading } = useAuth();

  const schema = mode === "login" ? loginSchema : registerSchema;

  const form = useForm<LoginValues | RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "login"
        ? { email: "", password: "" }
        : { email: "", password: "", name: "", role: undefined },
  });
  const onSubmit = async (values: LoginValues | RegisterValues) => {
    try {
      setError(null);
      setSuccess(null);

      if (mode === "login") {
        await login({ login: values.email, password: values.password });
        setSuccess("Přihlašuji…");
        return;
      }

      setRegistering(true);
      const registerValues = values as RegisterValues;
      const { data } = await apiClient.post("/auth/register", registerValues);

      if (data?.user) {
        showToastOnce("Účet byl vytvořen. Pokračuj na přihlášení.", {
          type: "success",
        });
        setSuccess("Account created. Continue to dashboard.");
      } else {
        setError("Unexpected response from server.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message
          : undefined;

      setError(
        message ?? (mode === "login" ? "Invalid credentials." : "Unable to register user."),
      );

      showToastOnce(
        mode === "login"
          ? message ?? "Neplatné přihlašovací údaje ❌"
          : message ?? "Registrace se nezdařila.",
        { type: "error" },
      );
    } finally {
      if (mode === "register") setRegistering(false);
    }
  };

  const registerErrors =
    mode === "register"
      ? (form.formState.errors as FieldErrors<RegisterValues>)
      : undefined;

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {/* --- Name --- */}
      {mode === "register" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <Input placeholder="Jane Cooper" {...form.register("name")} />
          {registerErrors?.name && (
            <p className="text-sm text-red-600">
              {registerErrors.name.message as string}
            </p>
          )}
        </div>
      )}

      {/* --- Email --- */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Email</label>
        <Input placeholder="you@school.edu" type="email" {...form.register("email")} />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">
            {form.formState.errors.email.message as string}
          </p>
        )}
      </div>

      {/* --- Password --- */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Password</label>
        <Input placeholder="••••••••" type="password" {...form.register("password")} />
        {form.formState.errors.password && (
          <p className="text-sm text-red-600">
            {form.formState.errors.password.message as string}
          </p>
        )}
      </div>

      {/* --- Role --- */}
      {mode === "register" && (
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select
                onValueChange={(value) => field.onChange(value)}
                value={field.value ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registerErrors?.role && (
                <p className="text-sm text-red-600">
                  {registerErrors.role.message as string}
                </p>
              )}
            </div>
          )}
        />
      )}

      {/* --- Submit --- */}
      <Button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base"
        disabled={mode === "login" ? authLoading : registering}
      >
        {(mode === "login" ? authLoading : registering) && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>

      {error && <Alert title="Authentication error" description={error} variant="warning" />}
      {success && <Alert title="Success" description={success} variant="success" />}

    </motion.form>
  );
};
