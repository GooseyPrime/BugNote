import html2canvas from "html2canvas";
import type { CaptureContext } from "@bugnote/shared";

const SID_KEY = "bn_sid";

function sessionId(): string {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

export function captureContext(
  getUserId?: () => string | undefined,
  appVersion?: string,
): CaptureContext {
  return {
    url: location.href,
    route: location.pathname,
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    appVersion,
    userId: getUserId?.(),
    sessionId: sessionId(),
  };
}

export async function captureScreenshot(): Promise<string> {
  try {
    const scale = Math.min(1, 1280 / window.innerWidth);
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      scale,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
