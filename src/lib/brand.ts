"use client";

import { create } from "zustand";
import { getLogoPath, logoUrl, prepareLogo, removeLogo, setLogo } from "@/lib/data/logo-api";

/** Logo de chaque espace (club ou personnel), chargé une fois et partagé par la vue 3D et les réglages. */
interface Brand {
  path: string | null;
  url: string | null;
}

export const useBrands = create<{ brands: Record<string, Brand> }>(() => ({
  brands: {},
}));

const keyOf = (clubId: string | null) => clubId ?? "me";
const loading = new Map<string, Promise<void>>();

async function fetchBrand(clubId: string | null) {
  try {
    const path = await getLogoPath(clubId);
    const url = await logoUrl(path);
    useBrands.setState((s) => ({
      brands: { ...s.brands, [keyOf(clubId)]: { path, url } },
    }));
  } catch {
    useBrands.setState((s) => ({
      brands: { ...s.brands, [keyOf(clubId)]: { path: null, url: null } },
    }));
  }
}

export function loadBrand(clubId: string | null, force = false) {
  const key = keyOf(clubId);
  if (!force && (useBrands.getState().brands[key] || loading.has(key))) return;
  const job = fetchBrand(clubId).finally(() => loading.delete(key));
  loading.set(key, job);
}

export function useBrand(clubId: string | null): Brand | undefined {
  return useBrands((s) => s.brands[keyOf(clubId)]);
}

export async function uploadBrandLogo(clubId: string | null, file: Blob) {
  const path = await setLogo(clubId, await prepareLogo(file));
  const url = await logoUrl(path);
  useBrands.setState((s) => ({
    brands: { ...s.brands, [keyOf(clubId)]: { path, url } },
  }));
}

export async function clearBrandLogo(clubId: string | null) {
  await removeLogo(clubId);
  useBrands.setState((s) => ({
    brands: { ...s.brands, [keyOf(clubId)]: { path: null, url: null } },
  }));
}
