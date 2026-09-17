import { franc } from "franc-min";
import { ChatMessage } from "@/pages/Index";

// Eligibility rules for the data donation. Both are hard requirements: if either
// fails, the participant cannot submit ("break-up"). They are enforced at the
// review/submit step and communicated up front in the upload screen.

export const MIN_CHAT_AGE_DAYS = 7;
export const MIN_ENGLISH_RATIO = 0.8;

// ChatGPT stores message timestamps as `create_time`, a Unix epoch value in
// seconds (occasionally already in ms). Normalise both to milliseconds.
const toMillis = (raw: unknown): number | null => {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Values below ~10^11 are seconds; above are already milliseconds.
  return n < 1e11 ? n * 1000 : n;
};

/**
 * Oldest message timestamp (in ms) across all chats, or null if none of the
 * messages carry a usable timestamp.
 */
export const getOldestTimestampMs = (chats: ChatMessage[]): number | null => {
  let oldest: number | null = null;
  chats.forEach((chat) => {
    chat.messages.forEach((msg) => {
      const ms = toMillis(msg.timestamp);
      if (ms !== null && (oldest === null || ms < oldest)) {
        oldest = ms;
      }
    });
  });
  return oldest;
};

/**
 * The export must reach back at least a week: the OLDEST message must be at
 * least MIN_CHAT_AGE_DAYS old. If no timestamp is available at all, we cannot
 * verify the age and treat it as failing the requirement.
 */
export const isChatOldEnough = (chats: ChatMessage[]): boolean => {
  const oldest = getOldestTimestampMs(chats);
  if (oldest === null) return false;
  const ageMs = Date.now() - oldest;
  return ageMs >= MIN_CHAT_AGE_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * Share of the participant's own prompts (weighted by text length) that are
 * detected as English. Only prompts long enough for a determinate detection are
 * counted; if none can be classified, we return 1 (cannot disprove English) so
 * that a handful of very short prompts never blocks a submission.
 */
export const getEnglishRatio = (chats: ChatMessage[]): number => {
  let englishLength = 0;
  let determinedLength = 0;

  chats.forEach((chat) => {
    chat.messages
      .filter((msg) => msg.role === "user")
      .forEach((msg) => {
        const text = msg.content?.trim() ?? "";
        // franc needs a bit of text to be reliable; skip very short prompts.
        if (text.length < 10) return;
        const lang = franc(text);
        if (lang === "und") return;
        determinedLength += text.length;
        if (lang === "eng") englishLength += text.length;
      });
  });

  if (determinedLength === 0) return 1;
  return englishLength / determinedLength;
};

export const isEnglishEnough = (chats: ChatMessage[]): boolean =>
  getEnglishRatio(chats) >= MIN_ENGLISH_RATIO;
