import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe, Loader2 } from "lucide-react";
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
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to translate webpage",
        variant: "destructive"
      });
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
            Enter a webpage URL and choose how much of the content to translate to Swedish
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Webpage URL</label>
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
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
            disabled={translateMutation.isPending || !url}
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
