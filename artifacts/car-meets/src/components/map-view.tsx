import { CalendarEvent } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { format, parseISO } from "date-fns";
import { useGeocodeLocation } from "@/hooks/use-geocode";

const createCustomIcon = (isSelected: boolean) => {
  const color = isSelected ? "#ff8c00" : "#f5f5f5";
  const size = isSelected ? 36 : 28;
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #000;
      box-shadow: 0 0 12px ${isSelected ? color : "rgba(0,0,0,0.5)"};
    "><div style="width: 8px; height: 8px; background: #000; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

interface MapViewProps {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export function MapView({ events, selectedEventId, onSelectEvent }: MapViewProps) {
  const defaultCenter: [number, number] = [41.85, -88.0];
  const defaultZoom = 9;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {events.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            isSelected={selectedEventId === event.id}
            onClick={() => onSelectEvent(event.id)}
          />
        ))}
      </MapContainer>
    </div>
  );
}

function EventMarker({
  event,
  isSelected,
  onClick,
}: {
  event: CalendarEvent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { data: geo } = useGeocodeLocation(event.location);

  if (!geo) return null;

  const startTime = format(parseISO(event.start), "h:mm a");

  return (
    <Marker
      position={[geo.lat, geo.lng]}
      icon={createCustomIcon(isSelected)}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div style={{ fontFamily: "sans-serif", fontSize: 13, minWidth: 200 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>{event.title}</strong>
          <span style={{ color: "#ff8c00", fontFamily: "monospace", fontSize: 11, display: "block", marginBottom: 6 }}>
            {startTime}
          </span>
          <span style={{ color: "#888", fontSize: 11 }}>{event.location}</span>
        </div>
      </Popup>
    </Marker>
  );
}
