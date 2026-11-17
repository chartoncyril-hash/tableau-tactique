"use client";

import { Check, Copy, Link2, LogOut, Trash2, UserMinus } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import {
  CLUB_ROLES,
  createInvite,
  currentUserId,
  deleteClub,
  inviteActive,
  listInvites,
  listMembers,
  removeMember,
  renameClub,
  revokeInvite,
  setMemberRole,
  type ClubRole,
  type InviteRow,
  type MemberRow,
} from "@/lib/data/clubs-api";
import { cn } from "@/lib/utils";
import { ClubLogoField } from "./club-logo-field";
import { refreshClubs, setWorkspace, useWorkspace } from "@/lib/workspace";

const select = "h-11 rounded-md border border-input bg-card px-2 text-sm md:h-9";

/** Réglages du club de l'espace courant : nom, membres et rôles, invitations, départ. */
export function ClubSettings() {
  const t = useTranslations("club");
  const clubId = useWorkspace((s) => s.clubId);
  const club = useWorkspace((s) => s.clubs.find((c) => c.id === s.clubId));
  const loaded = useWorkspace((s) => s.loaded);

  if (!loaded) return <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>;
  if (!clubId || !club) {
    return (
      <Card className="p-6 text-muted-foreground">
        <h1 className="mb-2 text-xl font-semibold text-foreground">{t("noClubTitle")}</h1>
        {t("noClubBody")}
      </Card>
    );
  }
  return <ClubPanel key={clubId} clubId={clubId} name={club.name} role={club.role} />;
}

function ClubPanel({ clubId, name, role }: { clubId: string; name: string; role: ClubRole }) {
  const t = useTranslations("club");
  const tRoles = useTranslations("appNav.roles");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const admin = role === "admin";
  const [me, setMe] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [clubName, setClubName] = useState(name);
  const [inviteRole, setInviteRole] = useState<ClubRole>("coach");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [deleteText, setDeleteText] = useState("");

  const load = useCallback(async () => {
    const [uid, list, links] = await Promise.all([
      currentUserId(),
      listMembers(clubId),
      admin ? listInvites(clubId) : Promise.resolve([]),
    ]);
    setMe(uid);
    setMembers(list);
    setInvites(links);
  }, [clubId, admin]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement asynchrone depuis la base
    load().catch(() => {
      if (!cancelled) setNotice({ kind: "error", text: t("error") });
    });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  /** Lance une action, affiche l'erreur « dernier admin » lisiblement, puis recharge. */
  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (done) setNotice({ kind: "info", text: done });
      await load();
    } catch (error) {
      const lastAdmin = String((error as Error).message).includes("last_admin");
      setNotice({ kind: "error", text: t(lastAdmin ? "lastAdmin" : "error") });
    } finally {
      setBusy(false);
    }
  };

  const link = (token: string) => `${window.location.origin}/${locale}/invite/${token}`;

  const copy = async (invite: InviteRow) => {
    try {
      await navigator.clipboard.writeText(link(invite.token));
      setCopied(invite.id);
      setTimeout(() => setCopied((c) => (c === invite.id ? null : c)), 2000);
    } catch {
      setNotice({ kind: "error", text: t("copyFailed") });
    }
  };

  const saveName = () => {
    const text = clubName.trim().slice(0, 80);
    if (!text || text === name) return setClubName(name);
    void run(async () => {
      await renameClub(clubId, text);
      await refreshClubs();
    });
  };

  const createLink = (e: FormEvent) => {
    e.preventDefault();
    void run(() => createInvite(clubId, inviteRole, label.trim().slice(0, 80)), t("linkCreated")).then(() => setLabel(""));
  };

  const leave = () =>
    run(async () => {
      if (!me) return;
      await removeMember(clubId, me);
      setWorkspace(null);
      await refreshClubs();
      router.push("/app");
    });

  const destroy = () =>
    run(async () => {
      await deleteClub(clubId);
      setWorkspace(null);
      await refreshClubs();
      router.push("/app");
    });

  const active = invites.filter((i) => inviteActive(i));
  const past = invites.filter((i) => !inviteActive(i)).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
          {t("yourRole", { role: tRoles(role) })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn("text-sm", notice.kind === "error" ? "text-destructive" : "text-primary")}
        >
          {notice.text}
        </p>
      )}

      {admin && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">{t("settings")}</h2>
          <label className="flex max-w-md flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("clubName")}</span>
            <Input
              value={clubName}
              maxLength={80}
              onChange={(e) => setClubName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
          <ClubLogoField clubId={clubId} />
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">{t("members", { count: members?.length ?? 0 })}</h2>
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
          {CLUB_ROLES.map((r) => (
            <div key={r}>
              <dt className="inline font-medium text-foreground">{tRoles(r)} : </dt>
              <dd className="inline">{t(`roleHelp.${r}`)}</dd>
            </div>
          ))}
        </dl>
        {members === null ? (
          <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>
        ) : (
          <ul className="flex flex-col divide-y" data-testid="member-list">
            {members.map((member) => {
              const self = member.user_id === me;
              const label = member.display_name || member.email;
              return (
                <li key={member.user_id} className="flex flex-wrap items-center gap-2 py-2" aria-label={label}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {label} {self && <span className="text-muted-foreground">({t("you")})</span>}
                    </span>
                    {member.display_name && <span className="block truncate text-xs text-muted-foreground">{member.email}</span>}
                  </span>
                  {admin ? (
                    <select
                      aria-label={t("roleOf", { name: label })}
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => void run(() => setMemberRole(clubId, member.user_id, e.target.value as ClubRole))}
                      className={select}
                    >
                      {CLUB_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {tRoles(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-muted-foreground">{tRoles(member.role)}</span>
                  )}
                  {admin && !self && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove", { name: label })}
                      title={t("remove", { name: label })}
                      disabled={busy}
                      onClick={() => void run(() => removeMember(clubId, member.user_id))}
                    >
                      <UserMinus aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {admin && (
        <Card className="flex flex-col gap-4 p-4">
          <div>
            <h2 className="font-medium">{t("invites")}</h2>
            <p className="text-sm text-muted-foreground">{t("invitesHelp")}</p>
          </div>
          <form onSubmit={createLink} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("inviteRole")}</span>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ClubRole)} className={select}>
                {CLUB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tRoles(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("inviteLabel")}</span>
              <Input value={label} maxLength={80} placeholder={t("inviteLabelPlaceholder")} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <Button type="submit" disabled={busy}>
              <Link2 aria-hidden />
              {t("createLink")}
            </Button>
          </form>
          {active.length > 0 && (
            <ul className="flex flex-col gap-2" data-testid="invite-list">
              {active.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">
                      {invite.label || t("unnamedInvite")} · {tRoles(invite.role)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("expires", { date: format.dateTime(new Date(invite.expires_at), { dateStyle: "medium" }) })}
                    </span>
                    <input
                      readOnly
                      aria-label={t("linkFor", { name: invite.label || t("unnamedInvite") })}
                      value={link(invite.token)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-1 w-full truncate rounded border bg-muted px-2 py-1 font-mono text-xs"
                    />
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void copy(invite)}>
                    {copied === invite.id ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied === invite.id ? t("copied") : t("copy")}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => revokeInvite(invite.id))}>
                    {t("revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">{t("pastInvites", { count: past.length })}</summary>
              <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                {past.map((invite) => (
                  <li key={invite.id}>
                    {invite.label || t("unnamedInvite")} · {tRoles(invite.role)} ·{" "}
                    {t(invite.accepted_at ? "statusUsed" : invite.revoked_at ? "statusRevoked" : "statusExpired")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3 border-destructive/30 p-4">
        <h2 className="font-medium">{t("danger")}</h2>
        {confirm === "leave" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t("leaveConfirm", { name })}</span>
            <Button size="sm" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy} onClick={() => void leave()}>
              {t("leave")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              {t("cancel")}
            </Button>
          </div>
        ) : confirm === "delete" ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteText.trim() === name) void destroy();
            }}
          >
            <p className="text-sm">{t("deleteConfirm", { name })}</p>
            <Input aria-label={t("deleteField")} placeholder={name} value={deleteText} onChange={(e) => setDeleteText(e.target.value)} className="max-w-sm" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy || deleteText.trim() !== name}>
                {t("delete")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirm("leave")}>
              <LogOut aria-hidden />
              {t("leave")}
            </Button>
            {admin && (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm("delete")}>
                <Trash2 aria-hidden />
                {t("delete")}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
