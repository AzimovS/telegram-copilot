import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Eye, Loader2 } from "lucide-react";
import { MessagePreview } from "./MessagePreview";
import { ResultBox } from "./ResultBox";
import type { Contact } from "@/types/contacts";
import type { OutreachQueue } from "@/stores/outreachStore";

interface ComposePanelProps {
  template: string;
  selectedContacts: Contact[];
  allContacts: Contact[];
  activeQueue: OutreachQueue | null;
  isLoading: boolean;
  error: string | null;
  onTemplateChange: (template: string) => void;
  onSend: () => Promise<void>;
  onCancel: () => Promise<void>;
  onRefreshStatus: () => void;
  previewMessage: (userId: number, contacts: Contact[]) => string;
}

export function ComposePanel({
  template,
  selectedContacts,
  allContacts,
  activeQueue,
  isLoading,
  error,
  onTemplateChange,
  onSend,
  onCancel,
  onRefreshStatus,
  previewMessage,
}: ComposePanelProps) {
  const [showPreview, setShowPreview] = useState(false);

  const canSend =
    template.trim().length > 0 &&
    selectedContacts.length > 0 &&
    !isLoading &&
    (!activeQueue || activeQueue.status === "completed" || activeQueue.status === "cancelled");

  const isRunning = activeQueue?.status === "running";
  const isFinished =
    activeQueue?.status === "completed" || activeQueue?.status === "cancelled";

  const handleSend = async () => {
    setShowPreview(false);
    await onSend();
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4">
      <div className="space-y-4 max-w-2xl">
        {/* Message Textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <textarea
            value={template}
            onChange={(e) => onTemplateChange(e.target.value)}
            placeholder="Write your message here...

Example:
Hi {name}! I wanted to reach out about..."
            className="w-full min-h-[120px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            rows={5}
            disabled={isRunning}
          />
          <p className="text-xs text-muted-foreground">
            Personalize with: {"{first_name}"}, {"{last_name}"}, or {"{full_name}"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            disabled={selectedContacts.length === 0 || !template.trim()}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button onClick={handleSend} disabled={!canSend || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isLoading ? "Sending..." : `Send (${selectedContacts.length})`}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview List */}
        {showPreview && !activeQueue && (
          <MessagePreview
            contacts={selectedContacts}
            previewMessage={(userId) => previewMessage(userId, allContacts)}
          />
        )}

        {/* Result Box */}
        {activeQueue && (
          <ResultBox
            queue={activeQueue}
            onRefresh={onRefreshStatus}
            onCancel={onCancel}
          />
        )}

        {/* Start New after completion */}
        {isFinished && (
          <p className="text-sm text-muted-foreground">
            Select new recipients and compose another message to continue.
          </p>
        )}
      </div>
    </div>
  );
}
