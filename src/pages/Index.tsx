import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ChatViewer } from "@/components/ChatViewer";
import { MaskingControls } from "@/components/MaskingControls";
import { ExportControls } from "@/components/ExportControls";
import { Button } from "@/components/ui/button";
import { HelpForm } from "@/components/HelpForm";
import { FileText, HelpCircle, Info, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import JSZip from "jszip";
import { MaskedWord, PrivacyTagId, DEFAULT_TAG_ID } from "@/lib/privacyTags";
import { escapeRegExp } from "@/lib/utils";
import { getParticipantId } from "@/vars";

export interface ChatMessage {
  id: string;
  title: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  selected: boolean;
}

const Index = () => {
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [maskedWords, setMaskedWords] = useState<MaskedWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHelpVisible, setHelpvisible] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      // Validate file is actually a ZIP
      if (!file.name.endsWith('.zip')) {
        throw new Error('Please upload a ZIP file');
      }

      console.log('Processing ZIP file:', file.name, 'Size:', file.size, 'bytes');
      
      const zip = new JSZip();
      const contents = await zip.loadAsync(file).catch(err => {
        console.error('ZIP load error:', err);
        throw new Error('Invalid or corrupted ZIP file. Please re-download your ChatGPT export and try again.');
      });
      
      const chatFiles: ChatMessage[] = [];
      let fileIndex = 0;

      console.log('ZIP loaded successfully. Found', Object.keys(contents.files).length, 'files');

      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (filename.endsWith('.json') && !zipEntry.dir) {
          console.log('Processing JSON file:', filename);
          const content = await zipEntry.async('string');
          try {
            const data = JSON.parse(content);
            
            // Helper function to extract content from various formats
            const extractContent = (node: any): string | null => {
              if (!node.message?.content) return null;
              
              const content = node.message.content;
              
              // Format 1: content.parts array (most common)
              if (content.parts && Array.isArray(content.parts) && content.parts.length > 0) {
                return typeof content.parts[0] === 'string' ? content.parts[0] : JSON.stringify(content.parts[0]);
              }
              
              // Format 2: content as direct string
              if (typeof content === 'string') {
                return content;
              }
              
              // Format 3: content.text
              if (content.text && typeof content.text === 'string') {
                return content.text;
              }
              
              // Format 4: content.content_type with text
              if (content.content_type === 'text' && content.text) {
                return content.text;
              }
              
              return null;
            };
            
            // Helper function to process messages from mapping
            const processMapping = (mapping: any): Array<{role: string; content: string; timestamp?: string}> => {
              if (!mapping || typeof mapping !== 'object') return [];
              
              const messages: Array<{role: string; content: string; timestamp?: string}> = [];
              
              Object.values(mapping).forEach((node: any) => {
                const content = extractContent(node);
                if (content && node.message?.author?.role) {
                  messages.push({
                    role: node.message.author.role,
                    content: content,
                    timestamp: node.message.create_time
                  });
                }
              });
              
              return messages;
            };
            
            // Handle ChatGPT export format
            if (Array.isArray(data)) {
              // Array of conversations
              data.forEach((chat, index) => {
                const messages = chat.mapping ? processMapping(chat.mapping) : [];
                if (messages.length > 0) {
                  chatFiles.push({
                    id: `${fileIndex}-${index}`,
                    title: chat.title || `Conversation ${fileIndex + 1}-${index + 1}`,
                    messages: messages,
                    selected: true
                  });
                }
              });
            } else if (data.title && data.mapping) {
              // Single conversation format
              const messages = processMapping(data.mapping);
              if (messages.length > 0) {
                chatFiles.push({
                  id: `${fileIndex}`,
                  title: data.title || `Conversation ${fileIndex + 1}`,
                  messages: messages,
                  selected: true
                });
              }
            } else if (data.messages && Array.isArray(data.messages)) {
              // Alternative format: direct messages array
              const messages = data.messages
                .filter((msg: any) => msg.role && msg.content)
                .map((msg: any) => ({
                  role: msg.role,
                  content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                  timestamp: msg.timestamp || msg.create_time
                }));
              
              if (messages.length > 0) {
                chatFiles.push({
                  id: `${fileIndex}`,
                  title: data.title || `Conversation ${fileIndex + 1}`,
                  messages: messages,
                  selected: true
                });
              }
            }
            
            fileIndex++;
          } catch (error) {
            console.error(`Error parsing ${filename}:`, error);
            console.error('File content preview:', content.substring(0, 200));
          }
        }
      }

      console.log('Successfully processed', chatFiles.length, 'conversations');
      
      if (chatFiles.length === 0) {
        throw new Error('No ChatGPT conversations found in ZIP file. Please make sure you exported your data correctly from ChatGPT.');
      }

      setChats(chatFiles);
      // Show the "what to do" overlay every time a new file is loaded.
      setInstructionsOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error processing ZIP file:', errorMessage, error);
      
      // Show error to user
      alert(`Upload failed: ${errorMessage}\n\nPlease check the console for more details or contact support if the issue persists.`);

      const endpointUrl = `${import.meta.env.BASE_URL}submit`
      const idOne = getParticipantId();
      
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_one: idOne,
          helpMessage: errorMessage,
          errorDetails: error instanceof Error ? error.stack : String(error),
          fileName: file.name,
          fileSize: file.size,
          timestamp: new Date().toISOString(),
       //   total_conversations: exportData.length,
        //  total_messages: exportData.reduce((sum, chat) => sum + chat.messages.length, 0)
        }),
      });

      if (response.ok) {
        console.log("Help data submitted.");
      } else {
        console.error(`Server responded with ${response.status}`);
        
      }

    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = (id: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === id ? { ...chat, selected: !chat.selected } : chat
    ));
  };

  const toggleAll = (selected: boolean) => {
    setChats(prev => prev.map(chat => ({ ...chat, selected })));
  };

  // Permanently remove a single conversation from the list before submission.
  // This is local-only (nothing has been sent yet); the participant can always
  // re-upload the export to bring deleted conversations back.
  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(chat => chat.id !== id));
  };

  const addMaskedWord = (word: string, tag: PrivacyTagId = DEFAULT_TAG_ID) => {
    const normalized = word.trim().toLowerCase();
    if (!normalized) return;
    setMaskedWords(prev => {
      const existing = prev.find(w => w.word === normalized);
      if (existing) {
        // Word already masked: update its tag to the newly chosen one.
        return prev.map(w => (w.word === normalized ? { ...w, tag } : w));
      }
      return [...prev, { word: normalized, tag }];
    });
  };

  const setMaskedWordTag = (word: string, tag: PrivacyTagId) => {
    setMaskedWords(prev => prev.map(w => (w.word === word ? { ...w, tag } : w)));
  };

  const removeMaskedWord = (word: string) => {
    setMaskedWords(prev => prev.filter(w => w.word !== word));
  };

  const applyMasking = (text: string): string => {
    let masked = text;
    maskedWords.forEach(({ word }) => {
      const regex = new RegExp(escapeRegExp(word), 'gi');
      masked = masked.replace(regex, '█'.repeat(word.length));
    });
    return masked;
  };

  const openHelp = () => {
    setHelpvisible(true);
    // Wait for the HelpForm to render, then scroll to it.
    setTimeout(() => {
      document.getElementById("help-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const reset = () => {
    setChats([]);
    setMaskedWords([]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">ChatGPT Chat Submission</h1>
              <p className="text-sm text-muted-foreground">View, filter, and anonymize your chat history for the data donation</p>
            </div>
          </div>
          <Button variant="outline" onClick={openHelp}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Button>
        </div>
      </header>

      {isHelpVisible && (
        <div id="help-section" className="shrink-0 overflow-auto" style={{ maxHeight: "50vh" }}>
          <HelpForm onClose={() => setHelpvisible(false)} />
        </div>
      )}

      <main className="container mx-auto px-4 py-8 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        {chats.length === 0 ? (
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">
          <FileUpload
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            onNeedHelp={openHelp}
          />
        </div>
        ) : (
          <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
            <div className="flex shrink-0 items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {chats.length} conversation{chats.length !== 1 ? 's' : ''} loaded
                </h2>
                <p className="text-sm text-muted-foreground">
                  {chats.filter(c => c.selected).length} selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPrivacyOpen(true)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Privacy &amp; your data
                </Button>
                <Button variant="outline" onClick={() => setInstructionsOpen(true)}>
                  <Info className="mr-2 h-4 w-4" />
                  Instructions
                </Button>
                <Button variant="outline" onClick={reset}>
                  Load Different File
                </Button>
              </div>
            </div>

            {/* Step-by-step instructions as an overlay, shown right after upload
                (and reopenable via the "Instructions" button) so they don't take
                up permanent space above the masking view. */}
            <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>What to do before submitting</DialogTitle>
                </DialogHeader>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      1
                    </span>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Hide personal data.</span> Go through your
                      prompts and black out anything that identifies you or someone else — names,
                      email addresses, phone numbers, home address, or passwords. Select the text
                      (or double-click a word) and choose a privacy tag. Every occurrence is then
                      covered with a black box (█).{" "}
                      <span className="font-medium text-foreground">
                        The words underneath stay on your device: the researchers receive only
                        the black box, so they can see that you hid something there, but never
                        what it was.
                      </span>
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      2
                    </span>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Remove what you don't want to share.</span>{" "}
                      Untick a conversation to exclude it, or delete it entirely with the trash
                      icon. Only your own prompts are ever sent — never ChatGPT's replies.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      3
                    </span>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Review and submit.</span> Click{" "}
                      <span className="font-medium">Review and submit</span> to see a preview of
                      exactly what will be transmitted, then confirm. Nothing is sent before that.
                    </p>
                  </li>
                </ol>
                <DialogFooter>
                  <Button onClick={() => setInstructionsOpen(false)}>Got it, let's start</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Privacy / data-handling information, reopenable any time via the
                "Privacy & your data" button. Content mirrors the ethics-approved
                description of the pseudonymisation and data flow. */}
            <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
              <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    What happens to your data
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm leading-relaxed text-foreground">
                  <p>
                    <span className="font-semibold">Your chats stay with you at first.</span>{" "}
                    Reading in your ChatGPT history happens entirely in your browser — nothing is
                    sent to us during this step. ChatGPT's replies are discarded right away; we
                    only ever see and store your own messages (your prompts).
                  </p>

                  <p>
                    <span className="font-semibold">You decide what gets hidden.</span> You mark
                    the sensitive parts of your prompts yourself and assign each one to a
                    category. A placeholder then replaces the original text at those spots. This
                    also happens only locally, in your browser.
                  </p>

                  <p>
                    <span className="font-semibold">
                      You see exactly what will be sent — before it's sent.
                    </span>{" "}
                    Before anything leaves your browser, we show you a full preview, exactly as
                    the data would arrive with us. Only these things are transmitted: your masked
                    prompts, timestamps, your category tags, and your Prolific ID.
                  </p>

                  <p>
                    <span className="font-semibold">
                      Nothing is sent without your active go-ahead.
                    </span>{" "}
                    Only once you've seen this preview and confirm with a click do the masked
                    data go to the LMU university server. Until then, not a single piece of data
                    leaves your browser.
                  </p>

                  <p>
                    <span className="font-semibold">No third parties are involved.</span> Your
                    data go only to LMU systems — not to ChatGPT, not to any other AI service,
                    not to any commercial provider.
                  </p>

                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p>
                      <span className="font-semibold">One thing to keep in mind:</span> because
                      you do the masking yourself, something can occasionally be missed. That's
                      what the preview at the end is for — use it to take one last calm look and
                      check that everything you don't want to share is really hidden.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={() => setPrivacyOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3">
              <div className="lg:col-span-2 lg:flex lg:min-h-0 lg:flex-col">
                <ChatViewer
                  chats={chats}
                  onToggleChat={toggleChat}
                  onToggleAll={toggleAll}
                  onDeleteChat={deleteChat}
                  applyMasking={applyMasking}
                  onAddMaskedWord={addMaskedWord}
                />
              </div>
              
              
              <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto">
                <MaskingControls
                  maskedWords={maskedWords}
                  onAddWord={addMaskedWord}
                  onRemoveWord={removeMaskedWord}
                  onChangeTag={setMaskedWordTag}
                />

                {/* Keep "Review and submit" reachable at every screen size: on
                    large screens the column scrolls and this block sticks to the
                    bottom so the button is always visible; on small screens it
                    just sits at the end of the normal, scrollable page flow. */}
                <div className="lg:sticky lg:bottom-0 lg:z-10 lg:bg-background lg:pt-4">
                  <ExportControls
                    chats={chats.filter(c => c.selected)}
                    allChats={chats}
                    allChatLength={chats.length}
                    applyMasking={applyMasking}
                    maskedWords={maskedWords}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
