import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
  defaultUrl: string;
}

export function SettingsModal({ isOpen, onClose, currentUrl, onSave, defaultUrl }: SettingsModalProps) {
  const [url, setUrl] = useState(currentUrl);

  const handleSave = () => {
    if (url.trim()) {
      onSave(url.trim());
    }
  };

  const handleReset = () => {
    setUrl(defaultUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure the calendar URL to source car meets from.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="calendar-url" className="text-foreground">Calendar URL</Label>
            <Input
              id="calendar-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/..."
              className="bg-background border-border font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Paste an iCal (.ics) link or a Google Calendar public URL.
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={handleReset} className="sm:mr-auto">
            Reset to Default
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
