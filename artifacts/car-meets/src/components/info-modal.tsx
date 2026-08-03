import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || content !== null) return;
    fetch("/info.txt")
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [isOpen, content]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] border-border bg-card max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">About</DialogTitle>
        </DialogHeader>
        <div className="pt-1">
          {error && (
            <p className="text-sm text-destructive">Could not load info.txt.</p>
          )}
          {!error && content === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {content && (
            <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
