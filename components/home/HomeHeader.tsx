type HomeHeaderProps = {
  monthLabel: string;
  profile: string;
};

export function HomeHeader({ monthLabel, profile }: HomeHeaderProps) {
  return (
    <header className="home-header">
      <div>
        <span className="eyebrow">Planejamento financeiro</span>
        <h1>Olá, {profile} 👋</h1>
        <p>{monthLabel}</p>
      </div>
    </header>
  );
}
