const media=new Set(['tv','radio','ooh','press','digital','influencers']);
/** Presentation-only navigation. The destination route separately enforces platform administration. */
export function workspacePreviewHref(companyId:string,href:string){
 const base=`/consola/espacios/${encodeURIComponent(companyId)}`;
 const u=new URL(href,'https://one.ad-mavericks.com');
 if(u.pathname==='/reportes'||u.pathname==='/clientes')return `${base}?view=reports`;
 if(u.pathname==='/planificador'&&u.searchParams.get('view')==='media')return `${base}?view=media&section=${media.has(u.searchParams.get('section')??'')?u.searchParams.get('section'):'tv'}`;
 return base;
}
