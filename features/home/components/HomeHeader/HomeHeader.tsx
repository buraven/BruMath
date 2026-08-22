import styles from "./HomeHeader.module.css";

type HomeHeaderProps = {
  monthLabel: string;
  profile: string;
};

export function HomeHeader({ monthLabel, profile }: HomeHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>Planejamento financeiro</span>
        <h1 className={styles.title}>Olá, {profile} 👋</h1>
        <p className={styles.month}>{monthLabel}</p>
      </div>
    </header>
  );
}
