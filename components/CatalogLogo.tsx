"use client";
import Image from "next/image";
import {useState} from "react";
import assets from "@/lib/catalog-logo-assets.json";
import type {MediaGroup} from "@/lib/media-groups";
import {MediaSelectionIcon} from "./MediaSelectionIcon";

/** Public identity assets are resized at build time and have content-hashed URLs.
 * Show the medium immediately while a logo loads, including on connection errors. */
export function CatalogLogo({src,alt,medium,priority=false,className="object-contain p-2"}:{src:string|null;alt:string;medium:MediaGroup;priority?:boolean;className?:string}) {
  const url=src?(assets as Record<string,string>)[src]??src:null;
  const darkPlate=src?.includes("/radio-centro-quito/")??false;
  const [loaded,setLoaded]=useState<string|null>(null);
  return <span className={`relative block h-full w-full ${darkPlate?"rounded-md bg-[#232824]":""}`} role={alt?"img":undefined} aria-label={alt||undefined}>
    {(!url||loaded!==url)&&<span className={`absolute inset-0 grid place-items-center ${darkPlate?"text-[#c9e4ad]":"text-forest"} [&>svg]:h-8 [&>svg]:w-8`} aria-hidden="true"><MediaSelectionIcon medium={medium}/></span>}
    {url&&<Image key={url} src={url} alt="" fill unoptimized priority={priority} loading={priority?undefined:"lazy"} className={`${className} ${loaded===url?"opacity-100":"opacity-0"}`} onLoad={()=>setLoaded(url)} onError={()=>setLoaded(null)}/>}
  </span>;
}
