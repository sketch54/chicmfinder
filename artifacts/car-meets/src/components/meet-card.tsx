import { CalendarEvent } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeocode } from "@/hooks/use-geocode";

interface MeetCardProps {
  event: CalendarEvent;
  isSelected: boolean;
  onClick: () => void;
}

export function MeetCard({ event, isSelected, onClick }: MeetCardProps) {
  const { isLoading: isGeoLoading } = useGeocode(event.location);

  const startTime = format(parseISO(event.start), "h:mm a");
  const endTime = format(parseISO(event.end), "h:mm a");

  return (
    <div
      data-testid={`card-event-${event.id}`}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border p-4 transition-all duration-200",
        "hover:border-primary/50 hover:bg-secondary/50",
        isSelected
          ? "border-primary bg-secondary shadow-[0_0_15px_rgba(255,140,0,0.1)]"
          : "border-border bg-card",
      )}
    >
      <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{event.title}</h3>
      <div className="flex items-center text-primary text-sm font-mono mb-3">
        <span>{startTime}</span>
        <span className="mx-2 text-muted-foreground">-</span>
        <span>{endTime}</span>
      </div>

      {event.location ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-70" />
          <span className="line-clamp-2">
            {isGeoLoading ? "Locating..." : event.location}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No location provided</p>
      )}

      {event.description && (
        <p className="mt-3 text-sm text-foreground/80 line-clamp-2 bg-background/50 p-2 rounded border border-border/50">
          {event.description}
        </p>
      )}
    </div>
  );
}
