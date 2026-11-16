"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";
import { acceptInvite, currentUserId, getInvite, type InviteInfo } from "@/lib/data/clubs-api";
import { refreshClubs, setWorkspace } from "@/lib/workspace";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; invite: InviteInfo; signedIn: boolean };

/** Page d'un lien d'invitation : présente le club, fait se connecter si besoin, puis fait rejoindre. */
export function InviteLanding({ token }: { token: string }) {
  const t = useTranslations("invite");
  const tRoles = useTranslations("appNav.roles");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInvite(token), currentUserId()])
      .then(([invite, uid]) => {
        if (cancelled) return;
        setState(invite ? { kind: "ready", invite, signedIn: !!uid } : { kind: "missing" });
      })
      .catch(() => !cancelled && setState({ kind: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") return <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>;
  if (state.kind === "missing") {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-semibold">{t("missingTitle")}</h1>
        <p className="text-muted-foreground">{t("missingBody")}</p>
      </Card>
    );
  }

  const { invite, signedIn } = state;
  const next = `/invite/${token}`;
  const usable = invite.status === "valid" || invite.member;

  const join = async () => {
    setBusy(true);
    setError(false);
    try {
      const clubId = await acceptInvite(token);
      setWorkspace(clubId);
      await refreshClubs();
      router.replace("/app");
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2 aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading", { club: invite.club_name })}</h1>
      {invite.member ? (
        <p className="text-muted-foreground">{t("alreadyMember")}</p>
      ) : usable ? (
        <p className="text-muted-foreground">{t("body", { role: tRoles(invite.role) })}</p>
      ) : (
        <p role="alert" className="text-destructive">{t(`status.${invite.status}`)}</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
      {usable &&
        (signedIn ? (
          <Button onClick={() => void join()} disabled={busy}>
            {invite.member ? t("open") : t("join", { club: invite.club_name })}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("signInFirst")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={{ pathname: "/login", query: { next } }} className={buttonVariants()}>
                {t("login")}
              </Link>
              <Link href={{ pathname: "/signup", query: { next } }} className={buttonVariants({ variant: "outline" })}>
                {t("signup")}
              </Link>
            </div>
          </div>
        ))}
    </Card>
  );
}
