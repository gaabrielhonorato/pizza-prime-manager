import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Search, Filter, X, CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, Copy, Info, Wifi, MapPin, Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePizzarias, type Pizzaria } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PizzariaMetricsModal from "@/components/gestor/PizzariaMetricsModal";
import ExportButton from "@/components/gestor/ExportButton";
import LogoUpload from "@/components/gestor/LogoUpload";

const statusVariant = (s: string) =>
  s === "Ativa" ? "default" : s === "Prospectada" ? "secondary" : "outline";

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
  return place.address_components?.find((component) => types.every((type) => component.types.includes(type)))?.long_name ?? "";
}

const createEmptyForm = (): Omit<Pizzaria, "id"> => ({
  nome: "",
  responsavel: "",
  cnpj: "",
  telefone: "",
  endereco: "",
  cidade: "",
  bairro: "",
  cep: "",
  latitude: "",
  longitude: "",
  googleMapsUrl: "",
  googlePlaceId: "",
  status: "Ativa",
  matriculaPaga: false,
  dataEntrada: new Date().toISOString().slice(0, 10),
  vendas: 0,
  faturamento: 0,
  cardapiowebMerchantId: "",
  cardapiowebApiKey: "",
  modalidadeCobranca: "boleto" as const,
});

type SortMode = "cadastro" | "vendas";

export default function Pizzarias() {
  const navigate = useNavigate();
  const { pizzarias, updatePizzaria, refetch } = usePizzarias();
  const placesNodeRef = useRef<HTMLDivElement | null>(null);

  // Dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Pizzaria, "id">>(createEmptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [detailPizzaria, setDetailPizzaria] = useState<Pizzaria | null>(null);
  const [detailMetrics, setDetailMetrics] = useState<{ pedidos: number; totalVendido: number; cupons: number; consumidores: number; chartData: { mes: string; pedidos: number }[]; cuponsPerConsumer: { consumidorId: string; nome: string; telefone: string; cupons: number; cadastroCompleto: boolean }[] }>({ pedidos: 0, totalVendido: 0, cupons: 0, consumidores: 0, chartData: [], cuponsPerConsumer: [] });
  const [metricsModal, setMetricsModal] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: "", nome: "" });

  // Filters
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [vendasMin, setVendasMin] = useState("");
  const [vendasMax, setVendasMax] = useState("");
  const [statusFilter, setStatusFilter] = useState<Record<string, boolean>>({
    Ativa: false,
    Prospectada: false,
    Inativa: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Cupons por pizzaria (para coluna na lista)
  const [cuponsPerPizzaria, setCuponsPerPizzaria] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("cupons")
      .select("quantidade, pedidos!inner(pizzaria_id)")
      .in("status", ["validado", "pendente"])
      .then(({ data }) => {
        const map: Record<string, number> = {};
        data?.forEach((c: any) => {
          const pid = c.pedidos?.pizzaria_id;
          if (pid) map[pid] = (map[pid] ?? 0) + c.quantidade;
        });
        setCuponsPerPizzaria(map);
      });
  }, []);

  // Sort & pagination
  const [sortMode, setSortMode] = useState<SortMode>("vendas");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let result = [...pizzarias];

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((p) =>
        [p.nome, p.cnpj, p.endereco, p.cidade, p.bairro, p.cep]
          .some((f) => f.toLowerCase().includes(q))
      );
    }

    // Date range
    if (dateFrom) {
      result = result.filter((p) => new Date(`${p.dataEntrada}T12:00:00`) >= dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      result = result.filter((p) => new Date(`${p.dataEntrada}T12:00:00`) <= end);
    }

    // Sales range
    const minV = vendasMin ? Number(vendasMin) : null;
    const maxV = vendasMax ? Number(vendasMax) : null;
    if (minV !== null && !isNaN(minV)) result = result.filter((p) => p.vendas >= minV);
    if (maxV !== null && !isNaN(maxV)) result = result.filter((p) => p.vendas <= maxV);

    // Status
    const activeStatuses = Object.entries(statusFilter).filter(([, v]) => v).map(([k]) => k);
    if (activeStatuses.length > 0) {
      result = result.filter((p) => activeStatuses.includes(p.status));
    }

    // Sort
    if (sortMode === "cadastro") {
      result.sort((a, b) => new Date(b.dataEntrada).getTime() - new Date(a.dataEntrada).getTime());
    } else {
      result.sort((a, b) => b.vendas - a.vendas);
    }

    return result;
  }, [pizzarias, searchText, dateFrom, dateTo, vendasMin, vendasMax, statusFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  const clearFilters = () => {
    setSearchText("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setVendasMin("");
    setVendasMax("");
    setStatusFilter({ Ativa: false, Prospectada: false, Inativa: false });
    resetPage();
  };

  // Fetch detail metrics when a pizzaria is selected
  useEffect(() => {
    if (!detailPizzaria) return;
    const fetchMetrics = async () => {
      const pid = detailPizzaria.id;
      const { data: camp } = await supabase.from("campanhas").select("id").eq("is_principal", true).limit(1).single();
      const campId = camp?.id;
      let pedidosQuery = supabase.from("pedidos").select("id, valor_total, data_pedido, consumidor_id").eq("pizzaria_id", pid);
      if (campId) pedidosQuery = pedidosQuery.eq("campanha_id", campId);
      const { data: pedidos } = await pedidosQuery;
      const totalPedidos = pedidos?.length ?? 0;
      const totalVendido = pedidos?.reduce((s, p) => s + Number(p.valor_total), 0) ?? 0;

      // Fetch real cupons from cupons table
      const pedidoIds = pedidos?.map(p => p.id) ?? [];
      let totalCupons = 0;
      const cuponsPerConsumer: { consumidorId: string; nome: string; telefone: string; cupons: number; cadastroCompleto: boolean }[] = [];
      if (pedidoIds.length > 0) {
        const { data: cuponsData } = await supabase
          .from("cupons")
          .select("quantidade, status, consumidor_id")
          .in("pedido_id", pedidoIds);
        
        const cuponsMap = new Map<string, number>();
        cuponsData?.forEach((c: any) => {
          if (c.status === "validado" || c.status === "pendente") {
            totalCupons += c.quantidade;
            cuponsMap.set(c.consumidor_id, (cuponsMap.get(c.consumidor_id) ?? 0) + c.quantidade);
          }
        });

        // Fetch consumer details for drawer
        const consIds = [...cuponsMap.keys()];
        if (consIds.length > 0) {
          const { data: consData } = await supabase
            .from("consumidores")
            .select("id, cadastro_completo, usuario_id, usuarios(nome, telefone, email)")
            .in("id", consIds);
          consData?.forEach((c: any) => {
            if (c.usuarios?.telefone) {
              cuponsPerConsumer.push({
                consumidorId: c.id,
                nome: c.usuarios?.nome || c.usuarios?.telefone || "—",
                telefone: c.usuarios?.telefone || "—",
                cupons: cuponsMap.get(c.id) ?? 0,
                cadastroCompleto: c.cadastro_completo,
              });
            }
          });
          cuponsPerConsumer.sort((a, b) => b.cupons - a.cupons);
        }
      }

      // Consumidores with phone
      const uniqueConsumidorIds = [...new Set(pedidos?.filter(p => p.consumidor_id).map(p => p.consumidor_id) ?? [])];
      let totalConsumidores = 0;
      if (uniqueConsumidorIds.length > 0) {
        const { data: consCheck } = await supabase
          .from("consumidores")
          .select("id, usuario_id, usuarios(telefone)")
          .in("id", uniqueConsumidorIds);
        totalConsumidores = consCheck?.filter((c: any) => c.usuarios?.telefone).length ?? 0;
      }

      const monthMap = new Map<string, number>();
      pedidos?.forEach((p) => {
        const d = new Date(p.data_pedido);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      });
      const chartData = [...monthMap.entries()].sort().slice(-6).map(([mes, pedidos]) => ({ mes, pedidos }));
      setDetailMetrics({ pedidos: totalPedidos, totalVendido, cupons: totalCupons, consumidores: totalConsumidores, chartData, cuponsPerConsumer });
    };
    fetchMetrics();
  }, [detailPizzaria]);

  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newSenha, setNewSenha] = useState("");
  const [postCreate, setPostCreate] = useState<{ id: string; nome: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [mapsUrlInput, setMapsUrlInput] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const applyGooglePlace = (place: google.maps.places.PlaceResult) => {
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast({ title: "Local sem coordenadas", description: "Selecione outro resultado do Google Maps.", variant: "destructive" });
      return;
    }

    const city = getAddressPart(place, ["administrative_area_level_2"]) || getAddressPart(place, ["locality"]);
    const neighborhood = getAddressPart(place, ["sublocality", "sublocality_level_1"]) || getAddressPart(place, ["neighborhood"]);
    const cep = getAddressPart(place, ["postal_code"]);

    setForm((current) => ({
      ...current,
      nome: current.nome || place.name || "",
      endereco: place.formatted_address || current.endereco,
      cidade: city || current.cidade,
      bairro: neighborhood || current.bairro,
      cep: cep || current.cep,
      latitude: String(lat),
      longitude: String(lng),
      googleMapsUrl: place.url || current.googleMapsUrl,
      googlePlaceId: place.place_id || current.googlePlaceId,
    }));
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
            toast({ title: "Nenhum local encontrado", description: "Tente buscar pelo nome da pizzaria e cidade.", variant: "destructive" });
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
    if (!mapsUrlInput.trim()) return;
    setLocationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-google-maps-link", {
        body: { url: mapsUrlInput.trim() },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      setForm((current) => ({
        ...current,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        googleMapsUrl: data.finalUrl || mapsUrlInput.trim(),
      }));
      toast({ title: "Coordenadas extraídas", description: `${Number(data.latitude).toFixed(6)}, ${Number(data.longitude).toFixed(6)}` });
    } catch (err: any) {
      toast({ title: "Não consegui extrair a localização", description: err.message, variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  // CRUD
  const openNew = () => { setForm(createEmptyForm()); setEditId(null); setNewEmail(""); setNewSenha(""); setPlaceQuery(""); setMapsUrlInput(""); setPlacePredictions([]); setOpen(true); };
  const handleSave = async () => {
    if (saving) return;
    if (editId) {
      updatePizzaria(editId, form);
      setOpen(false);
      return;
    }
    // New pizzaria: require email, password, nome, responsavel, telefone, cidade, bairro
    if (!newEmail.trim() || !newSenha.trim() || !form.nome.trim() || !form.responsavel.trim() || !form.telefone.trim() || !form.cidade.trim() || !form.bairro.trim()) {
      toast({ title: "Preencha e-mail, senha, nome da pizzaria, responsável, telefone, cidade e bairro", variant: "destructive" });
      return;
    }
    if (newSenha.length < 6) {
      toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Try Edge Function first to create Auth user + pizzaria
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail.trim().toLowerCase(),
          password: newSenha,
          nome: form.responsavel.trim(),
          telefone: form.telefone || null,
          perfil: "pizzaria",
          extra: {
            nomePizzaria: form.nome,
            responsavelNome: form.responsavel,
            cnpj: form.cnpj || null,
            telefone: form.telefone || null,
            endereco: form.endereco || null,
            cidade: form.cidade,
            bairro: form.bairro,
            cep: form.cep || null,
            latitude: form.latitude ? Number(form.latitude) : null,
            longitude: form.longitude ? Number(form.longitude) : null,
            googleMapsUrl: form.googleMapsUrl || null,
            googlePlaceId: form.googlePlaceId || null,
            status: form.status?.toLowerCase() || "ativa",
            matriculaPaga: form.matriculaPaga,
            modalidadeCobranca: form.modalidadeCobranca ?? "boleto",
            cardapiowebMerchantId: form.cardapiowebMerchantId || null,
            cardapiowebApiKey: form.cardapiowebApiKey || null,
          },
        },
      });
      if (res.error || res.data?.error) {
        // Fallback: insert directly into pizzarias without Auth user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: "Você precisa estar logado", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { data: insertData, error } = await supabase.from("pizzarias").insert({
          nome: form.nome,
          responsavel_nome: form.responsavel || null,
          cnpj: form.cnpj || null,
          telefone: form.telefone,
          endereco: form.endereco || null,
          cidade: form.cidade,
          bairro: form.bairro,
          cep: form.cep || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          google_maps_url: form.googleMapsUrl || null,
          google_place_id: form.googlePlaceId || null,
          status: form.status?.toLowerCase() || "ativa",
          matricula_paga: form.matriculaPaga,
          modalidade_cobranca: form.modalidadeCobranca ?? "boleto",
          usuario_id: user.id,
          cardapioweb_merchant_id: form.cardapiowebMerchantId || null,
          cardapioweb_api_key: form.cardapiowebApiKey || null,
        }).select("id").single();
        if (error) {
          toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
        } else {
          const newId = insertData?.id || null;
          toast({ title: "Pizzaria cadastrada (sem login próprio)", description: "A pizzaria foi salva, mas não foi possível criar credenciais de acesso." });
          setOpen(false);
          refetch();
          if (newId) setPostCreate({ id: newId, nome: form.nome });
        }
      } else {
        const newId = res.data?.pizzaria_id || null;
        toast({ title: "Pizzaria cadastrada com sucesso!" });
        setOpen(false);
        refetch();
        if (newId) {
          setPostCreate({ id: newId, nome: form.nome });
        } else {
          navigate("/gestor/pizzarias");
        }
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = ["Nome", "Responsável", "CNPJ", "Cidade", "Bairro", "CEP", "Telefone", "Status", "Matrícula", "Data de Cadastro", "Vendas"];
    const rows = filtered.map((p) => [
      p.nome, p.responsavel, p.cnpj, p.cidade, p.bairro, p.cep, p.telefone, p.status,
      p.matriculaPaga ? "Paga" : "Pendente",
      new Date(`${p.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR"),
      String(p.vendas),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pizzarias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">Pizzarias</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pizzaria..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); resetPage(); }}
              className="w-[220px] pl-9"
            />
          </div>
          <Select value={sortMode} onValueChange={(v) => { setSortMode(v as SortMode); resetPage(); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cadastro">Ordem de Cadastro</SelectItem>
              <SelectItem value="vendas">Ranking por Vendas</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="mr-2 h-4 w-4" />{showFilters ? "Ocultar Filtros" : "Filtros"}
          </Button>
          <ExportButton
            data={filtered.map(p => ({
              nome: p.nome, responsavel: p.responsavel, cidade: p.cidade, bairro: p.bairro,
              telefone: p.telefone, status: p.status,
              dataEntrada: new Date(`${p.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR"),
              totalVendas: `R$ ${p.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            }))}
            columns={[
              { key: "nome", label: "Nome" }, { key: "responsavel", label: "Responsável" },
              { key: "cidade", label: "Cidade" }, { key: "bairro", label: "Bairro" },
              { key: "telefone", label: "Telefone" }, { key: "status", label: "Status" },
              { key: "dataEntrada", label: "Data Entrada" }, { key: "totalVendas", label: "Total Vendas" },
            ]}
            fileName="pizzarias"
          />
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Pizzaria</Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Search */}
            <div className="space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CNPJ, endereço, cidade, bairro, CEP..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); resetPage(); }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <Label>Data de Cadastro</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); resetPage(); }} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); resetPage(); }} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sales range */}
            <div className="space-y-1.5">
              <Label>Quantidade de Vendas</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Mínimo" value={vendasMin} onChange={(e) => { setVendasMin(e.target.value); resetPage(); }} />
                <Input type="number" placeholder="Máximo" value={vendasMax} onChange={(e) => { setVendasMax(e.target.value); resetPage(); }} />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-4 pt-1">
                {(["Ativa", "Prospectada", "Inativa"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={statusFilter[s]}
                      onCheckedChange={(v) => { setStatusFilter((prev) => ({ ...prev, [s]: !!v })); resetPage(); }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />Limpar Filtros
            </Button>
          </div>
        </div>
      )}

      {/* Counter + Per Page */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de{" "}
          <span className="font-semibold text-foreground">{pizzarias.length}</span> pizzarias
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Por página:</span>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); resetPage(); }}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 30, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade/Bairro</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Comissão PP</TableHead>
              <TableHead className="text-right">Cupons</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  Nenhuma pizzaria encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell className="text-center text-muted-foreground font-medium">{(safePage - 1) * perPage + idx + 1}</TableCell>
                  <TableCell className="font-medium cursor-pointer hover:underline text-primary" onClick={() => navigate(`/gestor/pizzarias/${p.id}`)}>{p.nome}</TableCell>
                  <TableCell>{p.cidade}{p.bairro ? ` – ${p.bairro}` : ""}</TableCell>
                  <TableCell>{p.telefone}</TableCell>
                  <TableCell className="text-right font-medium">{(p.vendas ?? 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{(p.faturamento ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell className="text-right font-medium">{((p.faturamento ?? 0) * 0.15).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell className="text-right font-medium">{(cuponsPerPizzaria[p.id] ?? 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => navigate(`/gestor/pizzarias/${p.id}`)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === safePage ? "default" : "outline"}
              size="sm"
              className="min-w-[36px]"
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
            Próxima<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar Pizzaria" : "Nova Pizzaria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editId && (
              <>
                <div className="grid gap-1.5">
                  <Label>E-mail de acesso *</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="pizzaria@email.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Senha inicial *</Label>
                  <Input type="password" value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
              </>
            )}
            {([
              ["nome", "Nome da Pizzaria *", "Ex: Pizzaria Bella Vita"],
              ["responsavel", "Responsável da Pizzaria *", "Ex: João Silva"],
              ["cnpj", "CNPJ", "00.000.000/0000-00"],
              ["telefone", "Telefone *", "(00) 00000-0000"],
              ["endereco", "Endereço", ""],
              ["cidade", "Cidade *", ""],
              ["bairro", "Bairro *", ""],
              ["cep", "CEP", ""],
            ] as const).map(([field, label, placeholder]) => (
              <div key={field} className="grid gap-1.5">
                <Label>{label}</Label>
                {field === "responsavel" && (
                  <p className="text-xs text-muted-foreground -mt-1">
                    Nome completo do dono, sócio ou gerente responsável pela pizzaria (não o gestor que está cadastrando)
                  </p>
                )}
                <Input
                  value={form[field]}
                  onChange={(e) => {
                    if (field === "cnpj") {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                      let masked = raw;
                      if (raw.length > 12) masked = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
                      else if (raw.length > 8) masked = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
                      else if (raw.length > 5) masked = raw.replace(/^(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
                      else if (raw.length > 2) masked = raw.replace(/^(\d{2})(\d{1,3})/, "$1.$2");
                      setForm({ ...form, cnpj: masked });
                    } else if (field === "telefone") {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let masked = raw;
                      if (raw.length > 6) masked = raw.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
                      else if (raw.length > 2) masked = raw.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
                      setForm({ ...form, telefone: masked });
                    } else {
                      setForm({ ...form, [field]: e.target.value });
                    }
                  }}
                  placeholder={placeholder || undefined}
                />
              </div>
            ))}
            <div className="col-span-full border-t border-border pt-4 mt-2 space-y-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Localização no Google Maps</h3>
                <p className="text-xs text-muted-foreground mt-1">Busque a pizzaria pelo nome ou cole o link de compartilhamento do Google Maps. O sistema salva as coordenadas para exibir no site.</p>
              </div>
              <div className="grid gap-1.5">
                <Label>Buscar pizzaria no Google</Label>
                <div className="flex gap-2">
                  <Input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Ex: Pizza Hut Anápolis" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchGooglePlaces(); } }} />
                  <Button type="button" variant="outline" disabled={locationLoading || !placeQuery.trim()} onClick={searchGooglePlaces}>
                    <Search className="h-4 w-4 mr-1" /> Buscar
                  </Button>
                </div>
                {placePredictions.length > 0 && (
                  <div className="rounded-md border border-border overflow-hidden bg-card">
                    {placePredictions.map((prediction) => (
                      <button key={prediction.place_id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted border-b border-border last:border-b-0" onClick={() => selectGooglePrediction(prediction)}>
                        <span className="font-medium block">{prediction.structured_formatting.main_text}</span>
                        <span className="text-xs text-muted-foreground">{prediction.structured_formatting.secondary_text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Ou cole o link do Google Maps</Label>
                <div className="flex gap-2">
                  <Input value={mapsUrlInput} onChange={(e) => { setMapsUrlInput(e.target.value); setForm({ ...form, googleMapsUrl: e.target.value }); }} placeholder="https://maps.app.goo.gl/..." />
                  <Button type="button" variant="outline" disabled={locationLoading || !mapsUrlInput.trim()} onClick={resolveGoogleMapsUrl}>
                    <LinkIcon className="h-4 w-4 mr-1" /> Extrair
                  </Button>
                </div>
              </div>
              {(form.latitude && form.longitude) && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium text-emerald-400">Localização pronta para o site</p>
                  <p className="text-muted-foreground mt-1">Latitude: {form.latitude} · Longitude: {form.longitude}</p>
                  {form.googleMapsUrl && <p className="text-xs text-muted-foreground mt-1 truncate">Link: {form.googleMapsUrl}</p>}
                </div>
              )}
              <div ref={placesNodeRef} className="hidden" />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
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
              <Label>Modalidade de Cobrança</Label>
              <Select value={form.modalidadeCobranca} onValueChange={(v) => setForm({ ...form, modalidadeCobranca: v as "boleto" | "split" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto semanal</SelectItem>
                  <SelectItem value="split">Split automático (cardápio web)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.modalidadeCobranca === "split"
                  ? "A comissão é separada automaticamente no momento do pagamento no cardápio web. Não são gerados boletos."
                  : "A comissão é cobrada via boleto semanal gerado manualmente pelo gestor."}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Data de Entrada</Label>
              <Input type="date" value={form.dataEntrada} onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.matriculaPaga} onCheckedChange={(v) => setForm({ ...form, matriculaPaga: v })} />
              <Label>Matrícula Paga</Label>
            </div>

            {/* Logo Upload */}
            <div className="col-span-full border-t border-border pt-4 mt-2">
              <LogoUpload label="Logo da Pizzaria" value={logoUrl} onChange={setLogoUrl} folder="pizzarias" />
            </div>

            {/* CardápioDigital Integration Section */}
            <div className="col-span-full border-t border-border pt-4 mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">🍕 Integração CardápioDigital</h3>
                {form.cardapiowebMerchantId && form.cardapiowebApiKey
                  ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Configurado</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>}
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">Merchant ID</Label>
                  <span title="Encontre em: CardápioDigital → Integrações → API de Integração → Código da loja"><Info className="h-3.5 w-3.5 text-muted-foreground" /></span>
                </div>
                <Input value={form.cardapiowebMerchantId} onChange={(e) => setForm({ ...form, cardapiowebMerchantId: e.target.value })} placeholder="Código da loja no CardápioDigital" />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">API Key</Label>
                  <span title="Encontre em: CardápioDigital → Integrações → API de Integração → Copiar token"><Info className="h-3.5 w-3.5 text-muted-foreground" /></span>
                </div>
                <div className="relative">
                  <Input type={showApiKey ? "text" : "password"} value={form.cardapiowebApiKey} onChange={(e) => setForm({ ...form, cardapiowebApiKey: e.target.value })} placeholder="Token de autenticação" className="pr-10" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {editId && (
                <div className="grid gap-1.5">
                  <Label className="text-sm text-muted-foreground">Webhook URL (somente leitura)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${editId}`} className="bg-secondary text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${editId}`); toast({ title: "URL copiada!" }); }}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" disabled={!form.cardapiowebMerchantId || !form.cardapiowebApiKey || testingConnection} onClick={() => {
                setTestingConnection(true);
                setTimeout(() => {
                  toast({ title: "Conexão testada com sucesso!", description: `Merchant ID: ${form.cardapiowebMerchantId}` });
                  setTestingConnection(false);
                }, 1500);
              }}>
                <Wifi className="h-4 w-4 mr-1" /> {testingConnection ? "Testando..." : "Testar conexão"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-creation success dialog */}
      {postCreate && (
        <Dialog open={!!postCreate} onOpenChange={(o) => { if (!o) setPostCreate(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Pizzaria cadastrada!</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                <strong>{postCreate.nome}</strong> foi cadastrada com sucesso.
              </p>
              <div className="space-y-1.5">
                <Label className="text-sm">URL do Webhook (CardápioDigital)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${postCreate.id}`}
                    className="bg-secondary text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://axbrjlxwslkpttvgsahi.supabase.co/functions/v1/cardapioweb-webhook?pid=${postCreate.id}`);
                      toast({ title: "URL copiada!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastre esta URL no CardápioDigital → Integrações → Webhook.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setPostCreate(null)}>Fechar</Button>
              </DialogClose>
              <Button onClick={() => { setPostCreate(null); navigate(`/gestor/pizzarias/${postCreate.id}`); }}>
                Ir para o Perfil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detailPizzaria} onOpenChange={(o) => !o && setDetailPizzaria(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailPizzaria && (
            <>
              <SheetHeader>
                <SheetTitle className="font-heading">{detailPizzaria.nome}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Cidade:</span> {detailPizzaria.cidade}</div>
                  <div><span className="text-muted-foreground">Bairro:</span> {detailPizzaria.bairro}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusVariant(detailPizzaria.status)}>{detailPizzaria.status}</Badge></div>
                  <div><span className="text-muted-foreground">Entrada:</span> {new Date(`${detailPizzaria.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Total de Pedidos</p><p className="text-lg font-bold">{detailMetrics.pedidos}</p></Card>
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Total Vendido</p><p className="text-lg font-bold">R$ {detailMetrics.totalVendido.toLocaleString("pt-BR")}</p></Card>
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Repasse a Receber (85%)</p><p className="text-lg font-bold">R$ {(detailMetrics.totalVendido * 0.85).toLocaleString("pt-BR")}</p></Card>
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Cupons Gerados</p><p className="text-lg font-bold text-primary">{detailMetrics.cupons}</p></Card>
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Consumidores</p><p className="text-lg font-bold">{detailMetrics.consumidores}</p></Card>
                  <Card className="border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="text-lg font-bold">R$ {detailMetrics.pedidos > 0 ? (detailMetrics.totalVendido / detailMetrics.pedidos).toFixed(2) : "0"}</p></Card>
                </div>
                {detailMetrics.chartData.length > 0 && (
                  <div>
                    <h3 className="font-heading font-bold text-sm mb-2">Pedidos por Mês</h3>
                    <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[200px] w-full">
                      <BarChart data={detailMetrics.chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar animationDuration={3000} animationEasing="linear" dataKey="pedidos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]}/>
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}

                {/* Consumidores com cupons */}
                {detailMetrics.cuponsPerConsumer.length > 0 && (
                  <div>
                    <h3 className="font-heading font-bold text-sm mb-2">Consumidores e Cupons</h3>
                    <div className="rounded-lg border bg-card overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome / Telefone</TableHead>
                            <TableHead className="text-center">Cupons</TableHead>
                            <TableHead>Cadastro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailMetrics.cuponsPerConsumer.map(c => (
                            <TableRow key={c.consumidorId}>
                              <TableCell className="text-sm">{c.nome}</TableCell>
                              <TableCell className="text-center font-bold text-primary">{c.cupons}</TableCell>
                              <TableCell>
                                <Badge variant={c.cadastroCompleto ? "default" : "secondary"} className="text-xs">
                                  {c.cadastroCompleto ? "Completo" : "Pendente"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Metrics Modal */}
      <PizzariaMetricsModal
        open={metricsModal.open}
        onClose={() => setMetricsModal({ open: false, id: "", nome: "" })}
        pizzariaId={metricsModal.id}
        pizzariaNome={metricsModal.nome}
      />

    </div>
  );
}
