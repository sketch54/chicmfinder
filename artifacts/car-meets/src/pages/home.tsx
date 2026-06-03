import { useState, useEffect } from "react";
import { useGetCalendarEvents } from "@workspace/api-client-react";
import { format } from "date-fns";
import { MapView } from "@/components/map-view";
import { MeetCard } from "@/components/meet-card";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Settings, MapPin, List, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/e7abbfecee4eefbd2ebb1440e132c42e438dc77848e702faa8be9be461691b47%40group.calendar.google.com/public/basic.ics";

export function Home() {
  const [date, setDate] = useState<Date>(new Date());
  const [calendarUrl, setCalendarUrl] = useState<string>(
    () => localStorage.getItem("carMeetsCalendarUrl") || DEFAULT_CALENDAR_URL,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dateString = format(date, "yyyy-MM-dd");

  const { data: events, isLoading, error } = useGetCalendarEvents(
    { url: calendarUrl, date: dateString },
    { query: { enabled: !!calendarUrl } },
  );

  // Close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleSaveUrl = (url: string) => {
    setCalendarUrl(url);
    localStorage.setItem("carMeetsCalendarUrl", url);
    setIsSettingsOpen(false);
  };

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setSidebarOpen(false); // close drawer on mobile after selecting
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground dark">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          // Base styles
          "flex flex-col bg-card border-r border-border",
          // Mobile: fixed drawer that slides in from the left
          "fixed inset-y-0 left-0 z-30 w-[85vw] max-w-sm transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, normal flow, always visible
          "md:relative md:translate-x-0 md:w-96 md:flex-shrink-0 md:z-10 md:transition-none",
        ].join(" ")}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex flex-col gap-4 bg-background flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-6 w-6" />
              <h1 className="text-xl font-bold tracking-tight uppercase">Car Meets</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="h-5 w-5 text-muted-foreground" />
              </Button>
              {/* Close button — mobile only */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
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

          {error && (
            <div className="text-center p-6 border border-destructive/50 rounded-md bg-destructive/10">
              <p className="text-destructive font-medium mb-2">Failed to load events</p>
              <p className="text-sm text-muted-foreground mb-4">
                Please check the calendar URL in settings.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsSettingsOpen(true)}
                className="border-destructive text-destructive"
              >
                Open Settings
              </Button>
            </div>
          )}

          {!isLoading && !error && events?.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              <div className="bg-secondary w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <CalendarIcon className="h-6 w-6 opacity-50" />
              </div>
              <p>No meets scheduled for this day.</p>
            </div>
          )}

          {!isLoading &&
            !error &&
            events?.map((event) => (
              <MeetCard
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
                onClick={() => handleSelectEvent(event.id)}
              />
            ))}
        </div>
      </aside>

      {/* ── Map (always full height, takes remaining width on desktop) ── */}
      <div className="relative flex-1 h-full">
        <MapView
          events={events || []}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />

        {/* Floating toggle button — mobile only */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={[
            "md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-20",
            "flex items-center gap-2 px-5 py-3 rounded-full",
            "bg-primary text-primary-foreground font-semibold text-sm shadow-lg",
            "active:scale-95 transition-transform",
          ].join(" ")}
        >
          <List className="h-4 w-4" />
          {events && events.length > 0 ? `${events.length} meets` : "View meets"}
        </button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUrl={calendarUrl}
        onSave={handleSaveUrl}
        defaultUrl={DEFAULT_CALENDAR_URL}
      />
    </div>
  );
}
