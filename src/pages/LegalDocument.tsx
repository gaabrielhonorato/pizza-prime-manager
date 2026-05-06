import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSION } from "@/lib/legal";
import { BrandLogo } from "@/components/BrandLogo";
import { useEmpresaBranding } from "@/contexts/EmpresaBrandingContext";

type LegalDocumentProps = {
  type: "privacy" | "terms";
};

export default function LegalDocument({ type }: LegalDocumentProps) {
  const isPrivacy = type === "privacy";
  const { nome: brandName } = useEmpresaBranding();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <Card className="mx-auto max-w-3xl border-border bg-card">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isPrivacy ? "Política de Privacidade" : "Termos de Participação"}
              </h1>
              <p className="text-sm text-muted-foreground">{brandName} - versão {LEGAL_VERSION}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-6 text-muted-foreground">
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
          <div className="pt-4">
            <Button asChild variant="outline">
              <Link to="/cadastro">Voltar ao cadastro</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <p>
        Esta política descreve como a Pizza Premiada trata dados pessoais para cadastro, participação em campanhas,
        geração de cupons, gestão de pedidos, comunicação com participantes e cumprimento de obrigações legais.
      </p>
      <Section title="Dados tratados">
        Podemos tratar nome, CPF, e-mail, telefone/WhatsApp, cidade, bairro, data de nascimento, gênero, dados de
        pedidos, cupons, prêmios, interações de suporte e registros técnicos de segurança.
      </Section>
      <Section title="Finalidades">
        Usamos os dados para identificar participantes, validar cupons, operar campanhas promocionais, comunicar
        informações sobre pedidos/campanhas, prevenir fraude, gerar relatórios administrativos e cumprir exigências
        regulatórias aplicáveis.
      </Section>
      <Section title="WhatsApp e comunicações">
        Mensagens promocionais por WhatsApp dependem de aceite específico. O participante pode solicitar a interrupção
        dessas comunicações pelos canais de atendimento disponíveis.
      </Section>
      <Section title="Compartilhamento">
        Dados podem ser compartilhados com operadores necessários à operação, como provedores de banco de dados,
        autenticação, hospedagem, mensageria, integrações de pedidos e ferramentas de auditoria, sempre conforme a
        finalidade operacional.
      </Section>
      <Section title="Retenção e segurança">
        Os dados são mantidos pelo período necessário à execução da campanha, cumprimento legal, auditoria e defesa de
        direitos. Aplicamos controles de acesso, autenticação, RLS no banco de dados e backups privados.
      </Section>
      <Section title="Direitos do titular">
        O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, exclusão, portabilidade,
        informação sobre compartilhamento e revogação de consentimento, observadas obrigações legais de retenção.
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <p>
        Estes termos regulam a participação do consumidor nas campanhas da Pizza Premiada, incluindo cadastro,
        geração de cupons, validação, sorteios e comunicação com participantes.
      </p>
      <Section title="Participação">
        A participação exige cadastro com informações verdadeiras e aceite destes termos. Pedidos elegíveis podem gerar
        cupons conforme as regras da campanha vigente.
      </Section>
      <Section title="Cupons e validação">
        Cupons podem ficar pendentes até a conclusão do cadastro e aceite dos termos. A quantidade de cupons depende do
        valor do pedido, regras comerciais e critérios definidos na campanha ativa.
      </Section>
      <Section title="Sorteios e prêmios">
        Sorteios, premiações, datas e critérios de contemplação seguem as regras da campanha e eventuais exigências de
        autorização regulatória aplicáveis.
      </Section>
      <Section title="Comunicações">
        A plataforma poderá enviar mensagens transacionais sobre cadastro, cupons, pedidos, sorteios e prêmios. Mensagens
        promocionais por WhatsApp dependem de aceite específico.
      </Section>
      <Section title="Responsabilidades">
        O participante é responsável pela veracidade dos dados informados. A Pizza Premiada pode bloquear cadastros ou
        cupons em caso de fraude, duplicidade indevida ou descumprimento das regras.
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
