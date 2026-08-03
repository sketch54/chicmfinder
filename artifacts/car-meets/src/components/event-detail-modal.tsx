import { CalendarEvent } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { MapPin, Clock, CalendarIcon, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  if (!event) return null;

  const startTime = format(parseISO(event.start), "h:mm a");
  const endTime = format(parseISO(event.end), "h:mm a");
  const dateLabel = format(parseISO(event.start), "EEEE, MMMM d, yyyy");

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] border-border bg-card max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight pr-4">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Date */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{dateLabel}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-mono text-primary font-semibold">
              {startTime}
            </span>
            <span className="text-muted-foreground">–</span>
            <span className="font-mono text-primary font-semibold">
              {endTime}
            </span>
          </div>

          {/* Location */}
          {event.location ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          ) : (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-40" />
              <span className="italic">No location provided</span>
            </div>
          )}

          {/* Description */}
          {event.description ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4 mt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                <FileText className="h-3.5 w-3.5" />
                Description
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          ) : (
            <div className="border-t border-border pt-4 mt-1">
              <p className="text-sm text-muted-foreground italic">No description provided.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
