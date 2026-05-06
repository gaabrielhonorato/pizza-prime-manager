import { useState, useEffect } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import "leaflet/dist/leaflet.css";

const pedidosAtivos = [
  { id: "#1248", cliente: "Juliana Costa", endereco: "Av. Rebouças, 1200 - Pinheiros, São Paulo - SP", status: "Em andamento", lat: -23.5629, lng: -46.6786 },
  { id: "#1249", cliente: "Maria Silva", endereco: "Rua das Palmeiras, 320 - Centro, São Paulo - SP", status: "Pendente", lat: -23.5505, lng: -46.6333 },
  { id: "#1250", cliente: "Roberto Almeida", endereco: "Rua Haddock Lobo, 595 - Cerqueira César, São Paulo - SP", status: "Pendente", lat: -23.5592, lng: -46.6669 },
];

const statusColor: Record<string, string> = {
  "Em andamento": "bg-yellow-500/20 text-yellow-400",
  Pendente: "bg-muted text-muted-foreground",
};

function MapComponent({ lat, lng }: { lat: number; lng: number }) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
    ]).then(([rl, leaflet]) => {
      setMapContainer(() => rl.MapContainer);
      setTileLayer(() => rl.TileLayer);
      setMarker(() => rl.Marker);
      setPopup(() => rl.Popup);

      // Fix default icon
      delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      setL(leaflet.default);
    });
  }, []);

  if (!MapContainer || !TileLayer || !Marker) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Carregando mapa...</div>;
  }

  return (
    <MapContainer center={[lat, lng]} zoom={15} className="h-full w-full rounded-lg" key={`${lat}-${lng}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]}>
        {Popup && <Popup>Entrega aqui</Popup>}
      </Marker>
    </MapContainer>
  );
}

export default function EntregadorMapa() {
  const [selecionado, setSelecionado] = useState(pedidosAtivos[0]);
  const hasPedidos = pedidosAtivos.length > 0;

  const abrirGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${selecionado.lat},${selecionado.lng}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mapa</h1>
        <p className="text-muted-foreground text-sm">Visualize suas entregas no mapa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 200px)" }}>
        {/* Lista de pedidos */}
        <div className="space-y-2 overflow-auto">
          {hasPedidos ? (
            pedidosAtivos.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer border-border bg-card transition-colors hover:border-primary/50 ${selecionado.id === p.id ? "border-primary" : ""}`}
                onClick={() => setSelecionado(p)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-sm">{p.id}</span>
                    <Badge variant="secondary" className={statusColor[p.status]}>{p.status}</Badge>
                  </div>
                  <p className="font-medium text-sm">{p.cliente}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.endereco}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma entrega em andamento</p>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="lg:col-span-2 relative rounded-lg overflow-hidden border border-border">
          <MapComponent lat={selecionado.lat} lng={selecionado.lng} />

          {/* Card sobreposto no rodapé */}
          <div className="absolute bottom-4 left-4 right-4 z-[1000]">
            <Card className="border-border bg-card/95 backdrop-blur-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{selecionado.cliente}</p>
                  <p className="text-xs text-muted-foreground">{selecionado.endereco}</p>
                </div>
                <Button size="sm" variant="outline" onClick={abrirGoogleMaps}>
                  <ExternalLink className="mr-1 h-3 w-3" /> Abrir no Google Maps
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
