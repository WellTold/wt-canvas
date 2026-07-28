import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, Play, Pencil, Check, Clock } from "lucide-react";

interface AutoPublishSettingsData {
  id?: number;
  enabled: boolean;
  articlesPerDay: number;
  runStartTime: string;
  readyByTime: string;
  publishWindowStart: string;
  publishWindowEnd: string;
  timezone: string;
}

const DEFAULT: AutoPublishSettingsData = {
  enabled: false,
  articlesPerDay: 1,
  runStartTime: "06:00",
  readyByTime: "09:00",
  publishWindowStart: "09:00",
  publishWindowEnd: "17:00",
  timezone: "America/New_York",
};

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "UTC", label: "UTC" },
];

interface AutoPublishItem {
  id: string | number;
  title: string;
  status: string;
  approvalStatus: string;
  scheduledPublishDate: string | null;
  publishedAt: string | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function approvalColor(status: string): string {
  switch (status) {
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    default: return "bg-yellow-100 text-yellow-800";
  }
}

export default function AutoPublisher() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<AutoPublishSettingsData>(DEFAULT);

  const { data: settings } = useQuery<AutoPublishSettingsData>({
    queryKey: ["/api/auto-publish-settings"],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled ?? false,
        articlesPerDay: settings.articlesPerDay ?? 1,
        runStartTime: settings.runStartTime || "06:00",
        readyByTime: settings.readyByTime || "09:00",
        publishWindowStart: settings.publishWindowStart || "09:00",
        publishWindowEnd: settings.publishWindowEnd || "17:00",
        timezone: settings.timezone || "America/New_York",
      });
    }
  }, [settings]);

  const { data: queue = [], isLoading: queueLoading } = useQuery<AutoPublishItem[]>({
    queryKey: ["/api/auto-publish/queue"],
    // Poll while a run might be generating drafts, so new items show up without a manual refresh.
    refetchInterval: 15000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<AutoPublishItem[]>({
    queryKey: ["/api/auto-publish/history"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AutoPublishSettingsData) => {
      const res = await apiRequest("PUT", "/api/auto-publish-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-publish-settings"] });
      toast({ title: "Schedule saved", description: "The auto-publisher will use this schedule starting with its next run." });
    },
    onError: (err: Error) => toast({ title: "Failed to save schedule", description: err.message, variant: "destructive" }),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auto-publish/run-now", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Run started", description: "Drafts will appear in the queue below as they're generated — this can take a few minutes." });
    },
    onError: (err: Error) => toast({ title: "Failed to start run", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("POST", `/api/auto-publish/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-publish/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-publish/history"] });
      toast({ title: "Approved", description: "It'll publish at its scheduled time (or already has, if that time already passed)." });
    },
    onError: (err: Error) => toast({ title: "Failed to approve", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auto Publisher</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate articles on a daily schedule, review and approve them, then let them publish automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            The generation run creates drafts starting at "Run start time" and spreads their publish times evenly
            across the publish window. Nothing goes live until you approve it — approved drafts publish
            automatically once their scheduled time arrives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Label htmlFor="ap-enabled" className="text-sm font-medium">Auto Publisher enabled</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Turns off both the daily generation run and the publish sweep.</p>
            </div>
            <Switch
              id="ap-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ap-count">Articles per day</Label>
              <Input
                id="ap-count"
                type="number"
                min={1}
                max={20}
                value={form.articlesPerDay}
                onChange={(e) => setForm({ ...form, articlesPerDay: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-timezone">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger id="ap-timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ap-start">Run start time</Label>
              <Input
                id="ap-start"
                type="time"
                value={form.runStartTime}
                onChange={(e) => setForm({ ...form, runStartTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-ready">Ready-by (target)</Label>
              <Input
                id="ap-ready"
                type="time"
                value={form.readyByTime}
                onChange={(e) => setForm({ ...form, readyByTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-window-start">Publish window start</Label>
              <Input
                id="ap-window-start"
                type="time"
                value={form.publishWindowStart}
                onChange={(e) => setForm({ ...form, publishWindowStart: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-window-end">Publish window end</Label>
              <Input
                id="ap-window-end"
                type="time"
                value={form.publishWindowEnd}
                onChange={(e) => setForm({ ...form, publishWindowEnd: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            "Ready-by" is advisory — with several articles generating sequentially it's a target, not a hard deadline.
          </p>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save schedule"}
            </Button>
            <Button variant="outline" onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending}>
              <Play className="w-4 h-4 mr-2" />
              {runNowMutation.isPending ? "Starting..." : "Run now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>Drafts waiting for approval or their scheduled publish time.</CardDescription>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing queued right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateTime(item.scheduledPublishDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={approvalColor(item.approvalStatus)}>{item.approvalStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/pages/builder/${item.id}`)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                      {item.approvalStatus !== "approved" && (
                        <Button size="sm" onClick={() => approveMutation.mutate(item.id)} disabled={approveMutation.isPending}>
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Everything the auto-publisher has published. Edit and republish any of them any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.publishedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/pages/builder/${item.id}`)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
