import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function CloudinaryTest() {
  const { data: testResult, isLoading, refetch } = useQuery({
    queryKey: ["/api/cloudinary/test"],
    queryFn: async () => {
      const response = await fetch("/api/cloudinary/test", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to test Cloudinary");
      return response.json();
    },
    enabled: false, // Don't auto-run
  });

  return (
    <div className="space-y-6">
      <div className="wt-page-header">
        <h1 className="wt-page-title">Cloudinary Connection Test</h1>
        <p className="text-muted-foreground">Test your Cloudinary API connection</p>
      </div>

      <Button onClick={() => refetch()} disabled={isLoading}>
        {isLoading ? "Testing..." : "Test Connection"}
      </Button>

      {testResult && (
        <div className="bg-[#f0ebe7] border border-black rounded p-4">
          <h3 className="font-semibold mb-2">Test Results:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}