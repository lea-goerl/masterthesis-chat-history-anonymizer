import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LifeBuoy, Send, X, CheckCircle2 } from "lucide-react";
import { getParticipantId } from '@/vars';

interface HelpFormProps {
  onClose?: () => void;
}

export const HelpForm = ({ onClose }: HelpFormProps) => {
  const [helpData, setHelpData] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleHelpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpointUrl = `${import.meta.env.BASE_URL}submit`;
    setIsSubmitting(true);

    const idOne = getParticipantId();

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_one: idOne,
          helpMessage: helpData,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) console.error(`Server responded with ${response.status}`);
    } catch (error) {
      console.error("Error submitting data:", error);
    } finally {
      // Keep the participant inside the tool: do NOT redirect to Prolific.
      // Just confirm the message was sent so they can continue here.
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  return (
    <div className="container mx-auto px-4 pt-6">
      <Card className="mx-auto max-w-3xl border-primary/20 bg-primary/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Help &amp; Support</h3>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-auto h-8 w-8"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          If you run into a problem and can't continue with this submission tool, describe it below
          and we'll help you submit your ChatGPT data.
        </p>

        <div className="mb-5 rounded-md border border-border bg-background p-4 text-sm">
          <p className="font-medium text-foreground">
            Haven't received your ChatGPT export data yet?
          </p>
          <p className="mt-1 text-muted-foreground">
            Please briefly note it below and submit the form. So you can come back once your export
            arrives, bookmark this page:
          </p>
          <a
            href={currentUrl}
            className="mt-2 block break-all font-medium text-primary hover:underline"
          >
            {currentUrl}
          </a>
          <p className="mt-2 text-muted-foreground">Thank you for your contribution!</p>
        </div>

        {isSubmitted ? (
          <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Thanks — your message has been sent.</p>
              <p className="mt-1 text-muted-foreground">
                We'll get back to you. You can keep this page open and continue with your
                submission here whenever you're ready.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleHelpSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="issue">Please describe your issue</Label>
              <Textarea
                id="issue"
                value={helpData}
                onChange={(e) => setHelpData(e.target.value)}
                rows={4}
                placeholder="e.g. I haven't received my export email yet…"
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? "Submitting…" : "Submit"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
