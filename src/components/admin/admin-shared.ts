"use client";

import { useCallback, useState } from "react";
import type { Perm } from "@/server/permissions";

export async function adminCall<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Action failed");
  return data.data as T;
}

export function useAdminAction(perms: Perm[]) {
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = useCallback(
    async <T = unknown>(action: string, params: Record<string, unknown> = {}, okMsg?: string): Promise<T | null> => {
      setBusy(action);
      try {
        const data = await adminCall<T>(action, params);
        if (okMsg) setFlash({ kind: "ok", text: okMsg });
        return data;
      } catch (e) {
        setFlash({ kind: "err", text: e instanceof Error ? e.message : "Failed" });
        return null;
      } finally {
        setBusy(null);
        setTimeout(() => setFlash(null), 4000);
      }
    },
    [],
  );

  const can = useCallback((p: Perm) => perms.includes(p), [perms]);

  return { run, busy, flash, can };
}
