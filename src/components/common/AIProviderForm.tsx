import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLLMConfig,
  isLLMConfigured,
  listOllamaModels,
  testLLMConnection,
  type LLMConfig,
  type OllamaModel,
} from "@/lib/tauri";
import { RefreshCw, CheckCircle2, XCircle, Loader2, TriangleAlert } from "lucide-react";

const LARGE_MODEL_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB on disk
const LARGE_PARAM_THRESHOLD = 13; // billions of parameters

function isLargeOllamaModel(name: string, models: OllamaModel[]): boolean {
  const entry = models.find((m) => m.name === name);
  if (!entry) return false;
  // Primary: use parameter_size from Ollama details (e.g. "70.6B" → 70.6)
  if (entry.parameter_size) {
    const match = entry.parameter_size.match(/([\d.]+)\s*B/i);
    if (match && parseFloat(match[1]) >= LARGE_PARAM_THRESHOLD) return true;
  }
  // Fallback: check file size for older Ollama versions without details
  if (entry.size && entry.size > LARGE_MODEL_BYTES) return true;
  return false;
}

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

export interface AIProviderFormHandle {
  getConfig: () => LLMConfig;
  loadConfig: () => Promise<void>;
  resetTestStatus: () => void;
}

interface AIProviderFormProps {
  variant: "compact" | "card";
  onConfigChange?: (config: LLMConfig) => void;
  loadOnMount?: boolean;
}

export const AIProviderForm = forwardRef<AIProviderFormHandle, AIProviderFormProps>(
  function AIProviderForm({ variant, onConfigChange, loadOnMount = true }, ref) {
    const [provider, setProvider] = useState<"openai" | "ollama">("openai");
    const [baseUrl, setBaseUrl] = useState(DEFAULT_URLS.openai);
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");
    const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
    const [ollamaError, setOllamaError] = useState<string | null>(null);
    const [loadingModels, setLoadingModels] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState("");
    const [envKeyDetected, setEnvKeyDetected] = useState(false);

    // Remember per-provider field values so switching back restores them
    const savedFields = useRef<Record<string, { baseUrl: string; model: string; apiKey: string }>>({
      openai: { baseUrl: DEFAULT_URLS.openai, model: "gpt-4o-mini", apiKey: "" },
      ollama: { baseUrl: DEFAULT_URLS.ollama, model: "", apiKey: "" },
    });

    const buildConfig = (): LLMConfig => ({
      provider,
      base_url: baseUrl,
      api_key: provider === "openai" ? apiKey || null : null,
      model,
    });

    const loadConfig = async () => {
      setTestStatus("idle");
      setTestMessage("");
      try {
        const config = await getLLMConfig();
        setProvider(config.provider);
        setBaseUrl(config.base_url);
        setModel(config.model);
        if (config.provider === "ollama") {
          fetchOllamaModels(config.base_url);
        }
        if (config.api_key && config.api_key !== "") {
          setEnvKeyDetected(true);
          setApiKey(config.api_key);
        }
      } catch (e) {
        console.error("Failed to load LLM config:", e);
      }

      try {
        const configured = await isLLMConfigured();
        if (configured) {
          setEnvKeyDetected(true);
        }
      } catch {
        // ignore
      }
    };

    useImperativeHandle(ref, () => ({
      getConfig: buildConfig,
      loadConfig,
      resetTestStatus: () => {
        setTestStatus("idle");
        setTestMessage("");
      },
    }));

    useEffect(() => {
      if (loadOnMount) {
        loadConfig();
      }
    }, []);

    // Notify parent of config changes
    useEffect(() => {
      onConfigChange?.(buildConfig());
    }, [provider, baseUrl, apiKey, model]);

    const fetchOllamaModels = async (url?: string) => {
      setLoadingModels(true);
      setOllamaError(null);
      try {
        const allModels = await listOllamaModels(url || baseUrl);
        // Filter out embedding models — they can't generate text
        const models = allModels.filter((m) => !m.name.includes("embed"));
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
      // Save current provider's fields
      savedFields.current[provider] = { baseUrl, model, apiKey };

      // Restore target provider's fields
      const restored = savedFields.current[newProvider];
      setProvider(newProvider);
      setBaseUrl(restored.baseUrl);
      setModel(restored.model);
      setApiKey(restored.apiKey);
      setTestStatus("idle");
      setTestMessage("");
      setOllamaError(null);

      if (newProvider === "ollama") {
        fetchOllamaModels(restored.baseUrl);
      }
    };

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

    const isCard = variant === "card";
    const Label = isCard ? "h4" : "label";
    const labelClass = isCard
      ? "text-sm font-medium text-muted-foreground uppercase tracking-wide"
      : "text-sm font-medium";

    const fieldWrapper = (children: React.ReactNode) =>
      isCard ? (
        <div className="p-3 rounded-lg border border-border bg-background">{children}</div>
      ) : (
        children
      );

    return (
      <div className={isCard ? "space-y-4 max-h-[60vh] overflow-y-auto pr-2" : "space-y-4 py-4"}>
        {/* Provider */}
        <div className="space-y-2">
          <Label className={labelClass}>Provider</Label>
          {fieldWrapper(
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label className={labelClass}>Base URL</Label>
          {fieldWrapper(
            <>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_URLS[provider]}
              />
              {provider === "ollama" && (
                <p className={`text-xs text-muted-foreground ${isCard ? "mt-2" : ""}`}>
                  Change if Ollama runs on a different host/port
                </p>
              )}
            </>
          )}
        </div>

        {/* API Key (OpenAI only) */}
        {provider === "openai" && (
          <div className="space-y-2">
            <Label className={labelClass}>API Key</Label>
            {fieldWrapper(
              <div className={isCard ? "space-y-2" : ""}>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                {envKeyDetected && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Key detected from environment
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Stored locally, never sent anywhere except the provider
                </p>
              </div>
            )}
          </div>
        )}

        {/* Model */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className={labelClass}>Model</Label>
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
          {fieldWrapper(
            provider === "openai" ? (
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
            )
          )}
          {provider === "ollama" && model && isLargeOllamaModel(model, ollamaModels) && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This is a large model. Make sure your machine has enough RAM and a capable GPU to run it smoothly.</span>
            </div>
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
    );
  }
);
