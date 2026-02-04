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
import { showToastOnce, resolveToastFromHttpError } from "@/utils/toast";

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
      "Účet se vytvoří a připojení dokončíš pomocí kódu od ředitele.",
  },
];

const loginSchema = z.object({
  email: z.string().email({ message: "Zadej platný e-mail" }),
  password: z.string().min(6, { message: "Heslo musí mít alespoň 6 znaků" }),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, { message: "Jméno musí mít alespoň 2 znaky" }),
  mode: z.enum(registerModeOptions, {
    required_error: "Vyber typ registrace",
  }),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type AuthFormProps = {
  mode: "login" | "register";
  initialMode?: RegisterMode;
  initialJoinCode?: string;
  initialJoinRole?: "STUDENT" | "TEACHER" | "PARENT" | undefined;
};

export const AuthForm = ({
  mode,
  initialMode,
  initialJoinCode,
  initialJoinRole,
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
        },
  });

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
        joinCode?: string;
        role?: "STUDENT" | "TEACHER" | "PARENT";
      } = {
        name: registerValues.name.trim(),
        email: registerValues.email.trim(),
        password: registerValues.password,
        mode: selectedRegisterMode,
      };
      if (selectedRegisterMode === "JOIN_ORG") {
        const code = (initialJoinCode ?? "").trim();
        if (code) payload.joinCode = code;
        if (initialJoinRole) payload.role = initialJoinRole;
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
      if (selectedRegisterMode === "JOIN_ORG" && typeof window !== "undefined") {
        const joinIntent = {
          joinCode: (initialJoinCode ?? "").trim(),
          ...(initialJoinRole ? { role: initialJoinRole } : {}),
        };
        window.sessionStorage.setItem("join_intent", JSON.stringify(joinIntent));
      }

      // ✅ Počkej na dokončení syncProfile před redirectem (redirect je v register/page.tsx)
      await syncProfile({ force: true });
      showToastOnce(
        selectedRegisterMode === "JOIN_ORG"
          ? "Účet byl vytvořen. Dokonči připojení v onboarding kroku."
          : "Účet byl vytvořen. Přihlašuji…",
        { type: "success" },
      );
    } catch (err) {
      let message: string;

      if (err instanceof HttpError) {
        const resolved = resolveToastFromHttpError(err);
        // Pro auth chybové toasty nikdy nepoužíváme stavové kódy jako chybu – helper je už odfiltruje.
        message =
          resolved.message ??
          (mode === "login"
            ? "Neplatné přihlašovací údaje ❌"
            : "Registrace se nezdařila. Zkus to prosím znovu.");
      } else if (err instanceof Error && err.message.trim().length > 0) {
        message = err.message;
      } else {
        message =
          mode === "login"
            ? "Neplatné přihlašovací údaje ❌"
            : "Registrace se nezdařila. Zkus to prosím znovu.";
      }

      showToastOnce(message, { type: "error" });
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


      {mode === "register" && registerMode === "CREATE_ORG" && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Role po vytvoření organizace: <span className="font-semibold text-slate-800">OWNER</span>
        </div>
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
