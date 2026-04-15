import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailDeployment() {
  return (
    <div>
      <div className="wt-page-header">
        <div className="mb-4">
          <h1 className="wt-page-title">Email Deployment</h1>
          <p className="text-gray-500 text-sm mt-1">
            Send and schedule email campaigns to your audience.
          </p>
        </div>
        <div>
          <Button disabled className="bg-black text-white opacity-50 cursor-not-allowed">
            <Send className="h-4 w-4 mr-2" />
            Send Campaign
          </Button>
        </div>
      </div>

      <div className="border border-black bg-[#f0ebe7] p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 border border-black bg-white">
            <Send size={32} />
          </div>
        </div>
        <h2 className="text-lg font-semibold mb-2">Email deployment coming soon</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Schedule and send campaigns, track open rates and click-throughs, manage subscriber lists, and view delivery reports — all from this panel once the email pipeline is live.
        </p>
      </div>
    </div>
  );
}
