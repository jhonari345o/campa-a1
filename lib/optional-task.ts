/** Optional enrichment must never outlive the HTTP request that needs it. */
export async function optionalWithinBudget<T>(
  task: (signal: AbortSignal) => Promise<T>,
  fallback: () => T,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(fallback());
    }, Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)).catch(() => fallback()), expired]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
