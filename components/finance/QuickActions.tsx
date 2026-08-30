import styles from "./QuickActions.module.css";

type QuickAction = {
  label: string;
  onClick: () => void;
};

type QuickActionsProps = {
  actions: QuickAction[];
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className={styles.actions}>
      {actions.map(action => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
