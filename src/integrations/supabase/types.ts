export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campanhas: {
        Row: {
          adesao_paga: boolean
          arredondamento: string
          bonus_aniversario_ativo: boolean
          bonus_aniversario_multiplicador: number
          bonus_aniversario_tipo_pedido: string | null
          bonus_cadastro_ativo: boolean
          bonus_cadastro_cupons: number
          bonus_indicacao: number
          campanha_pai_id: string | null
          criado_em: string
          cupons_fixos_extras: number
          cupons_por_valor: number
          data_encerramento: string
          data_inicio: string
          data_sorteio: string
          desconto_valor_minimo: number
          descricao: string | null
          id: string
          is_principal: boolean
          limite_cupons_ciclo: number | null
          limite_cupons_consumidor: number | null
          multiplicador_cupons: number
          nome: string
          percentual_comissao: number
          periodo_fim: string | null
          periodo_inicio: string | null
          pizzarias_permitidas: string[] | null
          sequencia_cupons: Json | null
          status: string
          tipo: string
          tipo_precificacao: string
          valor_adesao: number
          valor_minimo_pedido: number
          valor_por_cupom: number
        }
        Insert: {
          adesao_paga?: boolean
          arredondamento?: string
          bonus_aniversario_ativo?: boolean
          bonus_aniversario_multiplicador?: number
          bonus_aniversario_tipo_pedido?: string | null
          bonus_cadastro_ativo?: boolean
          bonus_cadastro_cupons?: number
          bonus_indicacao?: number
          campanha_pai_id?: string | null
          criado_em?: string
          cupons_fixos_extras?: number
          cupons_por_valor?: number
          data_encerramento: string
          data_inicio: string
          data_sorteio: string
          desconto_valor_minimo?: number
          descricao?: string | null
          id?: string
          is_principal?: boolean
          limite_cupons_ciclo?: number | null
          limite_cupons_consumidor?: number | null
          multiplicador_cupons?: number
          nome: string
          percentual_comissao?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          pizzarias_permitidas?: string[] | null
          sequencia_cupons?: Json | null
          status?: string
          tipo?: string
          tipo_precificacao?: string
          valor_adesao?: number
          valor_minimo_pedido?: number
          valor_por_cupom?: number
        }
        Update: {
          adesao_paga?: boolean
          arredondamento?: string
          bonus_aniversario_ativo?: boolean
          bonus_aniversario_multiplicador?: number
          bonus_aniversario_tipo_pedido?: string | null
          bonus_cadastro_ativo?: boolean
          bonus_cadastro_cupons?: number
          bonus_indicacao?: number
          campanha_pai_id?: string | null
          criado_em?: string
          cupons_fixos_extras?: number
          cupons_por_valor?: number
          data_encerramento?: string
          data_inicio?: string
          data_sorteio?: string
          desconto_valor_minimo?: number
          descricao?: string | null
          id?: string
          is_principal?: boolean
          limite_cupons_ciclo?: number | null
          limite_cupons_consumidor?: number | null
          multiplicador_cupons?: number
          nome?: string
          percentual_comissao?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          pizzarias_permitidas?: string[] | null
          sequencia_cupons?: Json | null
          status?: string
          tipo?: string
          tipo_precificacao?: string
          valor_adesao?: number
          valor_minimo_pedido?: number
          valor_por_cupom?: number
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_campanha_pai_id_fkey"
            columns: ["campanha_pai_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      consumidores: {
        Row: {
          aceita_whatsapp: boolean
          bairro: string | null
          cadastro_bonus_concedido: boolean
          cadastro_completo: boolean
          campanha_id: string | null
          cidade: string | null
          criado_em: string
          data_nascimento: string | null
          genero: string | null
          id: string
          pizzaria_id: string | null
          termos_aceitos: boolean
          usuario_id: string
        }
        Insert: {
          aceita_whatsapp?: boolean
          bairro?: string | null
          cadastro_bonus_concedido?: boolean
          cadastro_completo?: boolean
          campanha_id?: string | null
          cidade?: string | null
          criado_em?: string
          data_nascimento?: string | null
          genero?: string | null
          id?: string
          pizzaria_id?: string | null
          termos_aceitos?: boolean
          usuario_id: string
        }
        Update: {
          aceita_whatsapp?: boolean
          bairro?: string | null
          cadastro_bonus_concedido?: boolean
          cadastro_completo?: boolean
          campanha_id?: string | null
          cidade?: string | null
          criado_em?: string
          data_nascimento?: string | null
          genero?: string | null
          id?: string
          pizzaria_id?: string | null
          termos_aceitos?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumidores_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumidores_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumidores_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumidores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          campanha_id: string
          consumidor_id: string
          criado_em: string
          id: string
          pedido_id: string
          quantidade: number
          status: string
        }
        Insert: {
          campanha_id: string
          consumidor_id: string
          criado_em?: string
          id?: string
          pedido_id: string
          quantidade?: number
          status?: string
        }
        Update: {
          campanha_id?: string
          consumidor_id?: string
          criado_em?: string
          id?: string
          pedido_id?: string
          quantidade?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cupons_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_consumidor_id_fkey"
            columns: ["consumidor_id"]
            isOneToOne: false
            referencedRelation: "consumidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons_bonus: {
        Row: {
          campanha_id: string
          consumidor_id: string
          criado_em: string
          id: string
          motivo: string | null
          quantidade: number
          status: string
          tipo: string
        }
        Insert: {
          campanha_id: string
          consumidor_id: string
          criado_em?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          status?: string
          tipo: string
        }
        Update: {
          campanha_id?: string
          consumidor_id?: string
          criado_em?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cupons_bonus_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_bonus_consumidor_id_fkey"
            columns: ["consumidor_id"]
            isOneToOne: false
            referencedRelation: "consumidores"
            referencedColumns: ["id"]
          },
        ]
      }
      custos: {
        Row: {
          campanha_id: string
          categoria: string
          criado_em: string
          data_lancamento: string
          descricao: string
          id: string
          valor: number
        }
        Insert: {
          campanha_id: string
          categoria: string
          criado_em?: string
          data_lancamento: string
          descricao: string
          id?: string
          valor: number
        }
        Update: {
          campanha_id?: string
          categoria?: string
          criado_em?: string
          data_lancamento?: string
          descricao?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_operacionais: {
        Row: {
          campanha_id: string
          categoria: string
          criado_em: string
          descricao: string
          id: string
          meses_aplicados: number | null
          observacao: string | null
          valor: number
          valor_total_calculado: number
        }
        Insert: {
          campanha_id: string
          categoria?: string
          criado_em?: string
          descricao: string
          id?: string
          meses_aplicados?: number | null
          observacao?: string | null
          valor?: number
          valor_total_calculado?: number
        }
        Update: {
          campanha_id?: string
          categoria?: string
          criado_em?: string
          descricao?: string
          id?: string
          meses_aplicados?: number | null
          observacao?: string | null
          valor?: number
          valor_total_calculado?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_operacionais_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      disparos_whatsapp: {
        Row: {
          consumidor_id: string
          criado_em: string
          evento: string
          id: string
          mensagem: string
          status: string
          tipo: string
        }
        Insert: {
          consumidor_id: string
          criado_em?: string
          evento: string
          id?: string
          mensagem: string
          status?: string
          tipo: string
        }
        Update: {
          consumidor_id?: string
          criado_em?: string
          evento?: string
          id?: string
          mensagem?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "disparos_whatsapp_consumidor_id_fkey"
            columns: ["consumidor_id"]
            isOneToOne: false
            referencedRelation: "consumidores"
            referencedColumns: ["id"]
          },
        ]
      }
      entregadores: {
        Row: {
          criado_em: string
          disponivel: boolean
          id: string
          pizzaria_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          disponivel?: boolean
          id?: string
          pizzaria_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          disponivel?: boolean
          id?: string
          pizzaria_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          atualizado_em: string | null
          config: Json
          criado_em: string
          id: string
          nome: string
          provedor: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          config?: Json
          criado_em?: string
          id?: string
          nome: string
          provedor?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string | null
          config?: Json
          criado_em?: string
          id?: string
          nome?: string
          provedor?: string | null
          status?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          bairro_entrega: string | null
          campanha_id: string
          canal: string
          cardapioweb_order_id: string | null
          consumidor_id: string | null
          cupons_gerados: number
          data_entrega: string | null
          data_pedido: string
          desconto: number
          entregador_id: string | null
          forma_pagamento: string | null
          horario_pedido: string | null
          id: string
          pizzaria_id: string
          status: string
          taxa_entrega: number
          tipo_pedido: string | null
          valor_total: number
        }
        Insert: {
          bairro_entrega?: string | null
          campanha_id: string
          canal: string
          cardapioweb_order_id?: string | null
          consumidor_id?: string | null
          cupons_gerados?: number
          data_entrega?: string | null
          data_pedido?: string
          desconto?: number
          entregador_id?: string | null
          forma_pagamento?: string | null
          horario_pedido?: string | null
          id?: string
          pizzaria_id: string
          status?: string
          taxa_entrega?: number
          tipo_pedido?: string | null
          valor_total: number
        }
        Update: {
          bairro_entrega?: string | null
          campanha_id?: string
          canal?: string
          cardapioweb_order_id?: string | null
          consumidor_id?: string | null
          cupons_gerados?: number
          data_entrega?: string | null
          data_pedido?: string
          desconto?: number
          entregador_id?: string | null
          forma_pagamento?: string | null
          horario_pedido?: string | null
          id?: string
          pizzaria_id?: string
          status?: string
          taxa_entrega?: number
          tipo_pedido?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_consumidor_id_fkey"
            columns: ["consumidor_id"]
            isOneToOne: false
            referencedRelation: "consumidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzarias: {
        Row: {
          bairro: string
          cardapioweb_api_key: string | null
          cardapioweb_merchant_id: string | null
          cep: string | null
          cidade: string
          cnpj: string | null
          criado_em: string
          data_entrada: string
          endereco: string | null
          id: string
          matricula_paga: boolean
          meta_mensal: number
          nome: string
          observacoes: string | null
          status: string
          telefone: string
          usuario_id: string
        }
        Insert: {
          bairro: string
          cardapioweb_api_key?: string | null
          cardapioweb_merchant_id?: string | null
          cep?: string | null
          cidade: string
          cnpj?: string | null
          criado_em?: string
          data_entrada?: string
          endereco?: string | null
          id?: string
          matricula_paga?: boolean
          meta_mensal?: number
          nome: string
          observacoes?: string | null
          status?: string
          telefone: string
          usuario_id: string
        }
        Update: {
          bairro?: string
          cardapioweb_api_key?: string | null
          cardapioweb_merchant_id?: string | null
          cep?: string | null
          cidade?: string
          cnpj?: string | null
          criado_em?: string
          data_entrada?: string
          endereco?: string | null
          id?: string
          matricula_paga?: boolean
          meta_mensal?: number
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizzarias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      premios: {
        Row: {
          campanha_id: string
          confirmado_em: string | null
          criado_em: string
          descricao: string | null
          ganhador_consumidor_id: string | null
          id: string
          nome: string
          numero_cupom_contemplado: number | null
          numero_sorteado_loteria: number | null
          posicao: number
          quantidade_ganhadores: number
          valor: number
        }
        Insert: {
          campanha_id: string
          confirmado_em?: string | null
          criado_em?: string
          descricao?: string | null
          ganhador_consumidor_id?: string | null
          id?: string
          nome: string
          numero_cupom_contemplado?: number | null
          numero_sorteado_loteria?: number | null
          posicao: number
          quantidade_ganhadores?: number
          valor: number
        }
        Update: {
          campanha_id?: string
          confirmado_em?: string | null
          criado_em?: string
          descricao?: string | null
          ganhador_consumidor_id?: string | null
          id?: string
          nome?: string
          numero_cupom_contemplado?: number | null
          numero_sorteado_loteria?: number | null
          posicao?: number
          quantidade_ganhadores?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "premios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      projecoes_vendas: {
        Row: {
          atualizado_em: string | null
          campanha_id: string
          cor_cenario: string
          criado_em: string
          id: string
          nome_cenario: string
          percentual_pp: number
          pizzarias_mes1: number
          pizzarias_mes2: number
          pizzarias_mes3: number
          pizzarias_mes4: number
          ticket_medio: number
          valor_matricula: number
          vendas_por_pizzaria_mes: number
        }
        Insert: {
          atualizado_em?: string | null
          campanha_id: string
          cor_cenario?: string
          criado_em?: string
          id?: string
          nome_cenario: string
          percentual_pp?: number
          pizzarias_mes1?: number
          pizzarias_mes2?: number
          pizzarias_mes3?: number
          pizzarias_mes4?: number
          ticket_medio?: number
          valor_matricula?: number
          vendas_por_pizzaria_mes?: number
        }
        Update: {
          atualizado_em?: string | null
          campanha_id?: string
          cor_cenario?: string
          criado_em?: string
          id?: string
          nome_cenario?: string
          percentual_pp?: number
          pizzarias_mes1?: number
          pizzarias_mes2?: number
          pizzarias_mes3?: number
          pizzarias_mes4?: number
          ticket_medio?: number
          valor_matricula?: number
          vendas_por_pizzaria_mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "projecoes_vendas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      repasses: {
        Row: {
          campanha_id: string
          criado_em: string
          data_pagamento: string | null
          id: string
          percentual_pizza_premiada: number
          periodo_fim: string
          periodo_inicio: string
          pizzaria_id: string
          status: string
          valor_bruto: number
          valor_pizza_premiada: number
          valor_repasse: number
        }
        Insert: {
          campanha_id: string
          criado_em?: string
          data_pagamento?: string | null
          id?: string
          percentual_pizza_premiada?: number
          periodo_fim: string
          periodo_inicio: string
          pizzaria_id: string
          status?: string
          valor_bruto: number
          valor_pizza_premiada: number
          valor_repasse: number
        }
        Update: {
          campanha_id?: string
          criado_em?: string
          data_pagamento?: string | null
          id?: string
          percentual_pizza_premiada?: number
          periodo_fim?: string
          periodo_inicio?: string
          pizzaria_id?: string
          status?: string
          valor_bruto?: number
          valor_pizza_premiada?: number
          valor_repasse?: number
        }
        Relationships: [
          {
            foreignKeyName: "repasses_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_pizzaria_id_fkey"
            columns: ["pizzaria_id"]
            isOneToOne: false
            referencedRelation: "pizzarias_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          campanha_id: string | null
          cpf: string | null
          criado_em: string
          email: string
          id: string
          nome: string
          perfil: string
          telefone: string | null
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          campanha_id?: string | null
          cpf?: string | null
          criado_em?: string
          email: string
          id: string
          nome: string
          perfil: string
          telefone?: string | null
          ultimo_acesso?: string | null
        }
        Update: {
          ativo?: boolean
          campanha_id?: string | null
          cpf?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          perfil?: string
          telefone?: string | null
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pizzarias_publicas: {
        Row: {
          bairro: string | null
          cidade: string | null
          endereco: string | null
          id: string | null
          nome: string | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          bairro?: string | null
          cidade?: string | null
          endereco?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          bairro?: string | null
          cidade?: string | null
          endereco?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_cupons: {
        Args: { _pizzaria_id: string; _valor_pedido: number }
        Returns: number
      }
      get_campanha_principal: {
        Args: never
        Returns: {
          adesao_paga: boolean
          arredondamento: string
          bonus_aniversario_ativo: boolean
          bonus_aniversario_multiplicador: number
          bonus_aniversario_tipo_pedido: string | null
          bonus_cadastro_ativo: boolean
          bonus_cadastro_cupons: number
          bonus_indicacao: number
          campanha_pai_id: string | null
          criado_em: string
          cupons_fixos_extras: number
          cupons_por_valor: number
          data_encerramento: string
          data_inicio: string
          data_sorteio: string
          desconto_valor_minimo: number
          descricao: string | null
          id: string
          is_principal: boolean
          limite_cupons_ciclo: number | null
          limite_cupons_consumidor: number | null
          multiplicador_cupons: number
          nome: string
          percentual_comissao: number
          periodo_fim: string | null
          periodo_inicio: string | null
          pizzarias_permitidas: string[] | null
          sequencia_cupons: Json | null
          status: string
          tipo: string
          tipo_precificacao: string
          valor_adesao: number
          valor_minimo_pedido: number
          valor_por_cupom: number
        }[]
        SetofOptions: {
          from: "*"
          to: "campanhas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_minha_pizzaria_publica: {
        Args: never
        Returns: {
          bairro: string
          cidade: string
          endereco: string
          id: string
          nome: string
          status: string
          telefone: string
        }[]
      }
      get_subcampanhas_ativas: {
        Args: { _campanha_pai_id: string }
        Returns: {
          adesao_paga: boolean
          arredondamento: string
          bonus_aniversario_ativo: boolean
          bonus_aniversario_multiplicador: number
          bonus_aniversario_tipo_pedido: string | null
          bonus_cadastro_ativo: boolean
          bonus_cadastro_cupons: number
          bonus_indicacao: number
          campanha_pai_id: string | null
          criado_em: string
          cupons_fixos_extras: number
          cupons_por_valor: number
          data_encerramento: string
          data_inicio: string
          data_sorteio: string
          desconto_valor_minimo: number
          descricao: string | null
          id: string
          is_principal: boolean
          limite_cupons_ciclo: number | null
          limite_cupons_consumidor: number | null
          multiplicador_cupons: number
          nome: string
          percentual_comissao: number
          periodo_fim: string | null
          periodo_inicio: string | null
          pizzarias_permitidas: string[] | null
          sequencia_cupons: Json | null
          status: string
          tipo: string
          tipo_precificacao: string
          valor_adesao: number
          valor_minimo_pedido: number
          valor_por_cupom: number
        }[]
        SetofOptions: {
          from: "*"
          to: "campanhas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_perfil: { Args: { _user_id: string }; Returns: string }
      has_perfil: {
        Args: { _perfil: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
