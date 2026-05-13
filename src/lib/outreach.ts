// Channel taxonomy for ContactAttempt. Centralized so list views, lead detail,
// and forms all read from one source. Keep aligned with PRD §14 + lead source enum.

export type Channel =
  | "EMAIL"
  | "CALL"
  | "LINKEDIN"
  | "SOCIAL"
  | "IN_PERSON"
  | "SMS"
  | "OTHER";

export type ContactStatus =
  | "ATTEMPTED"
  | "RESPONDED"
  | "NO_REPLY"
  | "BOUNCED"
  | "NOT_AVAILABLE";

export type Direction = "OUTBOUND" | "INBOUND";

export const CHANNELS: { value: Channel; label: string; emoji: string }[] = [
  { value: "EMAIL", label: "Email", emoji: "✉️" },
  { value: "CALL", label: "Call", emoji: "📞" },
  { value: "LINKEDIN", label: "LinkedIn", emoji: "in" },
  { value: "SOCIAL", label: "Social", emoji: "🌐" },
  { value: "IN_PERSON", label: "In-person", emoji: "👋" },
  { value: "SMS", label: "SMS", emoji: "💬" },
  { value: "OTHER", label: "Other", emoji: "•" },
];

export const STATUSES: { value: ContactStatus; label: string; tone: "good" | "neutral" | "bad" }[] = [
  { value: "ATTEMPTED", label: "Attempted", tone: "neutral" },
  { value: "RESPONDED", label: "Responded", tone: "good" },
  { value: "NO_REPLY", label: "No reply", tone: "neutral" },
  { value: "BOUNCED", label: "Bounced", tone: "bad" },
  { value: "NOT_AVAILABLE", label: "Not available", tone: "bad" },
];

// Required channels — a lead is "fully attempted" only if all of these have
// at least one outbound attempt. Used by the channel-coverage badge.
export const REQUIRED_CHANNELS: Channel[] = ["EMAIL", "CALL", "LINKEDIN"];

export function channelLabel(c: string): string {
  return CHANNELS.find((x) => x.value === c)?.label ?? c;
}

export function channelEmoji(c: string): string {
  return CHANNELS.find((x) => x.value === c)?.emoji ?? "•";
}

export type ChannelCoverage = {
  channel: Channel;
  attempts: number;
  hasResponse: boolean;
};

export function summarizeAttempts(
  attempts: { channel: string; direction: string; status: string }[],
): ChannelCoverage[] {
  return CHANNELS.map((c) => {
    const matched = attempts.filter((a) => a.channel === c.value);
    return {
      channel: c.value,
      attempts: matched.filter((a) => a.direction === "OUTBOUND").length,
      hasResponse: matched.some((a) => a.status === "RESPONDED"),
    };
  });
}
