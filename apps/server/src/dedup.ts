import { createHash } from "node:crypto";
import type { BugReportPayload } from "@bugnote/shared";

function normalize(s: string): string {
  return s
    .replace(/0x[0-9a-f]+/gi, "0x")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<uuid>",
    )
    .replace(/\d+/g, "N")
    .trim();
}

function normStack(stack: string): string {
  return stack
    .split("\n")
    .slice(0, 5)
    .map((l) =>
      l.replace(/:\d+:\d+/g, "").replace(/https?:\/\/[^\s)]+/g, "<url>"),
    )
    .join("|");
}

export function computeSignature(p: BugReportPayload): string {
  const top = p.errors[0];
  const basis = top
    ? `${top.name}:${normalize(top.message)}:${normStack(top.stack ?? "")}`
    : `note:${normalize(p.note ?? "")}:${p.context.route ?? p.context.url}`;
  return createHash("sha256").update(`${p.appId}|${basis}`).digest("hex").slice(0, 32);
}
