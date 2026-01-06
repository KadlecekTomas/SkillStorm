"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { httpClient, HttpError } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { showToastOnce } from "@/utils/toast";

const roleOptions = ["STUDENT", "TEACHER", "DIRECTOR"] as const;

const loginSchema = z.object({
  email: z.string().email({ message: "Zadej platný e-mail" }),
  password: z.string().min(6, { message: "Heslo musí mít alespoň 6 znaků" }),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, { message: "Jméno musí mít alespoň 2 znaky" }),
  role: z.enum(roleOptions, { required_error: "Vyber roli" }),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type AuthFormProps = {
  mode: "login" | "register";
};

export const AuthForm = ({ mode }: AuthFormProps) => {
  const { login, isLoading: authLoading } = useAuth();
  const [registering, setRegistering] = useState(false);

  const schema = mode === "login" ? loginSchema : registerSchema;

  const form = useForm<LoginValues | RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "login"
        ? { email: "", password: "" }
        : { email: "", password: "", name: "", role: undefined },
  });

  // 🔹 oddělená submit logika
  const handleSubmit = async (values: LoginValues | RegisterValues) => {
    try {
      if (mode === "login") {
        await login({ email: values.email, password: values.password });
        showToastOnce("Přihlašuji…", { type: "success" });
        return;
      }

      setRegistering(true);
      const registerValues = values as RegisterValues;
      const data = await httpClient.post<{ user?: unknown }>("/auth/register", registerValues);

      if (data?.user) {
        showToastOnce("Účet byl vytvořen. Pokračuj na přihlášení ✅", {
          type: "success",
        });
      } else {
        showToastOnce("Neočekávaná odpověď serveru.", { type: "error" });
      }
    } catch (err) {
      const message =
        err instanceof HttpError
          ? (err.data as { message?: string })?.message ?? err.message
          : err instanceof Error
            ? err.message
            : "Neznámá chyba";

      showToastOnce(
        mode === "login"
          ? message ?? "Neplatné přihlašovací údaje ❌"
          : message ?? "Registrace se nezdařila.",
        { type: "error" }
      );
    } finally {
      if (mode === "register") setRegistering(false);
    }
  };

  // 🔹 bezpečné obalení s preventDefault
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.handleSubmit(handleSubmit)(e);
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
      onSubmit={handleFormSubmit}
      noValidate
    >
      {mode === "register" && (
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-medium text-slate-700"
          >
            Jméno
          </label>
          <Input id="name" placeholder="Jane Cooper" {...form.register("name")} />
          {(form.formState.errors as FieldErrors<RegisterValues>).name && (
            <p>{(form.formState.errors as FieldErrors<RegisterValues>).name?.message}</p>
          )}

        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          E-mail
        </label>
        <Input
          id="email"
          placeholder="you@school.edu"
          type="email"
          autoComplete="email"
          {...form.register("email")}
        />
        {form.formState.errors["email"] && (
          <p className="text-sm text-red-600">
            {form.formState.errors["email"]?.message as string}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Heslo
        </label>
        <Input
          id="password"
          placeholder="••••••••"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          {...form.register("password")}
        />
        {form.formState.errors["password"] && (
          <p className="text-sm text-red-600">
            {form.formState.errors["password"]?.message as string}
          </p>
        )}
      </div>

      {mode === "register" && (
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <div className="space-y-2">
              <label
                htmlFor="role"
                className="text-sm font-medium text-slate-700"
              >
                Role
              </label>
              <Select
                onValueChange={(value) => field.onChange(value)}
                value={field.value ?? ""}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Vyber roli" />
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

      <Button
        type="submit"
        disabled={mode === "login" ? authLoading : registering}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {(mode === "login" ? authLoading : registering) && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
      </Button>
    </motion.form>
  );
};
