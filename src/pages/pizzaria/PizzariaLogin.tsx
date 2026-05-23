import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Login centralizado em /login — todos os perfis (pizzaria, gestor, consumidor, entregador) usam o mesmo fluxo
export default function PizzariaLogin() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/login", { replace: true }); }, [navigate]);
  return null;
}
