import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./MonthSelector.module.css";

type MonthSelectorProps = {
  monthLabel: string;
  isPreviousActive: boolean;
  isCurrentActive: boolean;
  isNextActive: boolean;
  onPrevious: () => void;
  onCurrent: () => void;
  onNext: () => void;
  onStepPrevious: () => void;
  onStepNext: () => void;
};

export function MonthSelector({
  monthLabel,
  isPreviousActive,
  isCurrentActive,
  isNextActive,
  onPrevious,
  onCurrent,
  onNext,
  onStepPrevious,
  onStepNext,
}: MonthSelectorProps) {
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.arrow} onClick={onStepPrevious} aria-label="Mês anterior">
        <ChevronLeft size={19} />
      </button>

      <div className={styles.current}>
        <span>Visualizando</span>
        <strong>{monthLabel}</strong>
      </div>

      <div className={styles.presets}>
        <button type="button" className={isPreviousActive ? styles.active : ""} onClick={onPrevious}>
          Anterior
        </button>
        <button type="button" className={isCurrentActive ? styles.active : ""} onClick={onCurrent}>
          Atual
        </button>
        <button type="button" className={isNextActive ? styles.active : ""} onClick={onNext}>
          Próximo
        </button>
      </div>

      <button type="button" className={styles.arrow} onClick={onStepNext} aria-label="Próximo mês">
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
