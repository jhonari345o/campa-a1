const normalized=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
/** Public identity assets verified against the broadcaster. Geography disambiguates shared station names. */
export function broadcastLogo(name:string,medium:"radio"|"television",context=""):string|null {
 const key=normalized(name).replace(/^radio /,""),place=normalized(context);
 const exact=(aliases:string[])=>aliases.some(a=>key===a||key.startsWith(`${a} `));
 if(medium==="television"){
  for(const [aliases,path] of TV)if(exact(aliases))return path;
  return null;
 }
 for(const [aliases,path] of RADIO)if(exact(aliases))return path;
 if(exact(["fiesta"])&&/\b(machala|el oro)\b/.test(place))return "/providers/radio/radio-fiesta-machala/logo.webp";
 if(exact(["planeta"])&&/\b(riobamba|chimborazo)\b/.test(place))return "/providers/radio/radio-planeta-riobamba/logo.webp";
 if(exact(["vision"])&&/\b(cuenca|azuay)\b/.test(place))return "/providers/radio/radio-vision-cuenca/logo.webp";
 return null;
}
const TV:[string[],string][]=[
 [["uv television","uv tv"],"/providers/tv/uv-television.png"],[["cocavision"],"/providers/tv/cocavision.png"],
 [["ecuavisa"],"/providers/tv/ecuavisa.png"],[["tc","tc television"],"/providers/tv/tc-television.png"],[["teleamazonas"],"/providers/tv/teleamazonas.png"],[["oromar","oromar tv"],"/providers/tv/oromar-tv.png"],[["ecuador tv"],"/providers/tv/ecuador-tv.png"],
 [["rts"],"/providers/tv/rts.png"],[["tvc"],"/providers/tv/tvc.png"],[["red comercial"],"/providers/tv/red-comercial.png"],[["zaracay tv","zaracay television"],"/providers/tv/zaracay-tv.png"],[["nortvision"],"/providers/tv/nortvision.png"],[["unsion","unsion tv"],"/providers/tv/unsion-tv.png"],[["catomedia","ucsg tv"],"/providers/catomedia/catomedia-logo.png"]
];
const RADIO:[string[],string][]=[
 [["galaxia"],"/providers/radio/galaxia/logo.png"],[["tropicalida"],"/providers/radio/tropicalida/logo.png"],[["diblu"],"/providers/radio/diblu/logo.webp"],[["sonorama"],"/providers/radio/sonorama/logo.png"],[["rumba"],"/providers/radio/rumba/logo.png"],[["caravana"],"/providers/radio/caravana/logo.webp"],[["sucre"],"/providers/radio/sucre/logo.png"],[["antena 3"],"/providers/radio/antena-3/logo.png"],[["la red"],"/providers/radio/la-red/logo.png"],
 [["kch"],"/providers/radio/kch/logo.webp"],[["forever"],"/providers/radio/forever/logo.webp"],[["la tuya"],"/providers/radio/la-tuya/logo.webp"],[["canela"],"/providers/radio/canela-guayas/logo.webp"],[["los 40","los40"],"/providers/radio/los40/logo.png"],[["i99","i 99"],"/providers/radio/radio-i99/logo.webp"],[["iluman"],"/providers/radio/radio-iluman/logo.webp"],[["boqueron"],"/providers/radio/radio-boqueron/logo.webp"],[["ambato"],"/providers/radio/radio-ambato/logo.webp"],[["alborada"],"/providers/radio/radio-alborada-ibarra/logo.webp"],[["ovacion"],"/providers/radio/radio-ovacion-machala/logo.webp"],[["centro"],"/providers/radio/radio-centro/logo.png"],[["fm mundo"],"/providers/radio/fm-mundo/logo.png"],[["blue","blue radio"],"/providers/radio/blue-radio/logo.png"],[["fuego"],"/providers/radio/radio-fuego/logo.jpg"],[["catomedia","ucsg"],"/providers/catomedia/catomedia-logo.png"]
];
