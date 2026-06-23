import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, FileText, Eye, EyeOff, Copy, Info, Wifi,
  MapPin, Link as LinkIcon, Search, Loader2, Pencil, Trash2, LayoutDashboard, KeyRound, Mail,
  Plus, X, TrendingUp, Users, BarChart3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePizzarias, type Pizzaria } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import LogoUpload from "@/components/gestor/LogoUpload";
import PizzariaEspelhoContent from "@/components/gestor/PizzariaEspelhoContent";

/* ─── Google Maps helpers ─────────────────────────────────────────────── */
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let googleMapsLoader: Promise<typeof google.maps> | null = null;

function loadGoogleMapsPlaces() {
  if (!googleMapsApiKey) return Promise.reject(new Error("Chave do Google Maps não configurada."));
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  if (googleMapsLoader) return googleMapsLoader;
  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."));
    document.head.appendChild(script);
  });
  return googleMapsLoader;
}

function getAddressPart(place: google.maps.places.PlaceResult, types: string[]) {
  return place.address_components?.find((c) => types.every((t) => c.types.includes(t)))?.long_name ?? "";
}

/* ─── Badge variant ───────────────────────────────────────────────────── */
const statusVariant = (s: string) =>
  s === "Ativa" ? "default" : s === "Prospectada" ? "secondary" : "outline";

/* ─── Main component ──────────────────────────────────────────────────── */
export default function PizzariaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pizzarias, updatePizzaria, removePizzaria } = usePizzarias();
  const pizzaria = pizzarias.find((p) => p.id === id);

  /* Edit mode */
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Omit<Pizzaria, "id"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  /* Auth / user management */
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  /* Google Maps */
  const placesNodeRef = useRef<HTMLDivElement | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [mapsUrlInput, setMapsUrlInput] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  /* Pizzaria reports history */
  const [pizzariaRelatorios, setPizzariaRelatorios] = useState<any[]>([]);
  const [relatoriosLoading, setRelatoriosLoading] = useState(false);
  const [relatoriosFetched, setRelatoriosFetched] = useState(false);

  /* FAB */
  const [fabOpen, setFabOpen] = useState(false);

  /* Fetch usuario_id + email when pizzaria is loaded */
  useEffect(() => {
    if (!id) return;
    supabase
      .from("pizzarias")
      .select("usuario_id, usuarios(email)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUsuarioId((data as any).usuario_id ?? null);
          setCurrentEmail((data as any).usuarios?.email ?? "");
        }
      });
  }, [id]);

  const fetchPizzariaRelatorios = async () => {
    if (!id || relatoriosFetched) return;
    setRelatoriosLoading(true);
    try {
      const { data, error } = await supabase
        .from("relatorios")
        .select("*")
        .eq("pizzaria_id", id)
        .eq("gerado_por", "pizzaria")
        .order("criado_em", { ascending: false });
      if (error) {
        // Se não tiver coluna gerado_por, busca sem o filtro
        const { data: dataAll } = await supabase
          .from("relatorios")
          .select("*")
          .eq("pizzaria_id", id)
          .order("criado_em", { ascending: false });
        setPizzariaRelatorios(dataAll ?? []);
      } else {
        setPizzariaRelatorios(data ?? []);
      }
    } catch {
      setPizzariaRelatorios([]);
    } finally {
      setRelatoriosLoading(false);
      setRelatoriosFetched(true);
    }
  };

  const enterEditMode = () => {
    if (!pizzaria) return;
    const { id: _id, ...rest } = pizzaria;
    setForm(rest);
    setEditEmail(currentEmail);
    setPlaceQuery(pizzaria.nome);
    setMapsUrlInput(pizzaria.googleMapsUrl ?? "");
    setPlacePredictions([]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm(null);
    setPlacePredictions([]);
    setEditEmail(currentEmail);
  };

  const handleSave = async () => {
    if (!form || !id) return;
    if (!form.nome.trim() || !form.responsavel.trim() || !form.cidade.trim() || !form.bairro.trim()) {
      toast({ title: "Preencha Nome, Responsável, Cidade e Bairro", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update email if changed
      if (editEmail && editEmail !== currentEmail && usuarioId) {
        const res = await supabase.functions.invoke("admin-update-user", {
          body: { pizzariaId: id, action: "update-email", email: editEmail },
        });
        if (res.error || res.data?.error) {
          toast({
            title: "Erro ao atualizar e-mail",
            description: res.data?.error ?? res.error?.message,
            variant: "destructive",
          });
        } else {
          setCurrentEmail(editEmail);
        }
      }
      // Update pizzaria fields
      await updatePizzaria(id, form);
      setEditMode(false);
      setForm(null);
      toast({ title: "Pizzaria atualizada com sucesso!" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    if (!usuarioId) {
      toast({ title: "Esta pizzaria não tem usuário vinculado ao sistema", variant: "destructive" });
      return;
    }
    setResettingPassword(true);
    const res = await supabase.functions.invoke("admin-update-user", {
      body: { pizzariaId: id, action: "update-password", password: newPassword },
    });
    setResettingPassword(false);
    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao redefinir senha",
        description: res.data?.error ?? res.error?.message,
        variant: "destructive",
      });
    } else {
      setNewPassword("");
      toast({ title: "Senha redefinida com sucesso!" });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await removePizzaria(id);
    navigate("/gestor/pizzarias");
  };

  /* ── Google Maps functions ── */
  const applyGooglePlace = (place: google.maps.places.PlaceResult) => {
    if (!form) return;
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast({ title: "Local sem coordenadas", variant: "destructive" });
      return;
    }
    const city = getAddressPart(place, ["administrative_area_level_2"]) || getAddressPart(place, ["locality"]);
    const neighborhood = getAddressPart(place, ["sublocality", "sublocality_level_1"]) || getAddressPart(place, ["neighborhood"]);
    const cep = getAddressPart(place, ["postal_code"]);
    setForm((cur) => cur ? ({
      ...cur,
      endereco: place.formatted_address || cur.endereco,
      cidade: city || cur.cidade,
      bairro: neighborhood || cur.bairro,
      cep: cep || cur.cep,
      latitude: String(lat),
      longitude: String(lng),
      googleMapsUrl: place.url || cur.googleMapsUrl,
      googlePlaceId: place.place_id || cur.googlePlaceId,
    }) : cur);
    setMapsUrlInput(place.url || "");
    setPlacePredictions([]);
    toast({ title: "Localização preenchida", description: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
  };

  const searchGooglePlaces = async () => {
    if (!placeQuery.trim()) return;
    setLocationLoading(true);
    try {
      const maps = await loadGoogleMapsPlaces();
      const service = new maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input: placeQuery, componentRestrictions: { country: "br" }, types: ["establishment"] },
        (predictions, status) => {
          setLocationLoading(false);
          if (status !== maps.places.PlacesServiceStatus.OK || !predictions?.length) {
            setPlacePredictions([]);
            toast({ title: "Nenhum local encontrado", variant: "destructive" });
            return;
          }
          setPlacePredictions(predictions.slice(0, 5));
        }
      );
    } catch (err: any) {
      setLocationLoading(false);
      toast({ title: "Erro ao carregar Google Maps", description: err.message, variant: "destructive" });
    }
  };

  const selectGooglePrediction = async (prediction: google.maps.places.AutocompletePrediction) => {
    setLocationLoading(true);
    try {
      const maps = await loadGoogleMapsPlaces();
      const service = new maps.places.PlacesService(placesNodeRef.current ?? document.createElement("div"));
      service.getDetails(
        { placeId: prediction.place_id, fields: ["name", "formatted_address", "geometry", "place_id", "url", "address_components"] },
        (place, status) => {
          setLocationLoading(false);
          if (status !== maps.places.PlacesServiceStatus.OK || !place) {
            toast({ title: "Não foi possível ler o local", variant: "destructive" });
            return;
          }
          applyGooglePlace(place);
        }
      );
    } catch (err: any) {
      setLocationLoading(false);
      toast({ title: "Erro ao selecionar local", description: err.message, variant: "destructive" });
    }
  };

  const resolveGoogleMapsUrl = async () => {
    if (!mapsUrlInput.trim() || !form) return;
    setLocationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-google-maps-link", {
        body: { url: mapsUrlInput.trim() },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      setForm((cur) => cur ? ({
        ...cur,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        googleMapsUrl: data.finalUrl || mapsUrlInput.trim(),
      }) : cur);
      toast({ title: "Coordenadas extraídas" });
    } catch (err: any) {
      toast({ title: "Não consegui extrair a localização", description: err.message, variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  /* ── Loading / not found ── */
  if (!pizzaria) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Pizzaria não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/gestor/pizzarias")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/pizzarias")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold truncate">{pizzaria.nome}</h1>
          <p className="text-sm text-muted-foreground">{pizzaria.responsavel}</p>
        </div>
        <Badge variant={statusVariant(pizzaria.status)}>{pizzaria.status}</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="clientes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Clientes
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            onClick={fetchPizzariaRelatorios}>
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="perfil" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Perfil
          </TabsTrigger>
        </TabsList>

        {/* ══ Dashboard / Financeiro / Pedidos / Clientes (controlled mode) ══ */}
        <PizzariaEspelhoContent
          pizzariaId={id!}
          pizzariaNome={pizzaria.nome}
          pizzariaCnpj={(pizzaria as any).cnpj ?? null}
          controlled
        />

        {/* ═══════════════════════ ABA RELATÓRIOS ═══════════════════════ */}
        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Relatórios da Pizzaria
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Os relatórios são gerados e gerenciados diretamente pela pizzaria. Como gestor, você pode visualizar o histórico de relatórios gerados por <strong>{pizzaria.nome}</strong>.
              </p>
            </CardHeader>
            <CardContent>
              {relatoriosLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando relatórios...</span>
                </div>
              ) : !relatoriosFetched ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Clique na aba para carregar os relatórios.</p>
                  <Button variant="outline" size="sm" onClick={fetchPizzariaRelatorios}>
                    Carregar relatórios
                  </Button>
                </div>
              ) : pizzariaRelatorios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <FileText className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum relatório gerado pela pizzaria até o momento.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pizzariaRelatorios.map((rel, idx) => (
                    <div key={rel.id ?? idx} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-card hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">
                            {rel.tipo ?? rel.type ?? rel.titulo ?? rel.title ?? "Relatório"}
                          </p>
                          {rel.criado_em && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(rel.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(rel.status || rel.situacao) && (
                          <Badge variant="outline" className="text-xs">
                            {rel.status ?? rel.situacao}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════ ABA PERFIL ═══════════════════════ */}
        <TabsContent value="perfil" className="space-y-4">
          {!editMode ? (
            /* ── Modo visualização ── */
            <>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={enterEditMode}>
                  <Pencil className="h-4 w-4 mr-2" />Editar
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />Excluir
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Dados Gerais */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Dados Gerais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-medium text-right">{pizzaria.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Responsável</span>
                      <span className="font-medium text-right">{pizzaria.responsavel || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CNPJ</span>
                      <span className="font-medium text-right">{pizzaria.cnpj || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone</span>
                      <span className="font-medium text-right">{pizzaria.telefone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">E-mail</span>
                      <span className="font-medium text-right">{currentEmail || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data de Entrada</span>
                      <span className="font-medium text-right">
                        {pizzaria.dataEntrada ? new Date(`${pizzaria.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Endereço */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Endereço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Endereço</span>
                      <span className="font-medium text-right max-w-[60%]">{pizzaria.endereco || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cidade</span>
                      <span className="font-medium text-right">{pizzaria.cidade || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bairro</span>
                      <span className="font-medium text-right">{pizzaria.bairro || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CEP</span>
                      <span className="font-medium text-right">{pizzaria.cep || "—"}</span>
                    </div>
                    {pizzaria.googleMapsUrl && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Google Maps</span>
                        <a href={pizzaria.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                          className="text-primary underline text-xs max-w-[55%] truncate">
                          Ver no mapa
                        </a>
                      </div>
                    )}
                    {(pizzaria.latitude && pizzaria.longitude) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coordenadas</span>
                        <span className="font-medium text-right text-xs">
                          {Number(pizzaria.latitude).toFixed(5)}, {Number(pizzaria.longitude).toFixed(5)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status e Matrícula */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status e Cobrança</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={statusVariant(pizzaria.status)}>{pizzaria.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Matrícula</span>
                      {pizzaria.matriculaPaga
                        ? <span className="font-medium text-emerald-400">Paga</span>
                        : <span className="text-muted-foreground">Pendente</span>}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Modalidade</span>
                      {(pizzaria as any).modalidadeCobranca === "split"
                        ? <Badge className="bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-400">Split automático</Badge>
                        : <Badge variant="outline">Boleto semanal</Badge>}
                    </div>
                  </CardContent>
                </Card>

                {/* Acesso ao Painel */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" />Acesso ao Painel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />E-mail
                      </span>
                      <span className="font-medium text-right">{currentEmail || "—"}</span>
                    </div>

                    {usuarioId ? (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">Defina uma nova senha de acesso ao painel parceiro.</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nova senha (mín. 6 caracteres)"
                              className="pr-10 text-sm"
                              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleResetPassword}
                            disabled={resettingPassword || !newPassword || newPassword.length < 6}
                          >
                            {resettingPassword
                              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Aguarde</>
                              : <><KeyRound className="h-3.5 w-3.5 mr-1" />Redefinir</>}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground border-t border-border pt-3">
                        Pizzaria sem usuário vinculado. Recadastre para criar credenciais de acesso ao painel.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* CardápioWeb */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      🍕 Integração CardápioWeb
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      {pizzaria.cardapiowebMerchantId && pizzaria.cardapiowebApiKey
                        ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Integrado</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Não integrado</Badge>}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Merchant ID</span>
                      <span className="font-medium text-right text-xs max-w-[55%] truncate">
                        {pizzaria.cardapiowebMerchantId || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">API Key</span>
                      <span className="font-medium text-right text-xs">
                        {pizzaria.cardapiowebApiKey ? "••••••••••••" : "—"}
                      </span>
                    </div>
                    {id && (
                      <div>
                        <p className="text-muted-foreground mb-1">Webhook URL</p>
                        <div className="flex gap-2 items-center">
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate flex-1">
                            {`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${id}`}
                          </code>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                            navigator.clipboard.writeText(`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${id}`);
                            toast({ title: "URL copiada!" });
                          }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            /* ── Modo edição ── */
            form && (
              <div className="space-y-5">
                {/* Barra de ações fixa no topo */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <p className="text-sm text-muted-foreground">Editando perfil da pizzaria</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit}>Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Salvando...</> : "Salvar alterações"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">

                  {/* ── Card: Dados Gerais ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Dados Gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                          <Mail className="h-3 w-3" />E-mail de acesso
                        </Label>
                        {!usuarioId && (
                          <p className="text-xs text-amber-800 dark:text-amber-400">Pizzaria sem usuário vinculado — e-mail não pode ser alterado.</p>
                        )}
                        <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="email@exemplo.com" disabled={!usuarioId} />
                        {editEmail && editEmail !== currentEmail && (
                          <p className="text-xs text-primary">Será atualizado ao salvar.</p>
                        )}
                      </div>
                      {([
                        ["nome", "Nome da Pizzaria *", "Ex: Pizzaria Bella Vita"],
                        ["responsavel", "Responsável *", "Nome completo do dono ou gerente"],
                        ["cnpj", "CNPJ", "00.000.000/0000-00"],
                        ["telefone", "Telefone *", "(00) 00000-0000"],
                      ] as const).map(([field, label, placeholder]) => (
                        <div key={field} className="grid gap-1.5">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
                          <Input value={(form as any)[field]} placeholder={placeholder || undefined}
                            onChange={(e) => {
                              if (field === "cnpj") {
                                const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                                let m = raw;
                                if (raw.length > 12) m = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
                                else if (raw.length > 8) m = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
                                else if (raw.length > 5) m = raw.replace(/^(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
                                else if (raw.length > 2) m = raw.replace(/^(\d{2})(\d{1,3})/, "$1.$2");
                                setForm({ ...form, cnpj: m });
                              } else if (field === "telefone") {
                                const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let m = raw;
                                if (raw.length > 6) m = raw.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
                                else if (raw.length > 2) m = raw.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
                                setForm({ ...form, telefone: m });
                              } else {
                                setForm({ ...form, [field]: e.target.value });
                              }
                            }} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* ── Card: Endereço ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Endereço</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {([
                        ["endereco", "Endereço", ""],
                        ["cidade", "Cidade *", ""],
                        ["bairro", "Bairro *", ""],
                        ["cep", "CEP", ""],
                      ] as const).map(([field, label, placeholder]) => (
                        <div key={field} className="grid gap-1.5">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
                          <Input value={(form as any)[field]} placeholder={placeholder || undefined}
                            onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
                        </div>
                      ))}
                      <div className="pt-1 border-t border-border space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />Localização Google Maps
                        </p>
                        <div className="flex gap-2">
                          <Input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)}
                            placeholder="Buscar pelo nome..." className="text-sm"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchGooglePlaces(); } }} />
                          <Button type="button" variant="outline" size="sm" disabled={locationLoading || !placeQuery.trim()} onClick={searchGooglePlaces}>
                            <Search className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {placePredictions.length > 0 && (
                          <div className="rounded-md border border-border overflow-hidden bg-card">
                            {placePredictions.map((p) => (
                              <button key={p.place_id} type="button"
                                className="w-full px-3 py-2 text-left text-xs hover:bg-muted border-b border-border last:border-b-0"
                                onClick={() => selectGooglePrediction(p)}>
                                <span className="font-medium block">{p.structured_formatting.main_text}</span>
                                <span className="text-muted-foreground">{p.structured_formatting.secondary_text}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input value={mapsUrlInput} onChange={(e) => { setMapsUrlInput(e.target.value); setForm({ ...form, googleMapsUrl: e.target.value }); }}
                            placeholder="Ou cole o link do Maps..." className="text-sm" />
                          <Button type="button" variant="outline" size="sm" disabled={locationLoading || !mapsUrlInput.trim()} onClick={resolveGoogleMapsUrl}>
                            <LinkIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {(form.latitude && form.longitude) && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Coordenadas: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
                          </p>
                        )}
                        <div ref={placesNodeRef} className="hidden" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Card: Configurações ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Configurações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Pizzaria["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Prospectada">Prospectada</SelectItem>
                            <SelectItem value="Ativa">Ativa</SelectItem>
                            <SelectItem value="Inativa">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Modalidade de Cobrança</Label>
                        <Select value={form.modalidadeCobranca ?? "boleto"} onValueChange={(v) => setForm({ ...form, modalidadeCobranca: v as "boleto" | "split" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto semanal</SelectItem>
                            <SelectItem value="split">Split automático (cardápio web)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {(form.modalidadeCobranca ?? "boleto") === "split"
                            ? "Comissão retida no pagamento — nenhum boleto é gerado."
                            : "Comissão cobrada via boleto semanal."}
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Data de Entrada</Label>
                        <Input type="date" value={form.dataEntrada} onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })} />
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium">Matrícula Paga</p>
                          <p className="text-xs text-muted-foreground">Taxa de adesão ao programa</p>
                        </div>
                        <Switch checked={form.matriculaPaga} onCheckedChange={(v) => setForm({ ...form, matriculaPaga: v })} />
                      </div>
                      <div className="pt-1">
                        <LogoUpload label="Logo da Pizzaria" value={logoUrl} onChange={setLogoUrl} folder="pizzarias" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Card: Integração CardápioWeb ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Integração CardápioWeb</CardTitle>
                        {form.cardapiowebMerchantId && form.cardapiowebApiKey
                          ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Configurado</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">Não configurado</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          Merchant ID
                          <span title="CardápioWeb → Integrações → API de Integração → Código da loja">
                            <Info className="h-3 w-3" />
                          </span>
                        </Label>
                        <Input value={form.cardapiowebMerchantId} onChange={(e) => setForm({ ...form, cardapiowebMerchantId: e.target.value })}
                          placeholder="Código da loja" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          API Key
                          <span title="CardápioWeb → Integrações → API de Integração → Copiar token">
                            <Info className="h-3 w-3" />
                          </span>
                        </Label>
                        <div className="relative">
                          <Input type={showApiKey ? "text" : "password"} value={form.cardapiowebApiKey}
                            onChange={(e) => setForm({ ...form, cardapiowebApiKey: e.target.value })}
                            placeholder="Token de autenticação" className="pr-10" />
                          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowApiKey(!showApiKey)}>
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      {id && (
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Webhook URL</Label>
                          <div className="flex gap-2">
                            <Input readOnly value={`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${id}`}
                              className="bg-muted text-xs" />
                            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => {
                              navigator.clipboard.writeText(`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${id}`);
                              toast({ title: "URL copiada!" });
                            }}><Copy className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="w-full"
                        disabled={!form.cardapiowebMerchantId || !form.cardapiowebApiKey || testingConnection}
                        onClick={() => {
                          setTestingConnection(true);
                          setTimeout(() => {
                            toast({ title: "Conexão testada com sucesso!", description: `Merchant ID: ${form.cardapiowebMerchantId}` });
                            setTestingConnection(false);
                          }, 1500);
                        }}>
                        <Wifi className="h-3.5 w-3.5 mr-1.5" />
                        {testingConnection ? "Testando..." : "Testar conexão"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* ── Card: Acesso ao Painel ── */}
                  {usuarioId && (
                    <Card className="md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />Redefinir Senha
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-3">
                          Defina uma nova senha de acesso ao painel parceiro. Deixe em branco para manter a senha atual.
                        </p>
                        <div className="flex gap-2 max-w-md">
                          <div className="relative flex-1">
                            <Input type={showNewPassword ? "text" : "password"} value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nova senha (mín. 6 caracteres)" className="pr-10"
                              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }} />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowNewPassword(!showNewPassword)}>
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={handleResetPassword}
                            disabled={resettingPassword || !newPassword || newPassword.length < 6}>
                            {resettingPassword
                              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Redefinindo...</>
                              : <><KeyRound className="h-3.5 w-3.5 mr-1" />Redefinir</>}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                </div>
              </div>
            )
          )}
        </TabsContent>

      </Tabs>

      {/* ═══════════════════════ FAB ═══════════════════════ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            <button
              onClick={() => { setFabOpen(false); navigate("/gestor/desempenho/clientes", { state: { pizzariaId: id, pizzariaNome: pizzaria?.nome } }); }}
              className="flex items-center gap-2 rounded-full bg-card border border-border shadow-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Users className="h-4 w-4 text-primary" />
              Desempenho de Clientes
            </button>
            <button
              onClick={() => { setFabOpen(false); navigate("/gestor/desempenho/vendas", { state: { pizzariaId: id, pizzariaNome: pizzaria?.nome } }); }}
              className="flex items-center gap-2 rounded-full bg-card border border-border shadow-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <BarChart3 className="h-4 w-4 text-primary" />
              Desempenho de Vendas
            </button>
            <button
              onClick={() => { setFabOpen(false); navigate("/gestor/financeiro/receitas", { state: { pizzariaId: id, pizzariaNome: pizzaria?.nome } }); }}
              className="flex items-center gap-2 rounded-full bg-card border border-border shadow-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              Desempenho Financeiro
            </button>
          </div>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
          aria-label={fabOpen ? "Fechar menu" : "Abrir menu de ações"}
        >
          {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pizzaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A pizzaria <strong>{pizzaria.nome}</strong> será removida permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
