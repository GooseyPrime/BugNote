import { useAuth } from "@clerk/clerk-react";

const BASE = import.meta.env.VITE_API_BASE as string;

export function useApi() {
  const { getToken } = useAuth();

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
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
