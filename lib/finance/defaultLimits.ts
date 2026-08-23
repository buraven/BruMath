import type { CategoryLimit } from "./limits";

export const DEFAULT_CATEGORY_LIMITS: CategoryLimit[] = [
  { id: "delivery", label: "Delivery", owner: "Casal", amount: 0 },
  { id: "gasolina", label: "Gasolina", owner: "Casal", amount: 0 },
  { id: "comprinhas", label: "Comprinhas", owner: "Casal", amount: 0 },
  { id: "restaurantes", label: "Restaurantes", owner: "Casal", amount: 0 },
  { id: "gastos-bruna", label: "Gastos da Bru", owner: "Bruna", amount: 350 },
  { id: "gastos-matheus", label: "Gastos do Mat", owner: "Matheus", amount: 350 },
];
