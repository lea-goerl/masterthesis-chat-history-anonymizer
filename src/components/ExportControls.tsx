import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Send, CheckCircle2, ShieldCheck, MessageSquare } from "lucide-react";
import { ChatMessage } from "@/pages/Index";
import { toast } from "sonner";
import { getQualtricsSurveyUrl, getParticipantId } from "@/vars";
import { MaskedWord, PRIVACY_TAGS } from "@/lib/privacyTags";

interface ExportControlsProps {
  chats: ChatMessage[];
  applyMasking: (text: string) => string;
  allChatLength: number;
  maskedWords: MaskedWord[];
}

export const ExportControls = ({ chats, applyMasking, allChatLength, maskedWords }: ExportControlsProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [continueUrl, setContinueUrl] = useState("");
  // Review-before-upload step required by the ethics committee: the participant
  // must see exactly what leaves their device and actively consent to it.
  const [showPreview, setShowPreview] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  // Second, separate confirmation: the participant attests the data is their own
  // ChatGPT history and does not contain third parties' logs/data.
  const [ownDataChecked, setOwnDataChecked] = useState(false);

  // After the donation is stored, forward the participant to the Qualtrics
  // survey automatically. A short delay lets them see the confirmation; the
  // "Return to the survey" button below stays as a manual fallback.
  useEffect(() => {
    if (isDone && continueUrl) {
      const timer = setTimeout(() => {
        window.location.href = continueUrl;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDone, continueUrl]);
  const prepareExportData = () => {
    // Only the user's own prompts are exported — the assistant's replies are
    // dropped. Masking (█) is applied to whatever the user chose to hide, so any
    // text they did NOT black out remains visible.
    return chats.map(chat => ({
      title: chat.title,
      messages: chat.messages
        .filter(msg => msg.role === 'user')
        .map(msg => ({
          role: msg.role,
          content: applyMasking(msg.content),
          timestamp: msg.timestamp
        }))
    }));
  };
  // Build a privacy-preserving summary of the masking the user performed.
  // NOTE: we deliberately do NOT include the plaintext of the masked words,
  // only their chosen tag and character length, so the anonymized PII is not
  // leaked back to the researchers.
  const prepareMaskingSummary = () => {
    const tagCounts: Record<string, number> = {};
    PRIVACY_TAGS.forEach((t) => (tagCounts[t.id] = 0));
    maskedWords.forEach((w) => {
      tagCounts[w.tag] = (tagCounts[w.tag] ?? 0) + 1;
    });
    return {
      total_masked_terms: maskedWords.length,
      tag_counts: tagCounts,
      masked_terms: maskedWords.map((w) => ({
        tag: w.tag,
        length: w.word.length,
      })),
    };
  };

  const getAllChatLength = () => {
    return allChatLength;
  }

  const handleExport = () => {
    if (chats.length === 0) {
      toast.error("No conversations selected to export");
      return;
    }

    const exportData = prepareExportData();
    const maskingSummary = prepareMaskingSummary();
    const blob = new Blob([JSON.stringify({ conversations: exportData, masking_summary: maskingSummary }, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatgpt-export-filtered-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Export downloaded successfully");
  };

  // Step 1: open the review dialog instead of submitting straight away.
  const openPreview = () => {
    if (chats.length === 0) {
      toast.error("No conversations selected to submit");
      return;
    }
    setConsentChecked(false);
    setOwnDataChecked(false);
    setShowPreview(true);
  };

  // Step 2: only runs after the participant has reviewed the data and ticked
  // the consent box inside the dialog.
  const handleSubmit = async () => {
    if (chats.length === 0) {
      toast.error("No conversations selected to submit");
      return;
    }

    const endpointUrl = `${import.meta.env.BASE_URL}submit`

    setIsSubmitting(true);
    console.log("Submitting to endpoint:", endpointUrl);

    try {
      const exportData = prepareExportData();
      const maskingSummary = prepareMaskingSummary();

      const idOne = getParticipantId();
      
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_one: idOne,
          conversations: exportData,
          timestamp: new Date().toISOString(),
          total_conversations: exportData.length,
          total_messages: exportData.reduce((sum, chat) => sum + chat.messages.length, 0),
          all_chat_length: getAllChatLength(),
          masking_summary: maskingSummary
        }),
      });

      // Data donation happens BEFORE the questionnaire (to avoid biasing the
      // donation). On success we always hand the participant over to the
      // Qualtrics survey, carrying their Prolific ID as PROLIFIC_PID so
      // Qualtrics can capture it as embedded data and, at the end of the
      // survey, redirect back to Prolific with the study's completion code.
      const targetUrl =
        getQualtricsSurveyUrl() + "?PROLIFIC_PID=" + encodeURIComponent(idOne ?? "");

      if (response.ok) {
        toast.success("Data submitted successfully");
        setShowPreview(false);
        setContinueUrl(targetUrl);
        setIsDone(true);
      } else {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      console.error("Error submitting data:", error);
      toast.error("Failed to submit data. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-md border-border p-10 text-center shadow-xl">
          <p className="mb-8 text-sm font-semibold tracking-wide text-[#00883A]">
            LMU MÜNCHEN
          </p>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#00883A]/10">
            <CheckCircle2 className="h-9 w-9 text-[#00883A]" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">Thank you!</h2>
          <p className="mb-8 text-muted-foreground">
            Your data has been submitted successfully and stored securely. This
            part of the study is now complete.
          </p>
          <Button
            className="w-full bg-[#00883A] hover:bg-[#00742F]"
            size="lg"
            onClick={() => {
              if (continueUrl) window.location.href = continueUrl;
            }}
          >
            Return to the survey
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">
            If you are not redirected automatically, please use the button above.
          </p>
        </Card>
      </div>
    );
  }

  // Built from the exact same functions used by handleSubmit, so the preview can
  // never diverge from what is actually transmitted ("shown = sent").
  const previewData = showPreview ? prepareExportData() : [];
  const previewSummary = showPreview ? prepareMaskingSummary() : null;
  const previewTotalMessages = previewData.reduce((sum, c) => sum + c.messages.length, 0);
  const idOne = getParticipantId();

  return (
    <Card className="p-6">
       <div className="space-y-4">
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Complete Submission: Transmit Data</h3>

          <p className="mb-4 text-sm text-muted-foreground">
            When you click below, you will first see a preview of exactly which
            data will be transmitted. Nothing is sent until you review it and
            confirm.
          </p>
        </div>

        <Button
          onClick={openPreview}
          className="w-full"
          disabled={chats.length === 0 || isSubmitting}
          variant="secondary"
        >
          <Send className="mr-2 h-4 w-4" />
          Review and submit
        </Button>

        {/* Local testing only: hidden in the production build (npm run build). */}
        {import.meta.env.DEV && (
          <Button
            onClick={handleExport}
            className="w-full"
            disabled={chats.length === 0}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download JSON (test)
          </Button>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: this is what will be transmitted</DialogTitle>
            <DialogDescription>
              Please review the data below. Nothing has been sent yet — this is
              exactly what will leave your device.
            </DialogDescription>
          </DialogHeader>

          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Conversations</p>
              <p className="text-xl font-semibold text-foreground">{previewData.length}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Your messages</p>
              <p className="text-xl font-semibold text-foreground">{previewTotalMessages}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Masked terms</p>
              <p className="text-xl font-semibold text-foreground">
                {previewSummary?.total_masked_terms ?? 0}
              </p>
            </div>
          </div>

          {/* What stays on the device */}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            <p className="mb-1 flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              This stays on your device
            </p>
            <ul className="ml-6 list-disc space-y-0.5 text-muted-foreground">
              <li>ChatGPT's replies — only your own prompts are sent</li>
              <li>Every masked word (█) — the hidden text is never transmitted</li>
              <li>Conversations you deselected or deleted</li>
            </ul>
          </div>

          {/* Exact content that will be sent */}
          <p className="text-sm font-medium text-foreground">The exact text being sent</p>
          <ScrollArea className="h-56 rounded-md border border-border">
            <div className="divide-y divide-border">
              {previewData.map((chat, ci) => (
                <div key={ci} className="space-y-2 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {chat.title}
                  </p>
                  {chat.messages.map((msg, mi) => (
                    <p
                      key={mi}
                      className="whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]"
                    >
                      {msg.content}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Masking summary (tags + counts only, never plaintext) */}
          {previewSummary && previewSummary.total_masked_terms > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Information sent about your masking (no hidden text)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRIVACY_TAGS.filter((t) => (previewSummary.tag_counts[t.id] ?? 0) > 0).map((t) => (
                  <Badge key={t.id} variant="outline" className={t.badgeClass}>
                    {t.label} · {previewSummary.tag_counts[t.id]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Technical metadata that is also transmitted */}
          <p className="text-xs text-muted-foreground">
            Also included: a technical study ID{idOne ? ` (${idOne})` : ""}, the time
            of submission, and the total number of conversations and messages. No
            other data is sent.
          </p>

          {/* Explicit, data-specific consent */}
          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted p-3">
            <Checkbox
              checked={consentChecked}
              onCheckedChange={(v) => setConsentChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground">
              I have reviewed the data shown above and consent to transmitting
              exactly this data for the study.
            </span>
          </label>

          {/* Ownership confirmation: this must be the participant's own data. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted p-3">
            <Checkbox
              checked={ownDataChecked}
              onCheckedChange={(v) => setOwnDataChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground">
              I confirm that these are my own ChatGPT conversations and that they
              do not contain other people's data or logs.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isSubmitting}>
              Back, keep editing
            </Button>
            <Button onClick={handleSubmit} disabled={!consentChecked || !ownDataChecked || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Send className="mr-2 h-4 w-4 animate-pulse" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Transmit this data now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
