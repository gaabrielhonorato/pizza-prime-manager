import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Login centralizado em /login — todos os perfis usam o mesmo fluxo
export default function EntregadorLogin() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/login", { replace: true }); }, [navigate]);
  return null;
}
