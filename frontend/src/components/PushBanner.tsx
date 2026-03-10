import { useEffect, useState } from "react";
import { Bell, BellOff, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PushBanner() {
  const { state, subscribe, unsubscribe } = usePushNotifications();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem("install-banner-dismissed") === "1"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  if (state === "unsupported" || state === "loading") return null;

  const showInstall = !!installPrompt && !installDismissed;
  const showPush = state === "unsubscribed" || state === "denied";

  if (!showInstall && !showPush && state !== "subscribed") return null;

  return (
    <div className="mx-4 mt-3 mb-0 space-y-2">
      {/* Banner de instalação */}
      {showInstall && (
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              📲 <strong>Instalar EMS On Call</strong> — acesso rápido e notificações no celular
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleInstall}>
              <Download className="h-3 w-3 mr-1" />Instalar App
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => {
                localStorage.setItem("install-banner-dismissed", "1");
                setInstallDismissed(true);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Banner de push — sempre visível enquanto não subscrito */}
      {state === "unsubscribed" && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              🔔 <strong>Ativar notificações push</strong> — receba alertas de sobreaviso em tempo real
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 hover:bg-amber-100" onClick={subscribe}>
            <Bell className="h-3 w-3 mr-1" />Ativar Notificações
          </Button>
        </div>
      )}

      {state === "denied" && (
        <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-3">
          <p className="text-xs text-destructive">
            🔕 <strong>Notificações bloqueadas.</strong> Acesse as configurações do browser/celular e permita notificações para este site, depois recarregue a página.
          </p>
        </div>
      )}

      {state === "subscribed" && (
        <div className="rounded-lg border bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-green-700 dark:text-green-400">
              ✅ <strong>Notificações ativas</strong> — você receberá alertas de sobreaviso
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={unsubscribe}>
            <BellOff className="h-3 w-3 mr-1" />Desativar
          </Button>
        </div>
      )}
    </div>
  );
}
