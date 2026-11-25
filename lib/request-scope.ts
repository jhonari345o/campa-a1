import {AsyncLocalStorage} from "node:async_hooks";

// Only explicitly wrapped route requests share reads. Stores are never reused
// across users, requests, server actions or background jobs.
const scope=new AsyncLocalStorage<Map<string,Promise<unknown>>>();
export function withRequestScope<T>(task:()=>Promise<T>):Promise<T> {
  return scope.run(new Map(),task);
}
export function requestScoped<T>(key:string,read:()=>Promise<T>):Promise<T> {
  const values=scope.getStore();if(!values)return read();
  const found=values.get(key);if(found)return found as Promise<T>;
  const pending=Promise.resolve().then(read);values.set(key,pending);return pending;
}
