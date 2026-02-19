import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedHandle } from "@/stores/outreachStore";

interface HandlesPastePanelProps {
  handleInput: string;
  resolvedHandles: ResolvedHandle[];
  isResolving: boolean;
  onInputChange: (input: string) => void;
  onResolve: () => void;
  onRemove: (username: string) => void;
  onClear: () => void;
}

function StatusIcon({ status }: { status: ResolvedHandle["status"] }) {
  if (status === "resolved") {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function statusLabel(status: ResolvedHandle["status"]): string {
  switch (status) {
    case "resolved":
      return "Resolved";
    case "not_found":
      return "Not found";
    case "is_group":
      return "Group";
    case "is_channel":
      return "Channel";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function HandlesPastePanel({
  handleInput,
  resolvedHandles,
  isResolving,
  onInputChange,
  onResolve,
  onRemove,
  onClear,
}: HandlesPastePanelProps) {
  const resolvedCount = resolvedHandles.filter(
    (h) => h.status === "resolved"
  ).length;
  const failedCount = resolvedHandles.filter(
    (h) => h.status !== "resolved"
  ).length;
  const hasResults = resolvedHandles.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Input area */}
      <div className="p-3 border-b space-y-2">
        <Textarea
          placeholder={"Paste usernames, one per line or comma-separated\ne.g. @username1, @username2"}
          value={handleInput}
          onChange={(e) => onInputChange(e.target.value)}
          className="min-h-[100px] text-sm resize-none"
          disabled={isResolving}
        />
        <Button
          onClick={onResolve}
          disabled={isResolving || !handleInput.trim()}
          className="w-full"
          size="sm"
        >
          {isResolving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Resolving...
            </>
          ) : (
            "Resolve Usernames"
          )}
        </Button>
      </div>

      {/* Results summary + clear */}
      {hasResults && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium">
            {resolvedCount} resolved
            {failedCount > 0 && (
              <span className="text-muted-foreground">
                , {failedCount} failed
              </span>
            )}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Resolved handles list */}
      <div className="flex-1 overflow-y-auto">
        {resolvedHandles.map((handle) => (
          <div
            key={handle.username}
            className={cn(
              "flex items-center gap-2 px-3 py-2 border-b",
              handle.status === "resolved" && "bg-primary/5",
              handle.status !== "resolved" && "opacity-60"
            )}
          >
            <StatusIcon status={handle.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                @{handle.username}
              </div>
              {handle.status === "resolved" && handle.firstName && (
                <div className="text-xs text-muted-foreground truncate">
                  {handle.firstName} {handle.lastName}
                </div>
              )}
              {handle.status !== "resolved" && (
                <div className="text-xs text-muted-foreground truncate">
                  {statusLabel(handle.status)}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onRemove(handle.username)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {!hasResults && !isResolving && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Paste usernames above and click Resolve
          </div>
        )}
      </div>
    </div>
  );
}
