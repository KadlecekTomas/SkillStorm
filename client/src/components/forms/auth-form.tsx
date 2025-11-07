"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { apiClient } from "@/utils/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuthStore } from "@/store/use-auth-store";
import { AxiosError } from "axios";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "Minimum 6 characters" }),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(3, { message: "Name must contain at least 3 characters" }),
  role: z.enum(["teacher", "student"]),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type AuthFormProps = {
  mode: "login" | "register";
};

export const AuthForm = ({ mode }: AuthFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  const schema = mode === "login" ? loginSchema : registerSchema;
  const form = useForm<LoginValues | RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "login"
        ? { email: "", password: "" }
        : { email: "", password: "", fullName: "", role: "teacher" },
  });

  const onSubmit = async (values: LoginValues | RegisterValues) => {
    try {
      setError(null);
      setSuccess(null);
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const { data } = await apiClient.post(endpoint, values);
      if (data?.user) {
        setUser(data.user, data.token);
        setSuccess(
          mode === "login"
            ? "Welcome back! Redirecting to dashboard..."
            : "Account created. You can continue to dashboard.",
        );
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
      {mode === "register" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Full Name</label>
          <Input placeholder="Jane Cooper" {...form.register("fullName")} />
          {registerErrors?.fullName && (
            <p className="text-sm text-red-600">
              {registerErrors.fullName.message as string}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Email</label>
        <Input placeholder="you@school.edu" type="email" {...form.register("email")} />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">{form.formState.errors.email.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Password</label>
        <Input placeholder="••••••••" type="password" {...form.register("password")} />
        {form.formState.errors.password && (
          <p className="text-sm text-red-600">
            {form.formState.errors.password.message as string}
          </p>
        )}
      </div>

      {mode === "register" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Role</label>
          <Select
            value={form.watch("role")}
            onValueChange={(value) => form.setValue("role", value as "teacher" | "student")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" className="w-full h-12 text-base">
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>

      {error && <Alert title="Authentication error" description={error} variant="warning" />}
      {success && <Alert title="Success" description={success} variant="success" />}
    </motion.form>
  );
};
