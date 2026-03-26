import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Pizzaria, pizzarias as initialPizzarias } from "@/data/mockData";

interface PizzariasContextValue {
  pizzarias: Pizzaria[];
  addPizzaria: (pizzaria: Omit<Pizzaria, "id">) => void;
  updatePizzaria: (id: string, pizzaria: Omit<Pizzaria, "id">) => void;
  removePizzaria: (id: string) => void;
}

const STORAGE_KEY = "pizza-premiada:pizzarias";

const PizzariasContext = createContext<PizzariasContextValue | undefined>(undefined);

function loadPizzarias(): Pizzaria[] {
  if (typeof window === "undefined") return initialPizzarias;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialPizzarias;

  try {
    const parsed = JSON.parse(saved) as Pizzaria[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialPizzarias;
  } catch {
    return initialPizzarias;
  }
}

export function PizzariasProvider({ children }: { children: ReactNode }) {
  const [pizzarias, setPizzarias] = useState<Pizzaria[]>(loadPizzarias);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pizzarias));
  }, [pizzarias]);

  const value = useMemo<PizzariasContextValue>(() => ({
    pizzarias,
    addPizzaria: (pizzaria) => {
      setPizzarias((current) => [...current, { ...pizzaria, id: crypto.randomUUID() }]);
    },
    updatePizzaria: (id, pizzaria) => {
      setPizzarias((current) => current.map((item) => (item.id === id ? { ...item, ...pizzaria } : item)));
    },
    removePizzaria: (id) => {
      setPizzarias((current) => current.filter((item) => item.id !== id));
    },
  }), [pizzarias]);

  return <PizzariasContext.Provider value={value}>{children}</PizzariasContext.Provider>;
}

export function usePizzarias() {
  const context = useContext(PizzariasContext);

  if (!context) {
    throw new Error("usePizzarias must be used within PizzariasProvider");
  }

  return context;
}
