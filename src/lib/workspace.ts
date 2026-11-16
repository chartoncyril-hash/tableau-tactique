"use client";

import { create } from "zustand";
import { listMyClubs, type ClubRole, type ClubRow } from "@/lib/data/clubs-api";

/**
 * Espace de travail courant : personnel (clubId nul) ou un club. Mémorisé dans le navigateur ;
 * les listes de projets, dossiers et effectifs s'y limitent, et les créations s'y rangent.
 */
const KEY = "tt:workspace";

interface WorkspaceState {
  clubId: string | null;
  clubs: ClubRow[];
  loaded: boolean;
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const useWorkspace = create<WorkspaceState>(() => ({ clubId: null, clubs: [], loaded: false }));

export function setWorkspace(clubId: string | null) {
  useWorkspace.setState({ clubId });
  try {
    if (clubId) localStorage.setItem(KEY, clubId);
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : l'espace reste choisi pour cette visite.
  }
}

let pending: Promise<void> | null = null;

/** Recharge la liste de mes clubs ; un club quitté ou supprimé ramène à l'espace personnel. */
export function refreshClubs(): Promise<void> {
  pending ??= listMyClubs()
    .then((clubs) => {
      const wanted = useWorkspace.getState().loaded ? useWorkspace.getState().clubId : stored();
      const clubId = wanted && clubs.some((c) => c.id === wanted) ? wanted : null;
      useWorkspace.setState({ clubs, loaded: true });
      setWorkspace(clubId);
    })
    .catch(() => {
      useWorkspace.setState({ loaded: true });
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Mon rôle dans un espace : « admin » dans mon espace personnel. */
export function roleIn(clubId: string | null | undefined, clubs = useWorkspace.getState().clubs): ClubRole | null {
  if (!clubId) return "admin";
  return clubs.find((c) => c.id === clubId)?.role ?? null;
}

export const canEditRole = (role: ClubRole | null) => role === "admin" || role === "coach";

/** Rôle dans l'espace courant, réactif. */
export function useWorkspaceRole(): ClubRole | null {
  return useWorkspace((s) => roleIn(s.clubId, s.clubs));
}
