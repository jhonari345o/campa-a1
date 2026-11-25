export const REQUIRED_META_PERMISSIONS = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_read_engagement",
  "pages_show_list",
] as const;

export type MetaAssetConfig = {
  adAccountId: string;
  pageId: string;
  instagramUserId?: string;
  apiVersion: string;
};

type MetaRead = <T>(path: string, params: Record<string, string>) => Promise<T>;
type MetaAccount = { id?: string; account_status?: number; currency?: string };
type MetaPage = { id?: string; instagram_business_account?: { id?: string } };
type MetaPermissions = { data?: { permission: string; status: string }[] };

export type MetaConnectionStatus = {
  connected: boolean;
  apiVersion: string;
  facebookReady: boolean;
  instagramReady: boolean;
  missingPermissions: string[];
  issues: string[];
};

/** Only GETs are supplied by the server. Results contain no token or asset IDs. */
export async function inspectMetaConnection(config: MetaAssetConfig, read: MetaRead): Promise<MetaConnectionStatus> {
  const [actor, account, page, permissionResult, instagram] = await Promise.all([
    read<{ id?: string }>("me", { fields: "id" }),
    read<MetaAccount>(config.adAccountId, { fields: "id,account_status,currency" }),
    read<MetaPage>(config.pageId, {
      fields: config.instagramUserId ? "id,instagram_business_account{id}" : "id",
    }),
    read<MetaPermissions>("me/permissions", { fields: "permission,status", limit: "200" }),
    config.instagramUserId
      ? read<{ id?: string }>(config.instagramUserId, { fields: "id" })
      : Promise.resolve(null),
  ]);

  const issues: string[] = [];
  if (!actor.id) issues.push("Meta no identificó al usuario de la conexión.");
  if (account.id !== config.adAccountId) issues.push("La cuenta publicitaria no coincide con la configurada.");
  if (account.account_status !== 1) issues.push("La cuenta publicitaria no está activa.");
  // One sends budgets in USD cents; another currency must never be accepted silently.
  if (account.currency !== "USD") issues.push("La cuenta publicitaria debe operar en dólares (USD).");
  if (page.id !== config.pageId) issues.push("La página de Facebook no coincide con la configurada.");

  const granted = new Set((permissionResult.data ?? [])
    .filter((permission) => permission.status === "granted")
    .map((permission) => permission.permission));
  const required = [...REQUIRED_META_PERMISSIONS, ...(config.instagramUserId ? ["instagram_basic"] : [])];
  const missingPermissions = required.filter((permission) => !granted.has(permission));
  const facebookReady = issues.length === 0 && REQUIRED_META_PERMISSIONS.every((permission) => granted.has(permission));

  let instagramReady = false;
  if (config.instagramUserId) {
    const accessible = instagram?.id === config.instagramUserId;
    const linked = page.instagram_business_account?.id === config.instagramUserId;
    if (!accessible) issues.push("La cuenta de Instagram configurada no es accesible.");
    if (!linked) issues.push("Instagram debe estar vinculado a la página de Facebook configurada.");
    instagramReady = facebookReady && accessible && linked && granted.has("instagram_basic");
  }
  return {
    connected: facebookReady && (!config.instagramUserId || instagramReady),
    apiVersion: config.apiVersion,
    facebookReady,
    instagramReady,
    missingPermissions,
    issues,
  };
}

export function assertMetaConnectionReady(status: MetaConnectionStatus): void {
  if (!status.connected) throw new Error("La conexión con Meta necesita corregirse antes de preparar o activar anuncios.");
}
