"use client";

import { useEffect, useRef, useState } from "react";
import { BruMathDataRepository } from "../../lib/persistence/BruMathDataRepository";
import type { AppFinancialData } from "../../lib/app/AppTypes";

export function usePersistedFinancialState(defaults: AppFinancialData) {
  const defaultsRef = useRef(defaults);
  const initial = defaultsRef.current;
  const [expenses, setExpenses] = useState(initial.expenses);
  const [installments, setInstallments] = useState(initial.installments);
  const [debts, setDebts] = useState(initial.debts);
  const [incomeEntries, setIncomeEntries] = useState(initial.incomeEntries);
  const [income, setIncome] = useState(initial.income);
  const [budgets, setBudgets] = useState(initial.budgets);
  const [limits, setLimits] = useState(initial.limits);
  const [activeProfile, setActiveProfile] = useState(initial.activeProfile);
  const [viewMonth, setViewMonth] = useState(initial.viewMonth);

  useEffect(() => {
    try {
      const data = new BruMathDataRepository().load(initial);
      setExpenses(data.expenses);
      setInstallments(data.installments);
      setDebts(data.debts);
      setIncomeEntries(data.incomeEntries);
      setIncome(data.income);
      setBudgets(data.budgets);
      setLimits(data.limits);
      setActiveProfile(data.activeProfile);
      setViewMonth(data.viewMonth);
    } catch {
      // Existing behavior keeps in-memory defaults if stored data is unreadable.
    }
  }, [initial]);

  useEffect(() => {
    new BruMathDataRepository().save({
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      limits,
      activeProfile,
      viewMonth,
    });
  }, [
    expenses,
    installments,
    debts,
    incomeEntries,
    income,
    budgets,
    limits,
    activeProfile,
    viewMonth,
  ]);

  return {
    expenses,
    setExpenses,
    installments,
    setInstallments,
    debts,
    setDebts,
    incomeEntries,
    setIncomeEntries,
    income,
    setIncome,
    budgets,
    setBudgets,
    limits,
    setLimits,
    activeProfile,
    setActiveProfile,
    viewMonth,
    setViewMonth,
  };
}
