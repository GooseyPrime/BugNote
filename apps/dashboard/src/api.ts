import { useAuthCredential } from "./auth-context";

const BASE = import.meta.env.VITE_API_BASE as string;

export function useApi() {
  const { credential, clearCredential } = useAuthCredential();

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    if (!credential) {
      throw new Error("not authenticated");
    }
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 || res.status === 403) {
      clearCredential();
      throw new Error(`${res.status} ${await res.text()}`);
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  return {
    apps: () =>
      req<Array<{ app_id: string; status: string; n: number }>>("/v1/admin/apps"),
    reports: (appId?: string, status?: string) =>
      req<Record<string, unknown>[]>(
        `/v1/admin/reports?${new URLSearchParams({
          ...(appId ? { appId } : {}),
          ...(status ? { status } : {}),
        })}`,
      ),
    report: (id: string) => req<Record<string, unknown>>(`/v1/admin/reports/${id}`),
    setStatus: (id: string, status: string) =>
      req(`/v1/admin/reports/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    retry: (id: string, stage = "triage") =>
      req(`/v1/admin/reports/${id}/retry`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      }),
  };
}
