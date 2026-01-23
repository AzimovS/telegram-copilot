import { useState } from "react";
import { useScopeStore } from "@/stores/scopeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderPicker } from "./FolderPicker";
import { ChatTypePicker } from "./ChatTypePicker";
import { Modal } from "@/components/common/Modal";
import { Save, FolderOpen, Trash2 } from "lucide-react";

export function ScopeSelector() {
  const {
    folders,
    profiles,
    activeScope,
    selectProfile,
    saveProfile,
    deleteProfile,
    getCurrentConfig,
  } = useScopeStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  const currentConfig = getCurrentConfig();

  const handleSaveProfile = async () => {
    if (newProfileName.trim()) {
      await saveProfile(newProfileName.trim());
      setNewProfileName("");
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Saved Profiles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Saved Scopes</CardTitle>
          <CardDescription>
            Quick-select a saved scope configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved scopes yet
              </p>
            ) : (
              profiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-1">
                  <Button
                    variant={
                      activeScope.profile?.id === profile.id
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => selectProfile(profile)}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    {profile.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => deleteProfile(profile.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Folder Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Folders</CardTitle>
          <CardDescription>
            Select which Telegram folders to include
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FolderPicker
            folders={folders}
            selectedIds={currentConfig.folderIds}
          />
        </CardContent>
      </Card>

      {/* Chat Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Chat Types</CardTitle>
          <CardDescription>
            Filter by chat type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChatTypePicker selectedTypes={currentConfig.chatTypes} />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowSaveDialog(true)}>
          <Save className="h-4 w-4 mr-2" />
          Save as Profile
        </Button>
      </div>

      {/* Save Dialog */}
      <Modal
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        title="Save Scope Profile"
        description="Give your scope configuration a name"
      >
        <div className="space-y-4">
          <Input
            placeholder="Profile name..."
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={!newProfileName.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
