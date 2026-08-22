export const PERSONAL_LIMITS = [
  "Delivery",
  "Gasolina",
  "Comprinhas",
  "Restaurantes",
  "Gastos Bru",
  "Gastos Mat",
] as const;

export type PersonalLimitName = (typeof PERSONAL_LIMITS)[number];

export type PersonalLimit = {
  name: PersonalLimitName;
  amount: number;
};

export const DEFAULT_PERSONAL_LIMITS: Record<PersonalLimitName, number> = {
  Delivery: 0,
  Gasolina: 0,
  Comprinhas: 0,
  Restaurantes: 0,
  "Gastos Bru": 350,
  "Gastos Mat": 350,
};
