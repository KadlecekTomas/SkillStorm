"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { httpClient, HttpError } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type JSX, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2 } from "lucide-react";
import { showToastOnce } from "@/utils/toast";

const registerModeOptions = ["INDIVIDUAL", "CREATE_ORG", "JOIN_ORG"] as const;
type RegisterMode = (typeof registerModeOptions)[number];

const registerModeDetails: Array<{
  value: RegisterMode;
  label: string;
  description: string;
}> = [
  {
    value: "INDIVIDUAL",
    label: "Individual",
    description:
      "Individuální účet bez školy. Kdykoliv můžeš školu založit nebo se připojit.",
  },
  {
    value: "CREATE_ORG",
    label: "Create org",
    description:
      "Založíš školu a staneš se ownerem. Pozvánky pošleš později.",
  },
  {
    value: "JOIN_ORG",
    label: "Join org",
    description:
      "Účet se vytvoří a připojení proběhne pomocí invite tokenu.",
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
      required_error: "Vyber typ registrace",
    }),
    inviteToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "JOIN_ORG") {
      if (!data.inviteToken || data.inviteToken.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invite token je povinný.",
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
  const defaultRegisterMode = initialMode ?? "INDIVIDUAL";

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
      ? ((form.watch("mode") as RegisterMode) ?? "INDIVIDUAL")
      : "INDIVIDUAL";
  const activeMode = registerModeDetails.find(
    (item) => item.value === registerMode,
  );

  // 🔹 oddělená submit logika
  const handleSubmit = async (values: LoginValues | RegisterValues) => {
    try {
      setFormError(null);
      setFieldErrors({});

      if (mode === "login") {
        await login({ email: values.email, password: values.password });
        // ✅ Počkej na dokončení syncProfile před redirectem (redirect je v login/page.tsx)
        await syncProfile({ force: true });
        showToastOnce("Přihlašuji…", { type: "success" });
        return;
      }

      setRegistering(true);
      const registerValues = values as RegisterValues;
      // Explicit payload – only fields allowed by backend RegisterDto (forbidNonWhitelisted).
      const selectedRegisterMode = registerModeOptions.includes(registerValues.mode)
        ? registerValues.mode
        : "INDIVIDUAL";
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
        const token = (registerValues as RegisterValues).inviteToken?.trim();
        if (token) {
          payload.inviteToken = token;
        }
      }
      const registerResult = await httpClient.post<{
        user: unknown;
        sessionToken?: string;
      }>("/auth/register", payload);
      
      // ✅ Ulož sessionToken pokud je v odpovědi (kompatibilita s backendem)
      if (registerResult?.sessionToken && typeof registerResult.sessionToken === "string") {
        const { setSessionToken } = useAuthStore.getState();
        setSessionToken(registerResult.sessionToken);
      }
      
      if (selectedRegisterMode === "CREATE_ORG" && typeof window !== "undefined") {
        window.sessionStorage.setItem("create_org_intent", "1");
      }

      // ✅ Počkej na dokončení syncProfile před redirectem (redirect je v register/page.tsx)
      await syncProfile({ force: true });
      showToastOnce("Účet byl vytvořen. Přihlašuji…", { type: "success" });
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        const status = e.status;
        const data = e.data as { error?: unknown } | null | undefined;

        // 400 – validace vstupů (zobraz inline / form-level, žádný toast)
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
            } else if (lower.includes("invite")) {
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

        // 401 – auth chyba; nikdy neprozrazuj, co přesně bylo špatně.
        if (status === 401 && mode === "login") {
          setFormError("Neplatné přihlašovací údaje.");
          return;
        }

        // 429 – rate limiting.
        if (status === 429) {
          setFormError("Příliš mnoho pokusů. Zkus to později.");
          return;
        }

        // Pro ostatní HTTP chyby zobraz konkrétní zprávu nebo krátký fallback.
        const msg = e instanceof Error ? e.message : "Přihlášení nebo registrace se nepovedla. Zkuste to znovu.";
        showToastOnce(msg, { type: "error" });
        return;
      }

      showToastOnce("Přihlášení nebo registrace se nepovedla. Zkuste to znovu.", { type: "error" });
    } finally {
      if (mode === "register") setRegistering(false);
    }
  };

  // 🔹 bezpečné obalení s preventDefault
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.handleSubmit(handleSubmit)(e);
  };

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
            Typ účtu
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
                  className="flex-1"
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
            <p className="text-red-600 text-sm">
              Registration is invite-only. Use your organization invite link.
            </p>
          )}
        </div>
      )}

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

      {mode === "register" && registerMode === "JOIN_ORG" && (
        <div className="space-y-2">
          <label
            htmlFor="inviteToken"
            className="text-sm font-medium text-slate-700"
          >
            Invite token
          </label>
          <Input
            id="inviteToken"
            placeholder="Zadej invite token nebo kód"
            {...form.register("inviteToken")}
          />
          {(form.formState.errors as FieldErrors<RegisterValues>).inviteToken && (
            <p className="text-sm text-red-600">
              {(form.formState.errors as FieldErrors<RegisterValues>).inviteToken?.message}
            </p>
          )}
          {fieldErrors.inviteToken && (
            <p className="text-sm text-red-500 mt-1">
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
        {fieldErrors.email && (
          <p className="text-sm text-red-500 mt-1">
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
          <p className="text-sm text-red-500 mt-1">
            {fieldErrors.password}
          </p>
        )}
      </div>


      {mode === "register" && registerMode === "CREATE_ORG" && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Role po vytvoření organizace: <span className="font-semibold text-slate-800">OWNER</span>
        </div>
      )}

      {formError && (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
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
