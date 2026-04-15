import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <div>
      <div className="wt-page-header">
        <h1 className="wt-page-title">Settings</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configure your WT Canvas preferences and integrations.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            This page is a placeholder for future settings including theme preferences, 
            notification settings, and API integrations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
