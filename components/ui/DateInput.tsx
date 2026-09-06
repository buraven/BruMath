"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function DateInput({ value, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? value.split("-").reverse().join("/");
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={display}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
        const formatted = digits
          .replace(/^(\d{2})(\d)/, "$1/$2")
          .replace(/^(\d{2}\/\d{2})(\d)/, "$1/$2");
        setDraft(formatted);
        const [day, month, year] = formatted.split("/");
        const iso = `${year}-${month}-${day}`;
        const date = new Date(`${iso}T12:00:00`);
        const valid =
          digits.length === 8 &&
          Number(year) >= 1000 &&
          date.getFullYear() === Number(year) &&
          date.getMonth() + 1 === Number(month) &&
          date.getDate() === Number(day);
        event.target.setCustomValidity(
          !digits || valid
            ? ""
            : "Informe uma data válida no formato DD/MM/AAAA.",
        );
        onValueChange(valid ? iso : "");
      }}
    />
  );
}
