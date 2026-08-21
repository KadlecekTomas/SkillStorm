"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { httpClient, HttpError } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type FormEvent, type JSX, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { showToastOnce } from "@/utils/toast";

const registerModeOptions = ["CREATE_ORG", "JOIN_ORG"] as const;
type RegisterMode = (typeof registerModeOptions)[number];

const registerModeDetails: Array<{
  value: RegisterMode;
  label: string;
  description: string;
}> = [
  {
    value: "CREATE_ORG",
    label: "Založit školu",
    description: "Vytvoříte novou školu. Učitele a žáky můžete přidat později.",
  },
  {
    value: "JOIN_ORG",
    label: "Připojit se",
    description: "Připojíte se ke škole pomocí pozvánky nebo kódu.",
  },
];

const loginSchema = z.object({
  email: z.string().email({ message: "Zadej platný e-mail" }),
  password: z.string().min(6, { message: "Heslo musí mít alespoň 6 znaků" }),
});

const registerSchema = loginSchema
  .extend({
    name: z.string().min(2, { message: "Jméno musí mít alespoň 2 znaky" }),
    mode: z.enum(registerModeOptions, {
      required_error: "Vyberte způsob registrace",
    }),
    inviteToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "JOIN_ORG") {
      if (!data.inviteToken || data.inviteToken.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Kód pozvánky je povinný.",
          path: ["inviteToken"],
        });
      }
    }
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type AuthFormProps = {
  mode: "login" | "register";
  initialMode?: RegisterMode;
  initialJoinCode?: string;
};

export const AuthForm = ({
  mode,
  initialMode,
  initialJoinCode,
}: AuthFormProps): JSX.Element => {
  const { login, syncProfile, isLoading: authLoading } = useAuth();
  const [registering, setRegistering] = useState(false);

  const schema = mode === "login" ? loginSchema : registerSchema;
  const defaultRegisterMode = initialMode ?? "CREATE_ORG";

  const form = useForm<LoginValues | RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "login"
        ? { email: "", password: "" }
        : {
            email: "",
            password: "",
            name: "",
            mode: defaultRegisterMode,
            inviteToken: (initialJoinCode ?? "").trim(),
          },
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const registerMode =
    mode === "register"
      ? ((form.watch("mode") as RegisterMode) ?? "CREATE_ORG")
      : "CREATE_ORG";
  const activeMode = registerModeDetails.find(
    (item) => item.value === registerMode,
  );

  const handleSubmit = async (values: LoginValues | RegisterValues) => {
    try {
      setFormError(null);
      setFieldErrors({});

      if (mode === "login") {
        await login({ email: values.email, password: values.password });
        await syncProfile({ force: true });
        return;
      }

      setRegistering(true);
      const registerValues = values as RegisterValues;
      const selectedRegisterMode = registerModeOptions.includes(registerValues.mode)
        ? registerValues.mode
        : "CREATE_ORG";
      const payload: {
        name: string;
        email: string;
        password: string;
        mode: (typeof registerModeOptions)[number];
        inviteToken?: string;
      } = {
        name: registerValues.name.trim(),
        email: registerValues.email.trim(),
        password: registerValues.password,
        mode: selectedRegisterMode,
      };
      if (selectedRegisterMode === "JOIN_ORG") {
        const token = registerValues.inviteToken?.trim();
        if (token) {
          payload.inviteToken = token;
        }
      }
      await httpClient.post<{ user: unknown }>("/auth/register", payload);

      if (selectedRegisterMode === "CREATE_ORG" && typeof window !== "undefined") {
        window.sessionStorage.setItem("create_org_intent", "1");
      }

      await syncProfile({ force: true });
      showToastOnce("Účet byl vytvořen. Přihlašuji…", { type: "success" });
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        const status = e.status;
        const data = e.data as { error?: unknown } | null | undefined;

        if (status === 400) {
          const rawError = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;

          const messages: string[] = Array.isArray(rawError)
            ? (rawError.filter((m) => typeof m === "string" && m.trim().length > 0) as string[])
            : typeof rawError === "string" && rawError.trim().length > 0
              ? [rawError.trim()]
              : [];

          if (messages.length === 0 && typeof e.message === "string" && e.message.trim().length > 0) {
            messages.push(e.message.trim());
          }

          const nextFieldErrors: Record<string, string> = {};
          const formMessages: string[] = [];

          for (const msg of messages) {
            const lower = msg.toLowerCase();
            if (lower.includes("heslo")) {
              nextFieldErrors.password = msg;
            } else if (lower.includes("email")) {
              nextFieldErrors.email = msg;
            } else if (lower.includes("invite") || lower.includes("pozván")) {
              nextFieldErrors.inviteToken = msg;
            } else {
              formMessages.push(msg);
            }
          }

          if (Object.keys(nextFieldErrors).length > 0) {
            setFieldErrors(nextFieldErrors);
          }
          if (formMessages.length > 0) {
            setFormError(formMessages.join(" "));
          }
          return;
        }

        if (status === 401 && mode === "login") {
          setFormError("Neplatné přihlašovací údaje.");
          return;
        }

        if (status === 429) {
          setFormError("Příliš mnoho pokusů. Zkus to později.");
          return;
        }

        const msg = e instanceof Error ? e.message : "Přihlášení nebo registrace se nepovedla. Zkuste to znovu.";
        showToastOnce(msg, { type: "error" });
        return;
      }

      showToastOnce("Přihlášení nebo registrace se nepovedla. Zkuste to znovu.", { type: "error" });
    } finally {
      if (mode === "register") setRegistering(false);
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.handleSubmit(handleSubmit)(e);
  };

  const isSubmitting = mode === "login" ? authLoading : registering;
  const submitLabel =
    mode === "login"
      ? authLoading
        ? "Přihlašuji…"
        : "Přihlásit se"
      : registering
        ? "Vytvářím účet…"
        : "Vytvořit účet";

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      onSubmit={handleFormSubmit}
      noValidate
    >
      {mode === "register" && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">
            Jak chcete začít?
          </label>
          <Tabs
            value={registerMode}
            onValueChange={(value) => {
              form.setValue("mode", value as RegisterMode, {
                shouldValidate: true,
              });
            }}
          >
            <TabsList className="w-full justify-between">
              {registerModeDetails.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="flex-1 text-sm"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {activeMode?.description && (
            <p className="text-sm text-slate-500">{activeMode.description}</p>
          )}
          {registerMode === "JOIN_ORG" && (
            <p className="text-sm text-slate-500">
              Registrace je možná přes pozvánku školy.
            </p>
          )}
        </div>
      )}

      {mode === "register" && (
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Jméno
          </label>
          <Input id="name" placeholder="Jméno a příjmení" {...form.register("name")} />
          {(form.formState.errors as FieldErrors<RegisterValues>).name && (
            <p className="text-sm text-red-600">
              {(form.formState.errors as FieldErrors<RegisterValues>).name?.message}
            </p>
          )}
        </div>
      )}

      {mode === "register" && registerMode === "JOIN_ORG" && (
        <div className="space-y-2">
          <label htmlFor="inviteToken" className="text-sm font-medium text-slate-700">
            Kód pozvánky
          </label>
          <Input
            id="inviteToken"
            placeholder="Vložte kód z pozvánky"
            {...form.register("inviteToken")}
          />
          {(form.formState.errors as FieldErrors<RegisterValues>).inviteToken && (
            <p className="text-sm text-red-600">
              {(form.formState.errors as FieldErrors<RegisterValues>).inviteToken?.message}
            </p>
          )}
          {fieldErrors.inviteToken && (
            <p className="mt-1 text-sm text-red-500">
              {fieldErrors.inviteToken}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          E-mail
        </label>
        <Input
          id="email"
          placeholder="např. jana@skola.cz"
          type="email"
          autoComplete="email"
          {...form.register("email")}
        />
        {form.formState.errors["email"] && (
          <p className="text-sm text-red-600">
            {form.formState.errors["email"]?.message as string}
          </p>
        )}
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-red-500">
            {fieldErrors.email}
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
        {fieldErrors.password && (
          <p className="mt-1 text-sm text-red-500">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </motion.form>
  );
};
