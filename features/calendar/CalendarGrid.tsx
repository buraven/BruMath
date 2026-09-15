"use client";

import type { CalendarItem } from "../../lib/finance/calendar";
import styles from "./CalendarScreen.module.css";

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Props = {
  month: string;
  itemsByDate: ReadonlyMap<string, readonly CalendarItem[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function CalendarGrid({
  month,
  itemsByDate,
  selectedDate,
  onSelectDate,
}: Props) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells = Array.from(
    { length: startOffset + daysInMonth },
    (_, index) => {
      const day = index - startOffset + 1;
      return day > 0 ? `${month}-${pad(day)}` : null;
    },
  );

  return (
    <section className={styles.calendar} aria-label="Calendário mensal">
      <div className={styles.weekdays} aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className={styles.days}>
        {cells.map((date, index) => {
          if (!date)
            return <span className={styles.blankDay} key={`blank-${index}`} />;
          const items = itemsByDate.get(date) ?? [];
          const types = [...new Set(items.map((item) => item.type))].slice(
            0,
            3,
          );
          return (
            <button
              type="button"
              key={date}
              className={`${styles.day} ${date === selectedDate ? styles.selectedDay : ""}`}
              aria-label={`Selecionar ${date}`}
              aria-pressed={date === selectedDate}
              onClick={() => onSelectDate(date)}
            >
              <span>{Number(date.slice(-2))}</span>
              {types.length ? (
                <i
                  className={styles.markers}
                  aria-label={`${items.length} itens`}
                >
                  {types.map((type) => (
                    <b
                      className={`${styles.marker} ${styles[type]}`}
                      key={type}
                    />
                  ))}
                </i>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
