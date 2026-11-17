import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, photoFolder, signPhotos } from "@/lib/data/roster-api";

/**
 * Logo affiché dans le stade de la vue 3D : celui du club (modifiable par ses administrateurs)
 * ou, dans l'espace personnel, celui de l'utilisateur. Le fichier est rangé avec les photos,
 * dans le dossier de l'espace ; la base vérifie que le chemin enregistré y reste.
 */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

async function currentUid() {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

const target = async (clubId: string | null) =>
  clubId
    ? db().from("clubs").select("logo_path").eq("id", clubId)
    : db()
        .from("profiles")
        .select("logo_path")
        .eq("id", (await currentUid()) ?? "");

export async function getLogoPath(clubId: string | null): Promise<string | null> {
  const { data, error } = await target(clubId);
  if (error || !data?.[0]) return null;
  return (data[0] as { logo_path: string | null }).logo_path ?? null;
}

async function writePath(clubId: string | null, path: string | null) {
  const query = clubId
    ? db().from("clubs").update({ logo_path: path }).eq("id", clubId)
    : db()
        .from("profiles")
        .update({ logo_path: path })
        .eq("id", (await currentUid()) ?? "");
  const { data, error } = await query.select("logo_path");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("forbidden");
}

/** Image réduite à 512 px au plus, en PNG (la transparence du logo est gardée). */
export async function prepareLogo(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("invalid image"));
      img.src = url;
    });
    const w = image.naturalWidth || 512;
    const h = image.naturalHeight || 512;
    const scale = Math.min(1, 512 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function setLogo(clubId: string | null, logo: Blob): Promise<string> {
  const previous = await getLogoPath(clubId);
  const path = `${await photoFolder(clubId)}/logo-${Date.now()}.png`;
  const bucket = db().storage.from(PHOTO_BUCKET);
  const upload = await bucket.upload(path, logo, { contentType: "image/png" });
  if (upload.error) throw new Error(upload.error.message);
  try {
    await writePath(clubId, path);
  } catch (e) {
    await bucket.remove([path]);
    throw e;
  }
  if (previous) await bucket.remove([previous]);
  return path;
}

export async function removeLogo(clubId: string | null) {
  const previous = await getLogoPath(clubId);
  await writePath(clubId, null);
  if (previous) await db().storage.from(PHOTO_BUCKET).remove([previous]);
}

export async function logoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return (await signPhotos([path])).get(path) ?? null;
}
