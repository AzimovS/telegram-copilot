import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/contacts";

interface ContactDetailPanelProps {
  contact: Contact;
  allTags: string[];
  onAddTag: (userId: number, tag: string) => Promise<void>;
  onRemoveTag: (userId: number, tag: string) => Promise<void>;
  onOpenChat: (chatId: number) => void;
}

const formatDate = (daysSince: number | undefined): string => {
  if (daysSince === undefined || daysSince === null) return "Never";
  if (daysSince === 0) return "Today";
  return `${daysSince}d ago`;
};

export function ContactDetailPanel({
  contact,
  allTags,
  onAddTag,
  onRemoveTag,
  onOpenChat,
}: ContactDetailPanelProps) {
  const [detailTagToAdd, setDetailTagToAdd] = useState<string>("");

  const availableTagsForDetail = allTags.filter(
    (t) => !contact.tags.includes(t)
  );

  const handleAddTag = async () => {
    if (detailTagToAdd) {
      await onAddTag(contact.userId, detailTagToAdd);
      setDetailTagToAdd("");
    }
  };

  const isNeverContacted =
    contact.daysSinceContact === undefined || contact.daysSinceContact === null;

  return (
    <div className="w-[350px] flex flex-col overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">
          {contact.firstName} {contact.lastName}
        </h3>
        {contact.username && (
          <p className="text-sm text-muted-foreground">@{contact.username}</p>
        )}
      </div>

      {/* Tags Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tags</span>
        </div>

        {/* Current Tags */}
        <div className="flex flex-wrap gap-1">
          {contact.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
            >
              {tag}
              <button
                onClick={() => onRemoveTag(contact.userId, tag)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {contact.tags.length === 0 && (
            <span className="text-xs text-muted-foreground">No tags</span>
          )}
        </div>

        {/* Add Tag */}
        <div className="flex items-center gap-2">
          <Select value={detailTagToAdd} onValueChange={setDetailTagToAdd}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent>
              {availableTagsForDetail.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {detailTagToAdd && (
            <Button size="sm" onClick={handleAddTag}>
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Stats</span>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Last contact:{" "}
            <span
              className={cn("font-medium", isNeverContacted && "text-red-500")}
            >
              {formatDate(contact.daysSinceContact)}
            </span>
          </p>
          {contact.unreadCount !== undefined && contact.unreadCount > 0 && (
            <p>{contact.unreadCount} unread messages</p>
          )}
        </div>
      </div>

      {/* Open Chat Button */}
      <Button className="w-full" onClick={() => onOpenChat(contact.userId)}>
        <MessageSquare className="h-4 w-4 mr-2" />
        Open Chat
      </Button>
    </div>
  );
}
