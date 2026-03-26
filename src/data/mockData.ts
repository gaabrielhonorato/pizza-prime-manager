export interface Pizzaria {
  id: string;
  nome: string;
  responsavel: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  bairro: string;
  cep: string;
  status: "Prospectada" | "Ativa" | "Inativa";
  matriculaPaga: boolean;
  dataEntrada: string;
  vendas: number;
}

export const pizzarias: Pizzaria[] = [
  { id: "1", nome: "Pizza do Zé", responsavel: "José Silva", cnpj: "12.345.678/0001-01", telefone: "(11) 99999-0001", endereco: "Rua das Flores, 100", cidade: "São Paulo", bairro: "Mooca", cep: "03101-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-10", vendas: 342 },
  { id: "2", nome: "Bella Napoli", responsavel: "Maria Santos", cnpj: "23.456.789/0001-02", telefone: "(11) 99999-0002", endereco: "Av. Paulista, 500", cidade: "São Paulo", bairro: "Vila Mariana", cep: "04101-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-12", vendas: 518 },
  { id: "3", nome: "Forno & Massa", responsavel: "Carlos Oliveira", cnpj: "34.567.890/0001-03", telefone: "(21) 99999-0003", endereco: "Rua Barata Ribeiro, 200", cidade: "Rio de Janeiro", bairro: "Copacabana", cep: "22040-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-15", vendas: 275 },
  { id: "4", nome: "Pizzaria Italia", responsavel: "Ana Costa", cnpj: "45.678.901/0001-04", telefone: "(31) 99999-0004", endereco: "Rua Pernambuco, 80", cidade: "Belo Horizonte", bairro: "Savassi", cep: "30130-000", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-01", vendas: 0 },
  { id: "5", nome: "Dom Pizza", responsavel: "Ricardo Almeida", cnpj: "56.789.012/0001-05", telefone: "(41) 99999-0005", endereco: "Rua XV de Novembro, 300", cidade: "Curitiba", bairro: "Batel", cep: "80020-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-20", vendas: 189 },
  { id: "6", nome: "Pizza Express", responsavel: "Fernanda Lima", cnpj: "67.890.123/0001-06", telefone: "(51) 99999-0006", endereco: "Rua Padre Chagas, 50", cidade: "Porto Alegre", bairro: "Moinhos de Vento", cep: "90570-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-01-22", vendas: 410 },
  { id: "7", nome: "Sabor & Arte", responsavel: "Pedro Machado", cnpj: "78.901.234/0001-07", telefone: "(61) 99999-0007", endereco: "SQS 308 Bloco A", cidade: "Brasília", bairro: "Asa Sul", cep: "70356-000", status: "Inativa", matriculaPaga: false, dataEntrada: "2025-01-25", vendas: 45 },
  { id: "8", nome: "Pizza Prime", responsavel: "Lucia Ferreira", cnpj: "89.012.345/0001-08", telefone: "(71) 99999-0008", endereco: "Av. Oceânica, 1200", cidade: "Salvador", bairro: "Barra", cep: "40140-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-03", vendas: 156 },
  { id: "9", nome: "Massa Fina", responsavel: "Roberto Nunes", cnpj: "90.123.456/0001-09", telefone: "(81) 99999-0009", endereco: "Rua do Brum, 75", cidade: "Recife", bairro: "Boa Viagem", cep: "51020-000", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-10", vendas: 0 },
  { id: "10", nome: "Cantina Paulista", responsavel: "Juliana Rocha", cnpj: "01.234.567/0001-10", telefone: "(11) 99999-0010", endereco: "Rua dos Pinheiros, 900", cidade: "São Paulo", bairro: "Pinheiros", cep: "05422-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-05", vendas: 287 },
  { id: "11", nome: "La Famiglia", responsavel: "Marcos Pereira", cnpj: "11.222.333/0001-11", telefone: "(19) 99999-0011", endereco: "Av. Norte-Sul, 450", cidade: "Campinas", bairro: "Cambuí", cep: "13024-000", status: "Ativa", matriculaPaga: true, dataEntrada: "2025-02-08", vendas: 203 },
  { id: "12", nome: "Pizza Nostra", responsavel: "Tatiana Souza", cnpj: "22.333.444/0001-12", telefone: "(47) 99999-0012", endereco: "Rua Felipe Schmidt, 100", cidade: "Florianópolis", bairro: "Centro", cep: "88010-000", status: "Prospectada", matriculaPaga: false, dataEntrada: "2025-02-15", vendas: 0 },
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
