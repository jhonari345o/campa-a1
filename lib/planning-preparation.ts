import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from "node:crypto";
import {gzipSync,gunzipSync} from "node:zlib";

const purpose="ad-mavericks-one:planning-preparation:v1";
const lifetimeMs=5*60_000, maxBytes=1_000_000, maxToken=600_000;
function key(secret:string){if(!secret)throw new Error("PLANNING_KEY_MISSING");return Buffer.from(hkdfSync("sha256",secret,"",purpose,32));}

/** Opaque, short-lived handoff: no source data, client claims or secret is trusted from the browser. */
export function sealPlanningPreparation(data:unknown,owner:string,secret:string,now=Date.now()):string {
  const plain=Buffer.from(JSON.stringify({version:1,expiresAt:now+lifetimeMs,data}));
  if(plain.length>maxBytes)throw new Error("PLANNING_PREPARATION_TOO_LARGE");
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(secret),iv);
  cipher.setAAD(Buffer.from(purpose+":"+owner));
  const encrypted=Buffer.concat([cipher.update(gzipSync(plain)),cipher.final()]);
  const token=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64url");
  if(token.length>maxToken)throw new Error("PLANNING_PREPARATION_TOO_LARGE");
  return token;
}

export function openPlanningPreparation<T>(token:string,owner:string,secret:string,now=Date.now()):T {
  if(typeof token!=="string"||token.length<40||token.length>maxToken||!/^[A-Za-z0-9_-]+$/.test(token))throw new Error("INVALID_PLANNING_PREPARATION");
  try{
    const bytes=Buffer.from(token,"base64url"),decipher=createDecipheriv("aes-256-gcm",key(secret),bytes.subarray(0,12));
    decipher.setAAD(Buffer.from(purpose+":"+owner));
    decipher.setAuthTag(bytes.subarray(12,28));
    const value=JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]),{maxOutputLength:maxBytes}).toString());
    if(value.version!==1||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+lifetimeMs)throw new Error("EXPIRED");
    return value.data as T;
  }catch{throw new Error("INVALID_PLANNING_PREPARATION");}
}
