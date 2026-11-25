/** IDs are resolved against the authenticated workspace at the destination. */
export function clientPlanningHref(clientId:string,view:"planner"|"diy"|"plans"="planner") {
 return `/planificador?view=${view}&client=${encodeURIComponent(clientId)}`;
}
export function requestedWorkspaceClient<T extends {id:string}>(clients:T[],id:string|undefined):T|null {
 return id ? clients.find(client=>client.id===id)??null : null;
}
