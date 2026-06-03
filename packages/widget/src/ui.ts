import type { BugReportPayload, Severity } from "@bugnote/shared";
import { snapshot } from "./buffer";
import { captureContext, captureScreenshot } from "./capture";
import type { BugNoteConfig } from "./index";

type Rect = { x: number; y: number; w: number; h: number };

function applyRedactions(
  dataUrl: string,
  rects: Rect[],
  imgW: number,
  imgH: number,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const sx = img.width / imgW;
      const sy = img.height / imgH;
      ctx.fillStyle = "#000";
      for (const r of rects) {
        ctx.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
      }
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function renderButton(cfg: BugNoteConfig) {
  if (typeof document === "undefined") return;

  const host = document.createElement("div");
  host.id = "bugnote-host";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.id = "bugnote-style";
  style.textContent = `
    .bn-btn { position:fixed; z-index:2147483646; bottom:16px; ${cfg.position === "bottom-left" ? "left:16px" : "right:16px"};
      padding:10px 14px; border-radius:999px; border:none; cursor:pointer; font:600 13px system-ui,sans-serif;
      background:#111; color:#fff; box-shadow:0 4px 14px rgba(0,0,0,.25); }
    .bn-overlay { position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; }
    .bn-modal { background:#fff; color:#111; width:min(520px,92vw); max-height:90vh; overflow:auto; border-radius:12px; padding:16px; font:14px system-ui,sans-serif; }
    .bn-thumb { position:relative; max-width:100%; border:1px solid #ddd; border-radius:8px; overflow:hidden; }
    .bn-thumb img { display:block; max-width:100%; }
    .bn-field { margin:10px 0; }
    .bn-field label { display:block; font-size:12px; color:#555; margin-bottom:4px; }
    .bn-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    .bn-actions button { padding:8px 12px; border-radius:8px; border:1px solid #ccc; cursor:pointer; }
    .bn-primary { background:#111; color:#fff; border-color:#111 !important; }
    .bn-toast { position:fixed; bottom:72px; ${cfg.position === "bottom-left" ? "left:16px" : "right:16px"}; background:#111; color:#fff; padding:8px 12px; border-radius:8px; font:13px system-ui; z-index:2147483647; }
  `;
  shadow.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "bn-btn";
  btn.type = "button";
  btn.textContent = "🐛 Report";
  btn.addEventListener("click", () => openModal(cfg, shadow));
  shadow.appendChild(btn);
  document.body.appendChild(host);
}

async function openModal(cfg: BugNoteConfig, shadow: ShadowRoot) {
  const overlay = document.createElement("div");
  overlay.className = "bn-overlay";
  const modal = document.createElement("div");
  modal.className = "bn-modal";

  let screenshot = "";
  let imgW = 1;
  let imgH = 1;
  const redactions: Rect[] = [];
  let drawing = false;
  let startX = 0;
  let startY = 0;

  try {
    screenshot = await captureScreenshot();
  } catch {
    screenshot = "";
  }

  const snap = snapshot();
  const ctx = captureContext(cfg.getUserId, cfg.appVersion);

  modal.innerHTML = `
    <h3 style="margin:0 0 8px">Report a bug</h3>
    <div class="bn-thumb" id="bn-thumb"><img id="bn-img" alt="screenshot" /></div>
    <div class="bn-field">
      <label>Severity</label>
      <select id="bn-sev">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
    </div>
    <div class="bn-field">
      <label>Note</label>
      <textarea id="bn-note" rows="3" style="width:100%"></textarea>
    </div>
    <div class="bn-actions">
      <button type="button" id="bn-cancel">Cancel</button>
      <button type="button" id="bn-submit" class="bn-primary">Submit</button>
    </div>
  `;

  overlay.appendChild(modal);
  shadow.appendChild(overlay);

  const img = modal.querySelector("#bn-img") as HTMLImageElement;
  if (screenshot && img) {
    img.src = screenshot;
    img.onload = () => {
      imgW = img.clientWidth || 1;
      imgH = img.clientHeight || 1;
    };
  } else if (img) {
    img.style.display = "none";
  }

  const thumb = modal.querySelector("#bn-thumb") as HTMLElement;
  thumb?.addEventListener("mousedown", (e) => {
    const rect = thumb.getBoundingClientRect();
    drawing = true;
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  });
  thumb?.addEventListener("mouseup", (e) => {
    if (!drawing) return;
    drawing = false;
    const rect = thumb.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    redactions.push({
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      w: Math.abs(endX - startX),
      h: Math.abs(endY - startY),
    });
  });

  const close = () => overlay.remove();
  modal.querySelector("#bn-cancel")?.addEventListener("click", close);

  let submitting = false;
  modal.querySelector("#bn-submit")?.addEventListener("click", async () => {
    if (submitting) return;
    submitting = true;
    const sev = (modal.querySelector("#bn-sev") as HTMLSelectElement).value as Severity;
    const note = (modal.querySelector("#bn-note") as HTMLTextAreaElement).value;

    let shot = screenshot;
    if (shot && redactions.length) {
      shot = await applyRedactions(shot, redactions, imgW, imgH);
    }

    const payload: BugReportPayload = {
      appId: cfg.appId,
      severity: sev,
      note: note || undefined,
      context: ctx,
      console: snap.console,
      errors: snap.errors,
      breadcrumbs: snap.breadcrumbs,
      screenshotBase64: shot || undefined,
    };

    try {
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(shadow, "Report sent — thank you!", cfg.position);
      close();
    } catch {
      toast(shadow, "Failed to send report", cfg.position);
      submitting = false;
    }
  });
}

function toast(shadow: ShadowRoot, msg: string, position?: BugNoteConfig["position"]) {
  const el = document.createElement("div");
  el.className = "bn-toast";
  el.textContent = msg;
  if (position === "bottom-left") el.style.left = "16px";
  else el.style.right = "16px";
  shadow.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
