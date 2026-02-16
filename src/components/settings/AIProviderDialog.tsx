import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getLLMConfig,
  updateLLMConfig,
  listOllamaModels,
  testLLMConnection,
  type LLMConfig,
  type OllamaModel,
} from "@/lib/tauri";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "o1-mini",
  "o3-mini",
];

const DEFAULT_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  ollama: "http://localhost:11434",
};

interface AIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIProviderDialog({ open, onOpenChange }: AIProviderDialogProps) {
  const [provider, setProvider] = useState<"openai" | "ollama">("openai");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URLS.openai);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Load current config when dialog opens
  useEffect(() => {
    if (open) {
      setTestStatus("idle");
      setTestMessage("");
      getLLMConfig().then((config) => {
        setProvider(config.provider);
        setBaseUrl(config.base_url);
        setApiKey(config.api_key || "");
        setModel(config.model);
        if (config.provider === "ollama") {
          fetchOllamaModels(config.base_url);
        }
      }).catch((e) => {
        console.error("Failed to load LLM config:", e);
      });
    }
  }, [open]);

  const fetchOllamaModels = async (url?: string) => {
    setLoadingModels(true);
    setOllamaError(null);
    try {
      const models = await listOllamaModels(url || baseUrl);
      setOllamaModels(models);
      if (models.length > 0 && !models.some((m) => m.name === model)) {
        setModel(models[0].name);
      }
    } catch (e) {
      setOllamaError(String(e));
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (newProvider: "openai" | "ollama") => {
    setProvider(newProvider);
    setBaseUrl(DEFAULT_URLS[newProvider] || DEFAULT_URLS.openai);
    setTestStatus("idle");
    setTestMessage("");
    setOllamaError(null);
    if (newProvider === "openai") {
      setModel("gpt-4o-mini");
    } else if (newProvider === "ollama") {
      setModel("");
      fetchOllamaModels(DEFAULT_URLS.ollama);
    }
  };

  const buildConfig = (): LLMConfig => ({
    provider,
    base_url: baseUrl,
    api_key: provider === "openai" ? apiKey || null : null,
    model,
  });

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      const result = await testLLMConnection(buildConfig());
      setTestStatus("success");
      setTestMessage(result);
    } catch (e) {
      setTestStatus("error");
      setTestMessage(String(e));
    }
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      await updateLLMConfig(buildConfig());
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save LLM config:", e);
      setTestStatus("error");
      setTestMessage(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Provider</DialogTitle>
          <DialogDescription>
            Configure which AI provider and model to use for briefings, summaries, and drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_URLS[provider]}
            />
            {provider === "ollama" && (
              <p className="text-xs text-muted-foreground">
                Change if Ollama runs on a different host/port
              </p>
            )}
          </div>

          {/* API Key (OpenAI only) */}
          {provider === "openai" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground">
                Stored locally in SQLite, never sent to any server except OpenAI
              </p>
            </div>
          )}

          {/* Model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Model</label>
              {provider === "ollama" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchOllamaModels()}
                  disabled={loadingModels}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${loadingModels ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              )}
            </div>
            {provider === "openai" ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                {ollamaError ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {ollamaError}
                  </div>
                ) : ollamaModels.length > 0 ? (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {loadingModels ? "Loading models..." : "No models found. Pull a model with: ollama pull llama3"}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Test Connection */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testStatus === "testing" || !model}
              className="w-full"
            >
              {testStatus === "testing" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : testStatus === "success" ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              ) : testStatus === "error" ? (
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
              ) : null}
              Test Connection
            </Button>
            {testMessage && (
              <p className={`text-xs ${testStatus === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {testMessage}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving || !model}>
            {saving ? "Saving..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
