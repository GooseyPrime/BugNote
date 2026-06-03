import type { Breadcrumb, ConsoleEntry, ErrorEntry } from "@bugnote/shared";
import { scrubString } from "./scrub";

class Ring<T> {
  private buf: T[] = [];
  constructor(private max: number) {}
  push(x: T) {
    this.buf.push(x);
    if (this.buf.length > this.max) this.buf.shift();
  }
  snapshot() {
    return [...this.buf];
  }
}

const logs = new Ring<ConsoleEntry>(100);
const errs = new Ring<ErrorEntry>(50);
const crumbs = new Ring<Breadcrumb>(50);
let installed = false;

function stringify(a: unknown): string {
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function describe(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className
      ? `.${el.className.split(/\s+/)[0]}`
      : "";
  const text = (el.textContent ?? "").trim().slice(0, 40);
  return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
}

export function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        logs.push({
          level,
          ts: Date.now(),
          args: args.map((a) => scrubString(stringify(a))),
        });
      } catch {
        /* never break host */
      }
      orig(...args);
    };
  });

  window.addEventListener("error", (e) => {
    try {
      errs.push({
        ts: Date.now(),
        kind: "error",
        name: (e.error?.name as string) ?? "Error",
        message: scrubString(e.message ?? String(e.error)),
        stack: e.error?.stack ? scrubString(e.error.stack) : undefined,
        source: e.filename,
        line: e.lineno,
        col: e.colno,
      });
    } catch {
      /* */
    }
  });

  window.addEventListener("unhandledrejection", (e) => {
    try {
      const r = e.reason as { name?: string; message?: string; stack?: string };
      errs.push({
        ts: Date.now(),
        kind: "unhandledrejection",
        name: r?.name ?? "UnhandledRejection",
        message: scrubString(r?.message ?? stringify(r)),
        stack: r?.stack ? scrubString(r.stack) : undefined,
      });
    } catch {
      /* */
    }
  });

  window.addEventListener(
    "click",
    (e) => {
      try {
        const t = e.target as HTMLElement | null;
        if (t) crumbs.push({ ts: Date.now(), type: "click", message: describe(t) });
      } catch {
        /* */
      }
    },
    { capture: true },
  );

  const nav = (url: string) => {
    try {
      crumbs.push({ ts: Date.now(), type: "navigation", message: url });
    } catch {
      /* */
    }
  };

  ["pushState", "replaceState"].forEach((m) => {
    const orig = (history as History & Record<string, unknown>)[m] as (
      ...args: unknown[]
    ) => unknown;
    (history as History & Record<string, unknown>)[m] = function (
      this: History,
      ...args: unknown[]
    ) {
      const r = orig.apply(this, args);
      nav(location.href);
      return r;
    };
  });
  window.addEventListener("popstate", () => nav(location.href));

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const res = await origFetch(...args);
      if (!res.ok) {
        crumbs.push({
          ts: Date.now(),
          type: "fetch",
          message: `${res.status} ${String(args[0])}`,
        });
      }
      return res;
    } catch (err) {
      crumbs.push({
        ts: Date.now(),
        type: "fetch",
        message: `failed ${String(args[0])}`,
      });
      throw err;
    }
  };
}

export function snapshot() {
  return {
    console: logs.snapshot(),
    errors: errs.snapshot(),
    breadcrumbs: crumbs.snapshot(),
  };
}
