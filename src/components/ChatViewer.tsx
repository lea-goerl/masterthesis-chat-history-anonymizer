import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PRIVACY_TAGS, PrivacyTagId } from "@/lib/privacyTags";
import { ChatMessage } from "@/pages/Index";
import { toast } from "sonner";

interface ChatViewerProps {
  chats: ChatMessage[];
  onToggleChat: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  applyMasking: (text: string) => string;
  onAddMaskedWord: (word: string, tag: PrivacyTagId) => void;
}

export const ChatViewer = ({ chats, onToggleChat, onToggleAll, applyMasking, onAddMaskedWord }: ChatViewerProps) => {
  const allSelected = chats.every(chat => chat.selected);
  const someSelected = chats.some(chat => chat.selected);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  // Ref mirror so the (empty-deps) selection listener sees the current value.
  const menuOpenRef = useRef(false);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 0) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect) {
          setSelectedText(text);
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
        }
      } else if (!menuOpenRef.current) {
        // Don't clear while the tag menu is open (opening it collapses the selection).
        setSelectedText("");
        setSelectionPosition(null);
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("selectionchange", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("selectionchange", handleSelection);
    };
  }, []);

  const handleMaskSelection = (tag: PrivacyTagId) => {
    if (selectedText) {
      onAddMaskedWord(selectedText, tag);
      const tagLabel = PRIVACY_TAGS.find((t) => t.id === tag)?.label ?? tag;
      toast.success(`"${selectedText}" masked as ${tagLabel}`);
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      setSelectionPosition(null);
    }
  };

  const toggleExpanded = (chatId: string) => {
    setExpandedChats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Floating mask button */}
      {(selectedText || menuOpen) && selectionPosition && (
        <div
          className="fixed z-50 animate-in fade-in zoom-in-95"
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="shadow-lg">
                <EyeOff className="mr-2 h-4 w-4" />
                Mask "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-80">
              <DropdownMenuLabel>Choose a privacy tag</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRIVACY_TAGS.map((tag) => (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={() => handleMaskSelection(tag.id)}
                  className="flex items-start gap-2 py-2"
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tag.dotClass}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium leading-tight">{tag.label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{tag.question}</span>
                    <span className="text-xs italic text-muted-foreground/80 leading-snug">{tag.example}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Conversations</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleAll(true)}
            disabled={allSelected}
          >
            Select All
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
        <strong>Please note:</strong> Only your own prompts (the messages you typed) are shown here and submitted to the researchers. ChatGPT's replies and the rest of the conversation are never sent.
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Below you can review the prompts from your history. Before submitting them to the researchers, please check whether any of them contain personal data that identifies you (e.g., names) and mask it.
        You can select a word (or double-click it) and choose a privacy tag to hide every occurrence of it.
        Please hide personal information such as names, phone numbers, and email addresses. (Hiding names of publicly known people, such as politicians, is not necessary.)
      </p>      

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {chats.map((chat) => {
            const userMessages = chat.messages.filter((m) => m.role === "user");
            return (
            <Card
              key={chat.id}
              className={`p-4 transition-colors ${
                chat.selected ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={chat.selected}
                  onCheckedChange={() => onToggleChat(chat.id)}
                  className="mt-1"
                />
                
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">{chat.title}</h4>
                    <Badge variant="secondary" className="ml-auto">
                      {userMessages.length} prompt{userMessages.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {(expandedChats.has(chat.id) ? userMessages : userMessages.slice(0, 3)).map((message, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border border-border bg-background p-3 text-sm"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Your prompt
                          </span>
                        </div>
                        <p className="text-foreground select-text cursor-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {applyMasking(message.content)}
                        </p>
                      </div>
                    ))}
                    {userMessages.length > 3 && (
                      <button
                        onClick={() => toggleExpanded(chat.id)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {expandedChats.has(chat.id) 
                          ? "Show less" 
                          : `+ ${userMessages.length - 3} more prompts`
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
    </>
  );
};
