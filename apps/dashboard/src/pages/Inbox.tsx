import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../api";

const STATUSES = [
  "",
  "queued",
  "analyzing",
  "fix_proposed",
  "pr_opened",
  "needs_info",
  "failed",
] as const;

export default function Inbox() {
  const { appId } = useParams();
  const api = useApi();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    api
      .reports(appId, status || undefined)
      .then(setRows)
      .catch(() => setRows([]));
  }, [appId, status]);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold">
        {appId ? `Reports — ${appId}` : "All reports"}
      </h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              status === s
                ? "bg-neutral-900 text-white"
                : "bg-neutral-200 text-neutral-800"
            }`}
          >
            {s || "all"}
          </button>
        ))}
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-neutral-500">
            <th className="py-2">Note</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Dup</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="border-b hover:bg-neutral-100">
              <td className="py-2">
                <Link to={`/report/${r.id}`} className="text-blue-700 underline">
                  {String(r.note_preview ?? r.id).slice(0, 80)}
                </Link>
              </td>
              <td>{String(r.severity)}</td>
              <td>{String(r.status)}</td>
              <td>{String(r.dup_count ?? 0)}</td>
              <td>{new Date(String(r.updated_at)).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
