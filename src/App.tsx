import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GestorLayout } from "@/components/gestor/GestorLayout";
import { PizzariaLayout } from "@/components/pizzaria/PizzariaLayout";
import { PizzariasProvider } from "@/contexts/PizzariasContext";
import Dashboard from "@/pages/gestor/Dashboard";
import Pizzarias from "@/pages/gestor/Pizzarias";
import Sorteio from "@/pages/gestor/Sorteio";
import Consumidores from "@/pages/gestor/Consumidores";
import Financeiro from "@/pages/gestor/Financeiro";
import Configuracoes from "@/pages/gestor/Configuracoes";
import WhatsAppPage from "@/pages/gestor/WhatsApp";
import ConsumidorDetalhe from "@/pages/gestor/ConsumidorDetalhe";
import PizzariaLogin from "@/pages/pizzaria/PizzariaLogin";
import PizzariaDashboard from "@/pages/pizzaria/PizzariaDashboard";
import PizzariaFinanceiro from "@/pages/pizzaria/PizzariaFinanceiro";
import PizzariaPedidos from "@/pages/pizzaria/PizzariaPedidos";
import MinhaPizzaria from "@/pages/pizzaria/MinhaPizzaria";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import EntregadorLogin from "@/pages/entregador/EntregadorLogin";
import EntregadorInicio from "@/pages/entregador/EntregadorInicio";
import EntregadorPedidos from "@/pages/entregador/EntregadorPedidos";
import EntregadorMapa from "@/pages/entregador/EntregadorMapa";
import EntregadorPerfil from "@/pages/entregador/EntregadorPerfil";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PizzariasProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Navigate to="/gestor" replace />} />
          <Route path="/gestor" element={<GestorLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pizzarias" element={<Pizzarias />} />
            <Route path="sorteio" element={<Sorteio />} />
            <Route path="consumidores" element={<Consumidores />} />
            <Route path="consumidores/:id" element={<ConsumidorDetalhe />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="/pizzaria/login" element={<PizzariaLogin />} />
          <Route path="/pizzaria" element={<PizzariaLayout />}>
            <Route path="dashboard" element={<PizzariaDashboard />} />
            <Route path="financeiro" element={<PizzariaFinanceiro />} />
            <Route path="pedidos" element={<PizzariaPedidos />} />
            <Route path="minha-pizzaria" element={<MinhaPizzaria />} />
          </Route>
          <Route path="/entregador/login" element={<EntregadorLogin />} />
          <Route path="/entregador/app" element={<EntregadorLayout />}>
            <Route index element={<EntregadorInicio />} />
            <Route path="pedidos" element={<EntregadorPedidos />} />
            <Route path="mapa" element={<EntregadorMapa />} />
            <Route path="perfil" element={<EntregadorPerfil />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PizzariasProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
