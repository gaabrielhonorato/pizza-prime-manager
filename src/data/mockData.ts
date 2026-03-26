export interface Pizzaria {
  id: string;
  nome: string;
  responsavel: string;
  telefone: string;
  cidade: string;
  bairro: string;
  status: "Prospectada" | "Ativa" | "Inativa";
  matriculaPaga: boolean;
  dataEntrada: string;
}

export const pizzarias: Pizzaria[] = [
  { id: "1", nome: "Pizza do Zé", responsavel: "José Silva", telefone: "(11) 99999-0001", cidade: "São Paulo", bairro: "Mooca", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-10" },
  { id: "2", nome: "Bella Napoli", responsavel: "Maria Santos", telefone: "(11) 99999-0002", cidade: "São Paulo", bairro: "Vila Mariana", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-12" },
  { id: "3", nome: "Forno & Massa", responsavel: "Carlos Oliveira", telefone: "(21) 99999-0003", cidade: "Rio de Janeiro", bairro: "Copacabana", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-15" },
  { id: "4", nome: "Pizzaria Italia", responsavel: "Ana Costa", telefone: "(31) 99999-0004", cidade: "Belo Horizonte", bairro: "Savassi", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-01" },
  { id: "5", nome: "Dom Pizza", responsavel: "Ricardo Almeida", telefone: "(41) 99999-0005", cidade: "Curitiba", bairro: "Batel", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-20" },
  { id: "6", nome: "Pizza Express", responsavel: "Fernanda Lima", telefone: "(51) 99999-0006", cidade: "Porto Alegre", bairro: "Moinhos de Vento", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-22" },
  { id: "7", nome: "Sabor & Arte", responsavel: "Pedro Machado", telefone: "(61) 99999-0007", cidade: "Brasília", bairro: "Asa Sul", status: "Inativa", matriculaPaga: false, dataEntrada: "2025-01-25" },
  { id: "8", nome: "Pizza Prime", responsavel: "Lucia Ferreira", telefone: "(71) 99999-0008", cidade: "Salvador", bairro: "Barra", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-03" },
  { id: "9", nome: "Massa Fina", responsavel: "Roberto Nunes", telefone: "(81) 99999-0009", cidade: "Recife", bairro: "Boa Viagem", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-10" },
  { id: "10", nome: "Cantina Paulista", responsavel: "Juliana Rocha", telefone: "(11) 99999-0010", cidade: "São Paulo", bairro: "Pinheiros", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-05" },
  { id: "11", nome: "La Famiglia", responsavel: "Marcos Pereira", telefone: "(19) 99999-0011", cidade: "Campinas", bairro: "Cambuí", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-08" },
  { id: "12", nome: "Pizza Nostra", responsavel: "Tatiana Souza", telefone: "(47) 99999-0012", cidade: "Florianópolis", bairro: "Centro", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-15" },
];

export const premios = [
  { posicao: "1º", nome: "iPhone 17 Pro Max", valor: 8000 },
  { posicao: "2º", nome: "Viagem Rio Quente — 7 dias", valor: 5000 },
  { posicao: "3º", nome: "Pix", valor: 2500 },
];

export const VALOR_MATRICULA = 799;
export const META_PIZZARIAS = 40;
export const CICLO_MESES = 4;
export const CUSTO_CARDAPIO_WEB = 160;
export const CUSTO_CAPTACAO = 16800;
export const CUSTO_EMBALAGEM_UNIDADE = 2.10;
export const PERCENTUAL_ANUNCIOS = 0.30;
export const PERCENTUAL_VENDAS = 0.15;
export const TOTAL_EMBALAGENS_ESTIMADO = 4000;
export const VENDAS_ESTIMADAS_CICLO = 120000;
