import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GestorLayout } from "@/components/gestor/GestorLayout";
import { PizzariasProvider } from "@/contexts/PizzariasContext";
import Dashboard from "@/pages/gestor/Dashboard";
import Pizzarias from "@/pages/gestor/Pizzarias";
import Sorteio from "@/pages/gestor/Sorteio";
import Consumidores from "@/pages/gestor/Consumidores";
import Financeiro from "@/pages/gestor/Financeiro";
import Configuracoes from "@/pages/gestor/Configuracoes";
import WhatsAppPage from "@/pages/gestor/WhatsApp";
import ConsumidorDetalhe from "@/pages/gestor/ConsumidorDetalhe";
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
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PizzariasProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
