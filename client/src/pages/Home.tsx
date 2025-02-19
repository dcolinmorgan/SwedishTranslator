import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [url, setUrl] = useState("");
  const [translationPercent, setTranslationPercent] = useState([30]);
  const { toast } = useToast();

  const { data: preferences } = useQuery({
    queryKey: ["/api/preferences"]
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Please enter a valid URL starting with http:// or https://');
      }

      const res = await apiRequest("POST", "/api/translate", {
        url,
        translationPercentage: translationPercent[0]
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Create a new window to display translated content
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(data.html);
        win.document.close(); // Important to finish loading
      } else {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups to view the translated page",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      // Check if it's a 403 error with test URLs
      if (error.response?.data?.testUrls) {
        toast({
          title: "Access Denied",
          description: (
            <div className="space-y-2">
              <p>{error.response.data.details}</p>
              <ul className="list-disc pl-4">
                {error.response.data.testUrls.map((url: string) => (
                  <li key={url}>
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => setUrl(url)}
                    >
                      {url}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to translate webpage",
          variant: "destructive"
        });
      }
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-yellow-50 p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-yellow-600 bg-clip-text text-transparent">
              Swedish Learning Assistant
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Enter a webpage URL and choose how much of the content to translate to Swedish.
            Translated text will be highlighted in blue and show the original text on hover.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Webpage URL</label>
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={!url.startsWith('http') && url.length > 0 ? 'border-red-500' : ''}
            />
            {!url.startsWith('http') && url.length > 0 && (
              <p className="text-sm text-red-500">URL must start with http:// or https://</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Translation Percentage: {translationPercent}%
            </label>
            <Slider
              value={translationPercent}
              onValueChange={setTranslationPercent}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <Button 
            onClick={() => translateMutation.mutate()}
            disabled={translateMutation.isPending || !url || !url.startsWith('http')}
            className="w-full"
          >
            {translateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              "Translate Webpage"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}