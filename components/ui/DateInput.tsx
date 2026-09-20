"use client";

import { CalendarDays } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import {
  formatBrazilianDateDraft,
  formatLocalDate,
  parseBrazilianDate,
} from "../../lib/finance/localDate";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function DateInput({ value, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatLocalDate(value);
  return (
    <span className="date-input">
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={display}
        onChange={(event) => {
          const formatted = formatBrazilianDateDraft(event.target.value);
          const canonical = parseBrazilianDate(formatted);
          setDraft(formatted);
          event.target.setCustomValidity(
            !formatted || canonical
              ? ""
              : "Informe uma data válida no formato DD/MM/AAAA.",
          );
          onValueChange(canonical);
        }}
      />
      <CalendarDays className="date-input-icon" size={18} aria-hidden="true" />
      <input
        className="date-input-picker"
        type="date"
        lang="pt-BR"
        aria-label="Selecionar data pelo calendário"
        value={value}
        onChange={(event) => {
          setDraft(null);
          onValueChange(event.target.value);
        }}
      />
    </span>
  );
}
