import { addDays, subDays, startOfDay, format } from "date-fns";
import { pizzarias as defaultPizzarias, type Pizzaria } from "./mockData";
import { CANAIS_VENDA, type CanalVenda } from "./dashboardMockData";

export interface Pedido {
  id: string;
  data: Date;
  pizzariaId: string;
  pizzariaNome: string;
  valor: number;
  canalVenda: CanalVenda;
  cuponsGerados: number;
}

export interface Consumidor {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cidade: string;
  bairro: string;
  pizzariaVinculadaId: string;
  pizzariaVinculadaNome: string;
  status: "Ativo" | "Inativo";
  dataCadastro: Date;
  pedidos: Pedido[];
  // computed
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  cuponsAcumulados: number;
  primeiroPedido: Date | null;
  ultimoPedido: Date | null;
}

const NOMES = [
  "Lucas Mendes", "Camila Ribeiro", "Rafael Torres", "Juliana Martins",
  "Thiago Barbosa", "Amanda Lopes", "Bruno Cardoso", "Patricia Neves",
  "Diego Fernandes", "Larissa Pinto", "Gustavo Moreira", "Natália Duarte",
  "Felipe Ramos", "Isabela Correia", "Leandro Vieira", "Gabriela Azevedo",
  "Rodrigo Carvalho", "Daniela Freitas", "Matheus Gonçalves", "Vanessa Rocha",
  "André Teixeira", "Cristina Barros", "Eduardo Souza", "Mariana Alves",
  "Henrique Santos", "Aline Castro", "Fábio Melo", "Priscila Ferreira",
  "Renato Dias", "Carolina Lima", "Marcelo Araújo", "Fernanda Gomes",
  "Alexandre Monteiro", "Tatiane Pereira", "Vinícius Cunha", "Raquel Oliveira",
  "Sérgio Nascimento", "Beatriz Coelho", "Caio Machado", "Letícia Campos",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCPF() {
  const n = () => randInt(0, 9);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function randomPhone(ddd: string) {
  return `(${ddd}) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`;
}

function generateConsumidores(pizzariasList: Pizzaria[]): Consumidor[] {
  const ativas = pizzariasList.filter((p) => p.status === "Ativa");
  if (ativas.length === 0) return [];
  const today = startOfDay(new Date());
  const consumers: Consumidor[] = [];

  for (let i = 0; i < NOMES.length; i++) {
    const piz = ativas[i % ativas.length];
    const cadastro = subDays(today, randInt(10, 150));
    const isActive = Math.random() > 0.15;
    const numPedidos = isActive ? randInt(1, 25) : 0;

    const pedidos: Pedido[] = [];
    let totalGasto = 0;
    let totalCupons = 0;

    for (let j = 0; j < numPedidos; j++) {
      const dataPedido = addDays(cadastro, randInt(1, Math.max(1, Math.round((today.getTime() - cadastro.getTime()) / 86400000))));
      if (dataPedido > today) continue;
      const valor = randInt(25, 120);
      const cupons = Math.floor(valor / 30);
      totalGasto += valor;
      totalCupons += cupons;
      pedidos.push({
        id: crypto.randomUUID(),
        data: dataPedido,
        pizzariaId: piz.id,
        pizzariaNome: piz.nome,
        valor,
        canalVenda: CANAIS_VENDA[randInt(0, CANAIS_VENDA.length - 1)],
        cuponsGerados: cupons,
      });
    }

    pedidos.sort((a, b) => a.data.getTime() - b.data.getTime());

    consumers.push({
      id: crypto.randomUUID(),
      nome: NOMES[i],
      cpf: randomCPF(),
      email: `${NOMES[i].toLowerCase().replace(/ /g, ".").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@email.com`,
      telefone: randomPhone(piz.telefone.slice(1, 3)),
      cidade: piz.cidade,
      bairro: piz.bairro,
      pizzariaVinculadaId: piz.id,
      pizzariaVinculadaNome: piz.nome,
      status: isActive ? "Ativo" : "Inativo",
      dataCadastro: cadastro,
      pedidos,
      totalPedidos: pedidos.length,
      totalGasto,
      ticketMedio: pedidos.length > 0 ? Math.round(totalGasto / pedidos.length) : 0,
      cuponsAcumulados: totalCupons,
      primeiroPedido: pedidos.length > 0 ? pedidos[0].data : null,
      ultimoPedido: pedidos.length > 0 ? pedidos[pedidos.length - 1].data : null,
    });
  }

  return consumers;
}

export const consumidoresMock = generateConsumidores(defaultPizzarias);
