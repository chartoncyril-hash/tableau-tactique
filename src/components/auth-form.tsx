"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isGoogleAuthEnabled } from "@/lib/supabase/env";

type Mode = "login" | "signup";
type Notice = { kind: "error" | "success"; text: string } | null;

export function AuthForm({ mode, initialError }: { mode: Mode; initialError?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(
    initialError ? { kind: "error", text: t("errorCallback") } : null,
  );

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=/${locale}/app`;

  function describe(code: string | undefined) {
    if (code === "invalid_credentials") return t("errorInvalid");
    if (code === "email_not_confirmed") return t("errorNotConfirmed");
    if (code === "user_already_exists") return t("errorExists");
    return t("errorGeneric");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setNotice(null);

    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setNotice({ kind: "error", text: describe(error.code) });
          return;
        }
        router.replace("/app");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) {
        setNotice({ kind: "error", text: describe(error.code) });
        return;
      }
      if (data.session) {
        router.replace("/app");
        router.refresh();
        return;
      }
      // Supabase renvoie un utilisateur sans identité si l'adresse existe déjà.
      if (data.user && data.user.identities?.length === 0) {
        setNotice({ kind: "error", text: t("errorExists") });
        return;
      }
      setNotice({ kind: "success", text: t("checkEmail") });
    } catch {
      setNotice({ kind: "error", text: t("errorGeneric") });
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setNotice({ kind: "error", text: t("errorGeneric") });
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            required
          />
          {mode === "signup" ? (
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t("passwordHint")}
            </p>
          ) : null}
        </div>
        <p
          role={notice?.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            notice
              ? notice.kind === "error"
                ? "text-sm text-destructive"
                : "text-sm text-primary"
              : "sr-only"
          }
        >
          {notice?.text}
        </p>
        <Button type="submit" disabled={pending}>
          {mode === "login" ? t("submitLogin") : t("submitSignup")}
        </Button>
      </form>

      {isGoogleAuthEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
            {t("google")}
          </Button>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {mode === "login" ? t("noAccount") : t("hasAccount")}{" "}
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {mode === "login" ? t("submitSignup") : t("submitLogin")}
        </Link>
      </p>
    </div>
  );
}
