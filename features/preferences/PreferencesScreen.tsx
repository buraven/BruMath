"use client";

import { Check, Monitor, Moon, Settings2, Sun, Users } from "lucide-react";
import styles from "./PreferencesScreen.module.css";

type Profile = "Bruna" | "Matheus" | "Casal";
type ThemeMode = "light" | "dark" | "system";

type PreferencesScreenProps = {
  profile: Profile;
  theme: ThemeMode;
  onProfileChange: (profile: Profile) => void;
  onThemeChange: (theme: ThemeMode) => void;
};

const profiles: Array<{ value: Profile; detail: string }> = [
  { value: "Bruna", detail: "Use o contexto pessoal da Bruna." },
  { value: "Matheus", detail: "Use o contexto pessoal do Matheus." },
  { value: "Casal", detail: "Veja as finanças compartilhadas." },
];

const themes: Array<{
  value: ThemeMode;
  label: string;
  detail: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Claro", detail: "Interface clara.", icon: Sun },
  { value: "dark", label: "Escuro", detail: "Interface escura.", icon: Moon },
  {
    value: "system",
    label: "Automático",
    detail: "Acompanha o sistema.",
    icon: Monitor,
  },
];

export function PreferencesScreen({
  profile,
  theme,
  onProfileChange,
  onThemeChange,
}: PreferencesScreenProps) {
  return (
    <section className={styles.screen} aria-labelledby="preferences-title">
      <header className={styles.heading}>
        <span className={styles.eyebrow}>
          <Settings2 size={15} /> Sua experiência
        </span>
        <h1 id="preferences-title">Preferências</h1>
        <p>Escolha o contexto e a aparência que fazem sentido para você.</p>
      </header>

      <section className={styles.section} aria-labelledby="profile-title">
        <div className={styles.sectionHeading}>
          <Users size={18} />
          <div>
            <h2 id="profile-title">Perfil ativo</h2>
            <p>Define o contexto padrão usado no BruMath.</p>
          </div>
        </div>
        <div className={styles.choiceGrid}>
          {profiles.map((option) => {
            const selected = profile === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.choice} ${selected ? styles.selected : ""}`}
                aria-pressed={selected}
                onClick={() => onProfileChange(option.value)}
              >
                <span>
                  <strong>{option.value}</strong>
                  <small>{option.detail}</small>
                </span>
                {selected ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="theme-title">
        <div className={styles.sectionHeading}>
          <Sun size={18} />
          <div>
            <h2 id="theme-title">Tema</h2>
            <p>Aplicado imediatamente e salvo para a próxima visita.</p>
          </div>
        </div>
        <div className={styles.choiceGrid}>
          {themes.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.choice} ${selected ? styles.selected : ""}`}
                aria-pressed={selected}
                onClick={() => onThemeChange(option.value)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                {selected ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
