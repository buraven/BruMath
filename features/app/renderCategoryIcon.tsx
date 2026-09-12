import {
  BriefcaseBusiness,
  Bus,
  Car,
  CreditCard,
  Home,
  PawPrint,
  Tag,
  UserRound,
  Utensils,
} from "lucide-react";

export function renderCategoryIcon(category: string) {
  if (category === "Carro") return <Car size={19} />;
  if (category === "Pets") return <PawPrint size={19} />;
  if (category === "Alimentação") return <Utensils size={19} />;
  if (category === "Trabalho") return <BriefcaseBusiness size={19} />;
  if (category === "Transporte") return <Bus size={19} />;
  if (category === "Casa") return <Home size={19} />;
  if (category === "Assinaturas") return <CreditCard size={19} />;
  if (category === "Pessoal") return <UserRound size={19} />;
  return <Tag size={19} />;
}
