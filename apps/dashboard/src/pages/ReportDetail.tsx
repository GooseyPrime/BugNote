import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../api";

function DiffBlock({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className="overflow-auto rounded border bg-neutral-900 p-3 text-xs text-neutral-100">
      {lines.map((line, i) => {
        let cls = "";
        if (line.startsWith("+")) cls = "text-green-400";
        else if (line.startsWith("-")) cls = "text-red-400";
        return (
          <div key={i} className={cls}>
            {line}
          </div>
        );
      })}
    </pre>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const api = useApi();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  const load = () => {
    if (!id) return;
    api.report(id).then(setRow).catch(() => setRow(null));
  };

  useEffect(load, [id]);

  if (!row) return <p className="p-4">Loading…</p>;

  const dossier = (row.dossier ?? {}) as Record<string, unknown>;
  const fix = dossier.fix as Record<string, unknown> | undefined;
  const consoleLog = (row.console_log ?? []) as Array<Record<string, unknown>>;
  const errors = (row.errors ?? []) as Array<Record<string, unknown>>;
  const breadcrumbs = (row.breadcrumbs ?? []) as Array<Record<string, unknown>>;
  const ctx = (row.context ?? {}) as Record<string, unknown>;

  type TrailLine = Record<string, unknown> & { _kind: string; ts?: number };
  const trail: TrailLine[] = [
    ...consoleLog.map((c): TrailLine => ({ ...c, _kind: "console" })),
    ...errors.map((e): TrailLine => ({ ...e, _kind: "error" })),
    ...breadcrumbs.map((b): TrailLine => ({ ...b, _kind: "breadcrumb" })),
  ].sort((a, b) => Number(a.ts ?? 0) - Number(b.ts ?? 0));

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-blue-700 underline">
          ← Inbox
        </Link>
        <h1 className="text-lg font-semibold">Report {String(row.id).slice(0, 8)}</h1>
        <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">{String(row.status)}</span>
        {dossier.haltedReason != null && dossier.haltedReason !== "" ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Halted: {String(dossier.haltedReason)}
          </span>
        ) : null}
        {typeof dossier.costUsd === "number" && (
          <span className="text-xs text-neutral-600">Cost: ${dossier.costUsd.toFixed(4)}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => api.setStatus(String(row.id), "duplicate").then(load)}
        >
          Mark duplicate
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => api.setStatus(String(row.id), "needs_info").then(load)}
        >
          Mark resolved
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => api.retry(String(row.id), "triage").then(load)}
        >
          Re-run triage
        </button>
      </div>

      {typeof row.screenshot === "string" && row.screenshot && (
        <img
          src={row.screenshot}
          alt="screenshot"
          className="max-h-96 rounded border"
        />
      )}

      <section>
        <h2 className="mb-2 font-medium">Context</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-neutral-500">URL</dt>
          <dd>{String(ctx.url ?? "")}</dd>
          <dt className="text-neutral-500">Route</dt>
          <dd>{String(ctx.route ?? "—")}</dd>
          <dt className="text-neutral-500">User</dt>
          <dd>{String(ctx.userId ?? "—")}</dd>
          <dt className="text-neutral-500">Session</dt>
          <dd className="font-mono text-xs">{String(ctx.sessionId ?? "")}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Dossier</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(["triage", "analysis", "fix"] as const).map((key) =>
            dossier[key] ? (
              <div key={key} className="rounded border bg-white p-3 text-sm">
                <h3 className="mb-1 font-semibold capitalize">{key}</h3>
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(dossier[key], null, 2)}
                </pre>
              </div>
            ) : null,
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Console & breadcrumbs</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-neutral-950 p-3 font-mono text-xs text-neutral-100">
          {trail.map((line, i) => (
            <div
              key={i}
              className={line._kind === "error" ? "text-red-400" : "text-neutral-300"}
            >
              [{line._kind}] {String(line.message ?? JSON.stringify(line.args ?? ""))}
            </div>
          ))}
        </pre>
      </section>

      {fix && (
        <section>
          <h2 className="mb-2 font-medium">Proposed fix</h2>
          <p className="text-sm">{String(fix.summary)}</p>
          <p className="text-xs text-neutral-600">Confidence: {String(fix.confidence)}</p>
          {typeof fix.diff === "string" && <DiffBlock diff={fix.diff} />}
          {(typeof row.pr_url === "string" || typeof dossier.prUrl === "string") && (
            <a
              href={String(row.pr_url ?? dossier.prUrl)}
              className="mt-2 inline-block text-blue-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Open draft PR
            </a>
          )}
        </section>
      )}
    </div>
  );
}
