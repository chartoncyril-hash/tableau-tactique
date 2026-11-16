/** Transforme un lien YouTube ou Vimeo en adresse d'intégration ; null si le lien n'est pas reconnu. */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const idPattern = /^[\w-]{6,20}$/;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return idPattern.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : ["shorts", "embed", "live"].includes(parts[0])
          ? parts[1]
          : null;
    return id && idPattern.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d{6,12}$/.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
