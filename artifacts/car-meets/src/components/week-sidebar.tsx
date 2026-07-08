import { CalendarEvent } from "@workspace/api-client-react";
import { format, isToday, isTomorrow } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { MeetCard } from "./meet-card";
import { Skeleton } from "./ui/skeleton";

export interface DayGroup {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  events: CalendarEvent[];
  isLoading: boolean;
  isError: boolean;
}

interface WeekSidebarProps {
  dayGroups: DayGroup[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return `Today — ${format(date, "EEE, MMM d")}`;
  if (isTomorrow(date)) return `Tomorrow — ${format(date, "EEE, MMM d")}`;
  return format(date, "EEEE, MMMM d");
}

export function WeekSidebar({ dayGroups, selectedEventId, onSelectEvent }: WeekSidebarProps) {
  const hasAnyEvents = dayGroups.some((g) => g.events.length > 0);
  const allLoaded = dayGroups.every((g) => !g.isLoading);

  return (
    <div className="space-y-6">
      {dayGroups.map((group) => {
        const label = dayLabel(group.date);

        return (
          <div key={group.dateStr}>
            {/* Day heading */}
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap px-1">
                {label}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {group.isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="p-4 rounded-md border border-border bg-card">
                    <Skeleton className="h-4 w-2/3 mb-2 bg-muted" />
                    <Skeleton className="h-3 w-1/3 bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {!group.isLoading && group.isError && (
              <p className="text-sm text-destructive px-1">Failed to load events for this day.</p>
            )}

            {!group.isLoading && !group.isError && group.events.length === 0 && (
              <p className="text-sm text-muted-foreground italic px-1">No meets this day.</p>
            )}

            {!group.isLoading &&
              !group.isError &&
              group.events.map((event) => (
                <div key={event.id} className="mb-3">
                  <MeetCard
                    event={event}
                    isSelected={selectedEventId === event.id}
                    onClick={() => onSelectEvent(event.id)}
                  />
                </div>
              ))}
          </div>
        );
      })}

      {allLoaded && !hasAnyEvents && (
        <div className="text-center p-8 text-muted-foreground">
          <div className="bg-secondary w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="h-6 w-6 opacity-50" />
          </div>
          <p>No meets scheduled this week.</p>
        </div>
      )}
    </div>
  );
}
