"use client";

import { type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string | number;
  onValueChange: (value: string) => void;
  maximum?: number;
};

export function MoneyInput({ value, onValueChange, maximum, ...props }: Props) {
  const numeric = Number(String(value).replace(",", "."));
  const display =
    value === ""
      ? ""
      : numeric.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const error =
    maximum !== undefined && numeric > Math.round(maximum * 100) / 100;
  return (
    <>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        value={display}
        aria-invalid={error || undefined}
        ref={(element) =>
          element?.setCustomValidity(
            error
              ? `O máximo permitido é ${maximum?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
              : "",
          )
        }
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
          onValueChange(digits ? (Number(digits) / 100).toFixed(2) : "");
        }}
      />
      {error && (
        <small role="alert">
          O máximo permitido é{" "}
          {maximum?.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
          .
        </small>
      )}
    </>
  );
}
