import { useState } from "react";
import { useGetCalendarEvents } from "@workspace/api-client-react";
import { format } from "date-fns";
import { MapView } from "@/components/map-view";
import { MeetCard } from "@/components/meet-card";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Settings, MapPin } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_CALENDAR_URL = "https://calendar.google.com/calendar/ical/e7abbfecee4eefbd2ebb1440e132c42e438dc77848e702faa8be9be461691b47%40group.calendar.google.com/public/basic.ics";

export function Home() {
  const [date, setDate] = useState<Date>(new Date());
  const [calendarUrl, setCalendarUrl] = useState<string>(() => {
    return localStorage.getItem("carMeetsCalendarUrl") || DEFAULT_CALENDAR_URL;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const dateString = format(date, "yyyy-MM-dd");

  const { data: events, isLoading, error } = useGetCalendarEvents(
    { url: calendarUrl, date: dateString },
    { query: { enabled: !!calendarUrl } }
  );

  const handleSaveUrl = (url: string) => {
    setCalendarUrl(url);
    localStorage.setItem("carMeetsCalendarUrl", url);
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-background text-foreground dark">
      {/* Sidebar / List View */}
      <div className="w-full md:w-96 flex-shrink-0 flex flex-col border-r border-border bg-card z-10">
        <div className="p-4 border-b border-border flex flex-col gap-4 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-6 w-6" />
              <h1 className="text-xl font-bold tracking-tight uppercase">Car Meets</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-card border-border hover:bg-secondary hover:text-secondary-foreground"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
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
              <p className="text-sm text-muted-foreground mb-4">Please check the calendar URL in settings.</p>
              <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
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

          {!isLoading && !error && events?.map((event) => (
            <MeetCard
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onClick={() => setSelectedEventId(event.id)}
            />
          ))}
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 relative h-[50vh] md:h-auto bg-muted">
        <MapView 
          events={events || []} 
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
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
