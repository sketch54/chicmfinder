import { CalendarEvent } from "@workspace/api-client-react";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { format, parseISO } from "date-fns";
import { useGeocodeLocation } from "@/hooks/use-geocode";

const createCustomIcon = (isSelected: boolean) => {
  const color = isSelected ? "#e83855" : "#f5f5f5";
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

const createProximityIcon = () => {
  const size = 40;
  return L.divIcon({
    className: "proximity-pin",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    ">
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #22d3ee;
        border: 3px solid #000;
        box-shadow: 0 0 16px rgba(34,211,238,0.7);
      "><div style="width: 6px; height: 6px; background: #000; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div></div>
      <div style="
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        background: #22d3ee;
        color: #000;
        font-size: 9px;
        font-weight: 800;
        padding: 1px 4px;
        border-radius: 3px;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        font-family: monospace;
      ">SORT</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

interface MapViewProps {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  proximityPin: { lat: number; lng: number } | null;
  onProximityPinMove: (lat: number, lng: number) => void;
}

// Chicago State & Madison origin point
const CHICAGO_ORIGIN: [number, number] = [41.8819, -87.6278];

// 150-mile bounding box around the origin
// ~150mi / 69 mi per degree lat ≈ 2.17°
// ~150mi / (69 * cos(41.88°)) ≈ 2.92° lng
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [41.8819 - 2.17, -87.6278 - 2.92], // SW corner
  [41.8819 + 2.17, -87.6278 + 2.92], // NE corner
];

// Forces Leaflet to recalculate tile coverage after the container finishes rendering.
// Without this, mobile browsers often only load tiles for the top ~50% of the map.
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Small delay lets the browser finish painting before we measure
    const timer = setTimeout(() => map.invalidateSize(), 100);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

export function MapView({
  events,
  selectedEventId,
  onSelectEvent,
  proximityPin,
  onProximityPinMove,
}: MapViewProps) {
  const defaultZoom = 9;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={CHICAGO_ORIGIN}
        zoom={defaultZoom}
        minZoom={7}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1.0}
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
        <MapResizer />
        {proximityPin && (
          <ProximityMarker
            lat={proximityPin.lat}
            lng={proximityPin.lng}
            onMove={onProximityPinMove}
          />
        )}
      </MapContainer>
    </div>
  );
}

function ProximityMarker({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  return (
    <Marker
      position={[lat, lng]}
      icon={createProximityIcon()}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const { lat: newLat, lng: newLng } = (e.target as L.Marker).getLatLng();
          onMove(newLat, newLng);
        },
      }}
    >
      <Popup>
        <div style={{ fontFamily: "sans-serif", fontSize: 12 }}>
          <strong>Proximity sort pin</strong>
          <br />
          <span style={{ color: "#888", fontSize: 11 }}>Drag to re-sort by distance</span>
        </div>
      </Popup>
    </Marker>
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
          <span style={{ color: "#e83855", fontFamily: "monospace", fontSize: 11, display: "block", marginBottom: 6 }}>
            {startTime}
          </span>
          <span style={{ color: "#888", fontSize: 11 }}>{event.location}</span>
        </div>
      </Popup>
    </Marker>
  );
}
