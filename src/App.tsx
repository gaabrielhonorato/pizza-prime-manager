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
import PizzariaDetalhe from "@/pages/gestor/PizzariaDetalhe";
import Sorteio from "@/pages/gestor/Sorteio";
import Consumidores from "@/pages/gestor/Consumidores";
import FinanceiroLayout from "@/components/gestor/FinanceiroLayout";
import FinanceiroVisaoGeral from "@/pages/gestor/FinanceiroVisaoGeral";
import FinanceiroReceitas from "@/pages/gestor/FinanceiroReceitas";
import FinanceiroCustos from "@/pages/gestor/FinanceiroCustos";
import FinanceiroProjecoes from "@/pages/gestor/FinanceiroProjecoes";
import FinanceiroDiario from "@/pages/gestor/FinanceiroDiario";
import FinanceiroCobrancas from "@/pages/gestor/FinanceiroCobrancas";
import Configuracoes from "@/pages/gestor/Configuracoes";
import MinhaConta from "@/pages/gestor/MinhaConta";
import Campanhas from "@/pages/gestor/Campanhas";
import WhatsAppPage from "@/pages/gestor/WhatsApp";
import ConsumidorDetalhe from "@/pages/gestor/ConsumidorDetalhe";
import Entregadores from "@/pages/gestor/Entregadores";
import DesempenhoLayout from "@/components/gestor/DesempenhoLayout";
import DesempenhoVendas from "@/pages/gestor/DesempenhoVendas";
import DesempenhoClientes from "@/pages/gestor/DesempenhoClientes";
import PizzariaDashboard from "@/pages/pizzaria/PizzariaDashboard";
import PizzariaFinanceiro from "@/pages/pizzaria/PizzariaFinanceiro";
import PizzariaPedidos from "@/pages/pizzaria/PizzariaPedidos";
import MinhaPizzaria from "@/pages/pizzaria/MinhaPizzaria";
import PizzariaClientes from "@/pages/pizzaria/PizzariaClientes";
import PizzariaDesempenhoVendas from "@/pages/pizzaria/PizzariaDesempenhoVendas";
import PizzariaDesempenhoClientes from "@/pages/pizzaria/PizzariaDesempenhoClientes";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import EntregadorInicio from "@/pages/entregador/EntregadorInicio";
import EntregadorPedidos from "@/pages/entregador/EntregadorPedidos";
import EntregadorMapa from "@/pages/entregador/EntregadorMapa";
import EntregadorPerfil from "@/pages/entregador/EntregadorPerfil";
import { ConsumidorLayout } from "@/components/consumidor/ConsumidorLayout";
import ConsumidorCadastro from "@/pages/consumidor/ConsumidorCadastro";
import ConsumidorInicio from "@/pages/consumidor/ConsumidorInicio";
import ConsumidorCupons from "@/pages/consumidor/ConsumidorCupons";
import ConsumidorRanking from "@/pages/consumidor/ConsumidorRanking";
import ConsumidorPedidos from "@/pages/consumidor/ConsumidorPedidos";
import ConsumidorPremios from "@/pages/consumidor/ConsumidorPremios";
import ConsumidorPerfil from "@/pages/consumidor/ConsumidorPerfil";
import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
import EsqueciSenha from "@/pages/EsqueciSenha";
import RedefinirSenha from "@/pages/RedefinirSenha";
import LegalDocument from "@/pages/LegalDocument";
import NotFound from "./pages/NotFound.tsx";
import { EmpresaBrandingProvider } from "@/contexts/EmpresaBrandingContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EmpresaBrandingProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/politica-de-privacidade" element={<LegalDocument type="privacy" />} />
          <Route path="/termos-de-participacao" element={<LegalDocument type="terms" />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/gestor" element={<PizzariasProvider><GestorLayout /></PizzariasProvider>}>
              <Route index element={<Dashboard />} />
              <Route path="pizzarias" element={<Pizzarias />} />
              <Route path="pizzarias/:id" element={<PizzariaDetalhe />} />
              <Route path="sorteio" element={<Sorteio />} />
              <Route path="consumidores" element={<Consumidores />} />
              <Route path="consumidores/:id" element={<ConsumidorDetalhe />} />
              <Route path="entregadores" element={<Entregadores />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="financeiro" element={<FinanceiroLayout />}>
                <Route index element={<FinanceiroVisaoGeral />} />
                <Route path="visao-geral" element={<FinanceiroVisaoGeral />} />
                <Route path="receitas" element={<FinanceiroReceitas />} />
                <Route path="custos" element={<FinanceiroCustos />} />
                <Route path="cobrancas" element={<FinanceiroCobrancas />} />
                <Route path="diario" element={<FinanceiroDiario />} />
                <Route path="projecoes" element={<FinanceiroProjecoes />} />
              </Route>
              <Route path="campanhas" element={<Campanhas />} />
              <Route path="desempenho" element={<DesempenhoLayout />}>
                <Route index element={<DesempenhoVendas />} />
                <Route path="vendas" element={<DesempenhoVendas />} />
                <Route path="clientes" element={<DesempenhoClientes />} />
              </Route>
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="minha-conta" element={<MinhaConta />} />
            </Route>
            <Route path="/pizzaria/login" element={<Navigate to="/" replace />} />
            <Route path="/pizzaria" element={<PizzariaLayout />}>
              <Route path="dashboard" element={<PizzariaDashboard />} />
              <Route path="financeiro" element={<PizzariaFinanceiro />} />
              <Route path="pedidos" element={<PizzariaPedidos />} />
              <Route path="clientes" element={<PizzariaClientes />} />
              <Route path="minha-pizzaria" element={<MinhaPizzaria />} />
              <Route path="desempenho/vendas" element={<PizzariaDesempenhoVendas />} />
              <Route path="desempenho/clientes" element={<PizzariaDesempenhoClientes />} />
            </Route>
            <Route path="/entregador/login" element={<Navigate to="/" replace />} />
            <Route path="/entregador/app" element={<EntregadorLayout />}>
              <Route index element={<EntregadorInicio />} />
              <Route path="pedidos" element={<EntregadorPedidos />} />
              <Route path="mapa" element={<EntregadorMapa />} />
              <Route path="perfil" element={<EntregadorPerfil />} />
            </Route>
            <Route path="/consumidor/login" element={<Navigate to="/" replace />} />
            <Route path="/consumidor/cadastro" element={<ConsumidorCadastro />} />
            <Route path="/consumidor" element={<ConsumidorLayout />}>
              <Route path="dashboard" element={<ConsumidorInicio />} />
              <Route path="cupons" element={<ConsumidorCupons />} />
              <Route path="ranking" element={<ConsumidorRanking />} />
              <Route path="pedidos" element={<ConsumidorPedidos />} />
              <Route path="premios" element={<ConsumidorPremios />} />
              <Route path="perfil" element={<ConsumidorPerfil />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </EmpresaBrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
