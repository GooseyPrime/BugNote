import { useEffect } from "react";
import { init, type BugNoteConfig } from "./index";

export function BugNoteProvider(
  props: BugNoteConfig & { children?: React.ReactNode },
) {
  const { children, ...cfg } = props;
  useEffect(() => {
    init(cfg);
  }, []);
  return <>{children}</>;
}
