"use client";

import { RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminStats, isAppAdmin, type AdminStats, type DayCount } from "@/lib/data/admin-api";

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
}

/** Histogramme des 30 derniers jours : une barre par jour, valeur au survol et pour les lecteurs d'écran. */
function Bars({ title, data }: { title: string; data: DayCount[] }) {
  const format = useFormatter();
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">{total}</span>
      </div>
      <ol className="flex h-28 items-end gap-[3px]" aria-label={title}>
        {data.map((d) => {
          const label = `${format.dateTime(new Date(d.day), { day: "numeric", month: "short" })} : ${d.count}`;
          return (
            <li key={d.day} className="flex h-full flex-1 items-end" title={label}>
              <span className="sr-only">{label}</span>
              <span
                aria-hidden
                className={d.count ? "w-full rounded-t-sm bg-primary" : "w-full rounded-t-sm bg-muted"}
                style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : "3px" }}
              />
            </li>
          );
        })}
      </ol>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0] && format.dateTime(new Date(data[0].day), { day: "numeric", month: "short" })}</span>
        <span>{data.at(-1) && format.dateTime(new Date(data.at(-1)!.day), { day: "numeric", month: "short" })}</span>
      </div>
    </Card>
  );
}

/** Tableau de bord du propriétaire : comptes, activité, contenus créés. */
export function AdminPage() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setStats(await adminStats());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void isAppAdmin().then((ok) => {
      setAllowed(ok);
      if (ok) void load();
    });
  }, [load]);

  if (allowed === false) return <Card className="p-6 text-sm text-muted-foreground">{t("forbidden")}</Card>;
  const date = (v: string | null) => (v ? format.dateTime(new Date(v), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={!allowed}>
          <RefreshCw aria-hidden />
          {t("refresh")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
      {!stats ? (
        <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>
      ) : (
        <>
          <section aria-label={t("accounts")} className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-kpis">
            <Kpi label={t("kpi.total")} value={stats.users.total} hint={t("kpi.confirmed", { count: stats.users.confirmed })} />
            <Kpi label={t("kpi.new7")} value={stats.users.new7} hint={t("kpi.new30", { count: stats.users.new30 })} />
            <Kpi label={t("kpi.active7")} value={stats.users.active7} hint={t("kpi.active30", { count: stats.users.active30 })} />
            <Kpi label={t("kpi.projects")} value={stats.content.projects} hint={t("kpi.boards", { count: stats.content.boards })} />
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <Bars title={t("signups")} data={stats.signups} />
            <Bars title={t("projectsPerDay")} data={stats.projectsPerDay} />
          </div>
          <Card className="p-4">
            <h2 className="mb-3 font-medium">{t("content")}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(["clubs", "teams", "players", "drills", "shares", "comments"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{t(`items.${key}`)}</dt>
                  <dd className="text-lg font-medium tabular-nums">{stats.content[key]}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="overflow-x-auto p-4">
            <h2 className="mb-3 font-medium">{t("recent")}</h2>
            <table className="w-full min-w-[36rem] text-sm" data-testid="admin-users">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-normal">{t("col.email")}</th>
                  <th className="py-1 pr-3 font-normal">{t("col.created")}</th>
                  <th className="py-1 pr-3 font-normal">{t("col.lastSeen")}</th>
                  <th className="py-1 pr-3 text-right font-normal">{t("col.projects")}</th>
                  <th className="py-1 text-right font-normal">{t("col.clubs")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((u) => (
                  <tr key={u.email + u.created_at} className="border-t">
                    <td className="py-1.5 pr-3">
                      {u.email}
                      {!u.confirmed && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t("unconfirmed")}</span>}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{date(u.created_at)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{date(u.last_sign_in_at)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{u.projects}</td>
                    <td className="py-1.5 text-right tabular-nums">{u.clubs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
