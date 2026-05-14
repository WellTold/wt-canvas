import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, getSessionTokenSync } from "@/lib/auth";
import { Cloud, CloudOff, Loader2, Terminal } from "lucide-react";

type DeployStatus = "idle" | "running" | "success" | "error";

export default function WorkerDeployment() {
  const { data: user } = useAuth();
  const [status, setStatus] = useState<DeployStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const isAdminOrDev = user?.role === "admin" || user?.role === "developer";

  const scrollToBottom = () => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  const handleDeploy = async () => {
    setStatus("running");
    setLogs([]);

    const token = getSessionTokenSync() ?? "";

    try {
      const response = await fetch("/api/tools/deploy-worker", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok || !response.body) {
        setStatus("error");
        setLogs([`Failed to connect to deploy endpoint (HTTP ${response.status}).`]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataPart = part.trim();
          if (!dataPart.startsWith("data:")) continue;
          const json = dataPart.slice(5).trim();
          try {
            const payload = JSON.parse(json);
            if (payload.line !== undefined) {
              setLogs((prev) => {
                const next = [...prev, payload.line];
                setTimeout(scrollToBottom, 0);
                return next;
              });
            }
            if (payload.done) {
              setStatus(payload.success ? "success" : "error");
            }
          } catch {
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setLogs((prev) => [
        ...prev,
        `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  };

  const statusBadge = () => {
    switch (status) {
      case "running":
        return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">Deploying...</Badge>;
      case "success":
        return <Badge className="bg-green-100 text-green-800 border border-green-300">Deployed</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800 border border-red-300">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 border border-gray-300">Idle</Badge>;
    }
  };

  if (!isAdminOrDev) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You need admin or developer access to deploy the worker.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="wt-page-header">
        <h1 className="wt-page-title">Worker Deployment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deploy the Cloudflare Worker that serves live article pages at{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5">welltolddesign.com/articles/*</span>
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Deploy Worker</CardTitle>
          {statusBadge()}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Any change to files under <span className="font-mono text-xs bg-muted px-1 py-0.5">worker/src/</span> —
            hero image injection, FAQ accordion, CTA blocks, CSS — requires a redeploy to go live.
            Click below to bundle and deploy the latest worker source to Cloudflare.
          </p>

          <Button
            onClick={handleDeploy}
            disabled={status === "running"}
            className="w-full"
          >
            {status === "running" ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Deploying...
              </>
            ) : status === "success" ? (
              <>
                <Cloud size={16} className="mr-2" />
                Redeploy Worker
              </>
            ) : status === "error" ? (
              <>
                <CloudOff size={16} className="mr-2" />
                Retry Deployment
              </>
            ) : (
              <>
                <Cloud size={16} className="mr-2" />
                Deploy Worker
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal size={14} />
              Deployment Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={logRef}
              className="bg-black text-green-400 font-mono text-xs p-4 rounded overflow-y-auto max-h-96 whitespace-pre-wrap"
            >
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {status === "running" && (
                <div className="animate-pulse">▌</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
