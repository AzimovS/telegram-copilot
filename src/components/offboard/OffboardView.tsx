import { useState, useMemo } from "react";
import { useContacts } from "@/hooks/useContacts";
import { SearchInput } from "@/components/common/SearchInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UserMinus,
  Users,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Package,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OffboardViewProps {
  onOpenChat: (chatId: number) => void;
}

interface CommonGroup {
  id: number;
  title: string;
  canRemove: boolean;
  memberCount?: number;
}

// Mock data for demo - in production this would come from backend
const mockGroups: Record<number, CommonGroup[]> = {};

export function OffboardView({ onOpenChat: _onOpenChat }: OffboardViewProps) {
  const { contacts, isLoading: isLoadingContacts } = useContacts();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [groups, setGroups] = useState<CommonGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupCount, setLookupCount] = useState(5);
  const [cachedUsers, setCachedUsers] = useState<Set<number>>(new Set());

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.firstName.toLowerCase().includes(query) ||
        c.lastName?.toLowerCase().includes(query) ||
        c.username?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const selectedContact = useMemo(() => {
    if (!selectedUserId) return null;
    return contacts.find((c) => c.userId === selectedUserId);
  }, [contacts, selectedUserId]);

  const handleSelectUser = async (userId: number) => {
    setSelectedUserId(userId);
    setError(null);

    // Check if cached
    if (cachedUsers.has(userId)) {
      setGroups(mockGroups[userId] || []);
      return;
    }

    // Check rate limit
    if (lookupCount <= 0) {
      setError("Daily lookup limit reached. Try again tomorrow.");
      return;
    }

    setIsLoadingGroups(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock data - in production this would call the backend
      const mockGroupsForUser: CommonGroup[] = [
        { id: 1, title: "Team Chat", canRemove: true, memberCount: 15 },
        { id: 2, title: "Project Alpha", canRemove: true, memberCount: 8 },
        { id: 3, title: "Company Announcements", canRemove: false, memberCount: 150 },
        { id: 4, title: "Dev Team", canRemove: true, memberCount: 12 },
      ];

      mockGroups[userId] = mockGroupsForUser;
      setGroups(mockGroupsForUser);
      setCachedUsers((prev) => new Set([...prev, userId]));
      setLookupCount((prev) => prev - 1);
    } catch (err) {
      setError("Failed to lookup groups. Please try again.");
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleRemoveFromGroup = async (groupId: number) => {
    setRemovingGroupId(groupId);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Remove from local state
      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      // Update mock data
      if (selectedUserId && mockGroups[selectedUserId]) {
        mockGroups[selectedUserId] = mockGroups[selectedUserId].filter(
          (g) => g.id !== groupId
        );
      }
    } catch (err) {
      setError("Failed to remove user from group.");
    } finally {
      setRemovingGroupId(null);
    }
  };

  const handleRefreshGroups = async () => {
    if (!selectedUserId || lookupCount <= 0) return;

    setIsLoadingGroups(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // In production, this would force a fresh API call
      setLookupCount((prev) => prev - 1);
    } catch (err) {
      setError("Failed to refresh groups.");
    } finally {
      setIsLoadingGroups(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <UserMinus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Offboarding</h1>
          <p className="text-sm text-muted-foreground">
            Remove users from shared groups
          </p>
        </div>
      </div>

      {/* Rate Limit Info */}
      <Alert className={cn(lookupCount > 0 ? "border-green-500/20" : "border-red-500/20")}>
        <AlertCircle className={cn("h-4 w-4", lookupCount > 0 ? "text-green-500" : "text-red-500")} />
        <AlertDescription>
          <span className={lookupCount > 0 ? "text-green-600" : "text-red-600"}>
            {lookupCount} lookups remaining today
          </span>
          {cachedUsers.size > 0 && (
            <span className="text-muted-foreground ml-2">
              • {cachedUsers.size} cached
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-6">
        {/* Contacts Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search contacts..."
            />

            <div className="h-[400px] overflow-y-auto space-y-1">
              {isLoadingContacts ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.userId}
                    onClick={() => handleSelectUser(contact.userId)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3",
                      selectedUserId === contact.userId
                        ? "bg-primary/10 border-l-4 border-l-primary"
                        : "hover:bg-muted",
                      cachedUsers.has(contact.userId) && "opacity-70"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                      {contact.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.username && (
                        <p className="text-xs text-muted-foreground">
                          @{contact.username}
                        </p>
                      )}
                    </div>
                    {cachedUsers.has(contact.userId) && (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Groups Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {selectedContact
                  ? `${selectedContact.firstName}'s Groups`
                  : "Common Groups"}
              </CardTitle>
              {selectedUserId && cachedUsers.has(selectedUserId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshGroups}
                  disabled={isLoadingGroups || lookupCount <= 0}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="h-[400px] overflow-y-auto">
              {!selectedUserId ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Search className="h-8 w-8 mb-2" />
                  <p>Select a person to see common groups</p>
                </div>
              ) : isLoadingGroups ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-muted-foreground">Finding groups...</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="h-8 w-8 mb-2" />
                  <p>No common groups found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={cn(
                        "p-3 rounded-lg border flex items-center justify-between",
                        group.canRemove
                          ? "border-l-4 border-l-green-500"
                          : "border-l-4 border-l-gray-300"
                      )}
                    >
                      <div>
                        <p className="font-medium">{group.title}</p>
                        {group.memberCount && (
                          <p className="text-xs text-muted-foreground">
                            {group.memberCount} members
                          </p>
                        )}
                      </div>
                      {group.canRemove ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveFromGroup(group.id)}
                          disabled={removingGroupId === group.id}
                        >
                          {removingGroupId === group.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Ban className="h-3 w-3 mr-1" />
                              Remove
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Need admin
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
