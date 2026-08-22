import type { ReactNode } from "react";

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="ui-section-header">
      <h2>{title}</h2>
      {action ? <div className="ui-section-action">{action}</div> : null}
    </div>
  );
}
