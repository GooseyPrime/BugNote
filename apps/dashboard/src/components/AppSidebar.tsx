import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApi } from "../api";

type AppRow = { app_id: string; status: string; n: number };

export default function AppSidebar() {
  const api = useApi();
  const [rows, setRows] = useState<AppRow[]>([]);

  useEffect(() => {
    api.apps().then(setRows).catch(() => setRows([]));
  }, []);

  const byApp = rows.reduce<Record<string, { total: number; alert: number }>>(
    (acc, r) => {
      const cur = acc[r.app_id] ?? { total: 0, alert: 0 };
      cur.total += r.n;
      if (r.status === "failed" || r.status === "needs_info") cur.alert += r.n;
      acc[r.app_id] = cur;
      return acc;
    },
    {},
  );

  return (
    <aside className="w-56 shrink-0 border-r bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Apps
      </p>
      <nav className="space-y-1">
        <Link to="/" className="block rounded px-2 py-1 text-sm hover:bg-neutral-100">
          All apps
        </Link>
        {Object.entries(byApp).map(([appId, counts]) => (
          <Link
            key={appId}
            to={`/app/${appId}`}
            className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-neutral-100"
          >
            <span>{appId}</span>
            <span className="flex gap-1 text-xs">
              <span className="rounded bg-neutral-200 px-1">{counts.total}</span>
              {counts.alert > 0 && (
                <span className="rounded bg-red-600 px-1 text-white">{counts.alert}</span>
              )}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
