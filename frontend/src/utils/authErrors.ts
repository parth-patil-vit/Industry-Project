export function isTokenSkewError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  return msg.toLowerCase().includes("token used too early");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry API calls when Firebase token is not yet valid on the server (clock skew). */
export async function withTokenSkewRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; delayMs?: number }
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 5;
  const delayMs = opts?.delayMs ?? 1200;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isTokenSkewError(e) || attempt >= maxRetries) throw e;
      await sleep(delayMs * (attempt + 1));
    }
  }

  throw new Error("Token skew retry failed");
}
