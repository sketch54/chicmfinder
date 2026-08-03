import { useState, useEffect, useMemo } from "react";
import { useGetCalendarEvents, getGeocodeAddressQueryKey, type CalendarEvent, type GeoLocation } from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapView } from "@/components/map-view";
import { MeetCard } from "@/components/meet-card";
import { EventDetailModal } from "@/components/event-detail-modal";
import { InfoModal } from "@/components/info-modal";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  MapPin,
  List,
  X,
  Info,
  LocateFixed,
  LocateOff,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/e7abbfecee4eefbd2ebb1440e132c42e438dc77848e702faa8be9be461691b47%40group.calendar.google.com/public/basic.ics";

// Chicago 0,0 address origin — intersection of State St & Madison St
const DEFAULT_PIN_LAT = 41.8819;
const DEFAULT_PIN_LNG = -87.6278;

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3959; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function Home() {
  const [date, setDate] = useState<Date>(new Date());
  const calendarUrl = DEFAULT_CALENDAR_URL;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  // Start open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 768,
  );
  const [proximityPin, setProximityPin] = useState<{ lat: number; lng: number } | null>(null);

  const dateString = format(date, "yyyy-MM-dd");

  const {
    data: todayEvents,
    isLoading: todayLoading,
    error: todayError,
  } = useGetCalendarEvents(
    { url: calendarUrl, date: dateString },
    { query: { enabled: !!calendarUrl } },
  );

  // Geocode all events for proximity sorting (shares cache with MeetCard)
  const geoQueries = useQueries({
    queries: (todayEvents ?? []).map((event) => ({
      queryKey: getGeocodeAddressQueryKey({ address: event.location ?? "" }),
      queryFn: () =>
        fetch(`/api/geocode?address=${encodeURIComponent(event.location ?? "")}`)
          .then((r) => {
            if (!r.ok) throw new Error("Geocode failed");
            return r.json() as Promise<GeoLocation>;
          }),
      enabled: !!event.location,
      staleTime: Infinity,
    })),
  });

  // Sort events by proximity when pin is active
  const displayEvents = useMemo(() => {
    const events = todayEvents ?? [];
    if (!proximityPin) return events;

    const withDist = events.map((event, i) => {
      const geo = geoQueries[i]?.data as GeoLocation | undefined;
      const dist = geo
        ? haversineDistance(proximityPin.lat, proximityPin.lng, geo.lat, geo.lng)
        : Infinity;
      return { event, dist };
    });
    return withDist.sort((a, b) => a.dist - b.dist).map((x) => x.event);
  }, [todayEvents, geoQueries, proximityPin]);

  const totalCount = todayEvents?.length ?? 0;

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
  };

  const handleCardClick = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
    setDetailEvent(event);
  };

  const toggleProximityPin = () => {
    setProximityPin((prev) =>
      prev ? null : { lat: DEFAULT_PIN_LAT, lng: DEFAULT_PIN_LNG },
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground dark">
      {/* Backdrop — all screen sizes */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={[
          "flex flex-col bg-card border-r border-border",
          "fixed inset-y-0 left-0 z-30 w-[85vw] max-w-sm transition-transform duration-300 ease-in-out",
          "md:w-96",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex flex-col gap-3 bg-background flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-6 w-6" />
              <h1 className="text-xl font-bold tracking-tight uppercase">chicarmeet.us</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="About"
                onClick={() => setIsInfoOpen(true)}
              >
                <Info className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-card border-border hover:bg-secondary"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-border bg-popover" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="bg-popover text-popover-foreground"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {todayLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-md border border-border bg-card">
                    <Skeleton className="h-5 w-2/3 mb-2 bg-muted" />
                    <Skeleton className="h-4 w-1/3 mb-4 bg-muted" />
                    <Skeleton className="h-4 w-full bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {todayError && (
              <div className="text-center p-6 border border-destructive/50 rounded-md bg-destructive/10">
                <p className="text-destructive font-medium mb-2">Failed to load events</p>
                <p className="text-sm text-muted-foreground">
                  Unable to fetch the calendar. Please try again later.
                </p>
              </div>
            )}

            {!todayLoading && !todayError && displayEvents.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">
                <div className="bg-secondary w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon className="h-6 w-6 opacity-50" />
                </div>
                <p>No meets scheduled for this day.</p>
              </div>
            )}

            {!todayLoading &&
              !todayError &&
              displayEvents.map((event) => (
                <MeetCard
                  key={event.id}
                  event={event}
                  isSelected={selectedEventId === event.id}
                  onClick={() => handleCardClick(event)}
                />
              ))}
          </div>
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 h-full w-full">
        <MapView
          events={todayEvents ?? []}
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelectEvent}
          proximityPin={proximityPin}
          onProximityPinMove={(lat, lng) => setProximityPin({ lat, lng })}
        />

        {/* Toggle sidebar button — all screen sizes */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className={[
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-20",
            "flex items-center gap-2 px-5 py-3 rounded-full",
            "bg-primary text-primary-foreground font-semibold text-sm shadow-lg",
            "active:scale-95 transition-transform",
          ].join(" ")}
        >
          <List className="h-4 w-4" />
          {totalCount > 0 ? `${totalCount} meets today` : "View meets"}
        </button>

        {/* Proximity sort pin button — bottom right */}
        <button
          onClick={toggleProximityPin}
          title={proximityPin ? "Remove proximity sort" : "Sort by proximity"}
          className={[
            "fixed bottom-6 right-6 z-20",
            "flex items-center gap-2 px-4 py-3 rounded-full",
            "font-semibold text-sm shadow-lg active:scale-95 transition-all",
            proximityPin
              ? "bg-cyan-400 text-black ring-2 ring-cyan-300"
              : "bg-card text-foreground border border-border",
          ].join(" ")}
        >
          {proximityPin ? (
            <>
              <LocateOff className="h-4 w-4" />
              <span className="hidden sm:inline">Clear Sort</span>
            </>
          ) : (
            <>
              <LocateFixed className="h-4 w-4" />
              <span className="hidden sm:inline">Sort Nearby</span>
            </>
          )}
        </button>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
}
