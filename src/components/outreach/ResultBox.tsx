import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutreachQueue } from "@/stores/outreachStore";

interface ResultBoxProps {
  queue: OutreachQueue;
  onRefresh: () => void;
  onCancel: () => void;
}

export function ResultBox({ queue, onRefresh, onCancel }: ResultBoxProps) {
  // Auto-refresh while running
  useEffect(() => {
    if (queue.status === "running") {
      const interval = setInterval(onRefresh, 2000);
      return () => clearInterval(interval);
    }
  }, [queue.status, onRefresh]);

  const totalCount = queue.recipients.length;
  const completedCount = queue.sentCount + queue.failedCount;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const isRunning = queue.status === "running";
  const isCompleted = queue.status === "completed";
  const isCancelled = queue.status === "cancelled";
  const hasFailures = queue.failedCount > 0;

  // Determine background color based on status
  const bgClass = cn(
    "rounded-lg p-4 space-y-3",
    isRunning && "bg-muted/50",
    isCompleted && !hasFailures && "bg-green-500/10",
    isCompleted && hasFailures && "bg-yellow-500/10",
    isCancelled && "bg-yellow-500/10"
  );

  return (
    <div className={bgClass}>
      {/* Running State */}
      {isRunning && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">Sending messages...</span>
            </div>
            <Button variant="destructive" size="sm" onClick={onCancel}>
              <Square className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {completedCount} / {totalCount} messages
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        </>
      )}

      {/* Completed State */}
      {isCompleted && (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full",
              hasFailures ? "bg-yellow-500/20" : "bg-green-500/20"
            )}
          >
            {hasFailures ? (
              <X className="h-5 w-5 text-yellow-600" />
            ) : (
              <Check className="h-5 w-5 text-green-600" />
            )}
          </div>
          <div>
            <p className="font-medium">
              {hasFailures ? "Completed with errors" : "All messages sent"}
            </p>
            <p className="text-sm text-muted-foreground">
              {queue.sentCount} sent
              {hasFailures && `, ${queue.failedCount} failed`}
            </p>
          </div>
        </div>
      )}

      {/* Cancelled State */}
      {isCancelled && (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-yellow-500/20">
            <Square className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="font-medium">Cancelled</p>
            <p className="text-sm text-muted-foreground">
              {queue.sentCount} sent, {totalCount - completedCount} skipped
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
