import { AlertCircle, Clock, Info } from "lucide-react";

interface StatsBarProps {
  urgentCount: number;
  needsReplyCount: number;
  fyiCount: number;
}

export function StatsBar({ urgentCount, needsReplyCount, fyiCount }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-red-500">{urgentCount}</p>
          <p className="text-xs text-muted-foreground">Urgent</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <Clock className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-yellow-500">{needsReplyCount}</p>
          <p className="text-xs text-muted-foreground">Needs Reply</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Info className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-500">{fyiCount}</p>
          <p className="text-xs text-muted-foreground">FYI</p>
        </div>
      </div>
    </div>
  );
}
