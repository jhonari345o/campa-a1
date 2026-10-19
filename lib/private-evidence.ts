type EvidenceDependencies = {
  getProfile: () => Promise<{ is_platform_admin: boolean } | null>;
  readAsset: (relativePath: string) => Promise<Uint8Array>;
};

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function denied(status: number) {
  return new Response(null, { status, headers: privateHeaders });
}

/** The report currently exposes these campaigns only to platform admins. */
export async function servePrivateEvidence(asset: string[], dependencies: EvidenceDependencies) {
  try {
    const profile = await dependencies.getProfile();
    if (!profile) return denied(401);
    if (profile.is_platform_admin !== true) return denied(403);

    // Accept only generated campaign/file names, never arbitrary filesystem paths.
    if (asset.length !== 2 || !/^[a-z0-9-]+$/.test(asset[0]) || !/^[a-z0-9-]+\.webp$/.test(asset[1])) {
      return denied(404);
    }
    const bytes = await dependencies.readAsset(asset.join("/"));
    return new Response(new Uint8Array(bytes), {
      headers: { ...privateHeaders, "Content-Type": "image/webp" },
    });
  } catch (error) {
    // Authentication/configuration errors fail closed and disclose no file details.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return denied(404);
    return denied(503);
  }
}
