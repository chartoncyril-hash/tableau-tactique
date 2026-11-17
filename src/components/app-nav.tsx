"use client";

import { Building2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { isAppAdmin } from "@/lib/data/admin-api";
import { createClub } from "@/lib/data/clubs-api";
import { cn } from "@/lib/utils";
import { refreshClubs, setWorkspace, useWorkspace } from "@/lib/workspace";

const NEW_CLUB = "__new__";

/** Onglets de l'espace connecté et choix de l'espace de travail (personnel ou club). */
export function AppNav() {
  const t = useTranslations("appNav");
  const pathname = usePathname();
  const router = useRouter();
  const clubId = useWorkspace((s) => s.clubId);
  const clubs = useWorkspace((s) => s.clubs);
  const loaded = useWorkspace((s) => s.loaded);
  const [creating, setCreating] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    void refreshClubs();
    // Onglet du tableau de bord : visible du seul propriétaire (la base refuse les autres).
    void isAppAdmin().then(setAdmin);
  }, []);

  const tabs = [
    { href: "/app", key: "projects", active: pathname === "/app" || pathname.startsWith("/app/project") },
    { href: "/app/teams", key: "teams", active: pathname.startsWith("/app/teams") },
    { href: "/app/library", key: "library", active: pathname.startsWith("/app/library") },
    ...(clubId ? [{ href: "/app/club", key: "club", active: pathname.startsWith("/app/club") }] : []),
    ...(admin ? [{ href: "/app/admin", key: "admin", active: pathname.startsWith("/app/admin") }] : []),
  ] as const;

  const onChange = (value: string) => {
    if (value === NEW_CLUB) return setCreating(true);
    setWorkspace(value || null);
    // La page du club n'a pas de sens dans l'espace personnel.
    if (!value && pathname.startsWith("/app/club")) router.push("/app");
  };

  const Icon = clubId ? Building2 : User;

  return (
    <div className="mb-6 flex flex-col-reverse gap-3 border-b sm:flex-row sm:items-end sm:justify-between">
      <nav aria-label={t("label")} className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors sm:px-4",
              tab.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        ))}
      </nav>
      <label className="relative mb-2 flex items-center sm:mb-1.5">
        <Icon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("workspace")}</span>
        <select
          aria-label={t("workspace")}
          data-testid="workspace"
          value={clubId ?? ""}
          disabled={!loaded}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm font-medium sm:h-9 sm:w-60"
        >
          <option value="">{t("personal")}</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name} · {t(`roles.${club.role}`)}
            </option>
          ))}
          <option value={NEW_CLUB}>{t("newClub")}</option>
        </select>
      </label>
      {creating && <NewClubDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewClubDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("appNav");
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = name.trim().slice(0, 80);
    if (!text) return;
    setBusy(true);
    setError(false);
    try {
      const id = await createClub(text);
      await refreshClubs();
      setWorkspace(id);
      onClose();
      router.push("/app/club");
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("newClubTitle")} closeLabel={t("close")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("newClubBody")}</p>
        <Input autoFocus aria-label={t("clubName")} placeholder={t("clubName")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {t("create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
