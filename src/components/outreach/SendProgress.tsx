import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, Pause, Square } from "lucide-react";
import type { OutreachQueue } from "@/stores/outreachStore";

interface SendProgressProps {
  queue: OutreachQueue;
  onRefresh: () => void;
  onCancel: () => void;
}

export function SendProgress({ queue, onRefresh, onCancel }: SendProgressProps) {
  // Auto-refresh while running
  useEffect(() => {
    if (queue.status === "running") {
      const interval = setInterval(onRefresh, 2000);
      return () => clearInterval(interval);
    }
  }, [queue.status, onRefresh]);

  const totalCount = queue.recipients.length;
  const progress = ((queue.sentCount + queue.failedCount) / totalCount) * 100;

  const getStatusColor = () => {
    switch (queue.status) {
      case "running":
        return "text-primary";
      case "completed":
        return "text-green-500";
      case "cancelled":
        return "text-yellow-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = () => {
    switch (queue.status) {
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "completed":
        return <Check className="h-5 w-5" />;
      case "cancelled":
        return <Square className="h-5 w-5" />;
      case "paused":
        return <Pause className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2", getStatusColor())}>
          {getStatusIcon()}
          <span className="font-medium capitalize">{queue.status}</span>
        </div>
        {queue.status === "running" && (
          <Button variant="destructive" size="sm" onClick={onCancel}>
            <Square className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {queue.sentCount + queue.failedCount} / {totalCount}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-2xl font-bold text-green-500">{queue.sentCount}</p>
          <p className="text-xs text-muted-foreground">Sent</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-2xl font-bold text-red-500">{queue.failedCount}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-2xl font-bold">
            {totalCount - queue.sentCount - queue.failedCount}
          </p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
      </div>

      {/* Recipient List */}
      <div className="max-h-[200px] overflow-y-auto border rounded-md">
        {queue.recipients.map((recipient) => (
          <div
            key={recipient.userId}
            className="flex items-center justify-between p-2 border-b last:border-b-0"
          >
            <span className="text-sm">User #{recipient.userId}</span>
            <span
              className={cn(
                "text-xs capitalize",
                recipient.status === "sent" && "text-green-500",
                recipient.status === "failed" && "text-red-500",
                recipient.status === "sending" && "text-primary",
                recipient.status === "pending" && "text-muted-foreground"
              )}
            >
              {recipient.status === "sending" && (
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
              )}
              {recipient.status === "sent" && (
                <Check className="h-3 w-3 inline mr-1" />
              )}
              {recipient.status === "failed" && (
                <X className="h-3 w-3 inline mr-1" />
              )}
              {recipient.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
