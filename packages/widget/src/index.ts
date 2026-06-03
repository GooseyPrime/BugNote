import { install } from "./buffer";
import { renderButton } from "./ui";

export interface BugNoteConfig {
  appId: string;
  endpoint: string;
  appVersion?: string;
  getUserId?: () => string | undefined;
  position?: "bottom-right" | "bottom-left";
}

export function init(config: BugNoteConfig): void {
  install();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderButton(config));
  } else {
    renderButton(config);
  }
}

export { snapshot } from "./buffer";
