import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toJson, parseJson } from "@/lib/json";
import type { Role } from "@/lib/types";

// Notification fan-out. Used by server actions to broadcast meaningful events
// to interested parties: admins (full transparency), managers (team activity),
// and lead owners (when others act on their leads).

export type AppEvent =
  | { type: "LEAD_CREATED"; leadId: string; leadName: string; icpName: string; actorId: string; actorName: string }
  | { type: "LEAD_STAGE_CHANGED"; leadId: string; leadName: string; from: string; to: string; ownerId: string | null; actorId: string; actorName: string }
  | { type: "LEAD_ASSIGNED"; leadId: string; leadName: string; toUserId: string; actorId: string; actorName: string }
  | { type: "LEAD_REASSIGNED_AWAY"; leadId: string; leadName: string; fromUserId: string; actorId: string; actorName: string }
  | { type: "LEAD_NOTE_ADDED"; leadId: string; leadName: string; ownerId: string | null; actorId: string; actorName: string }
  | { type: "LEAD_WON"; leadId: string; leadName: string; ownerId: string | null; actorId: string; actorName: string }
  | { type: "LEAD_LOST"; leadId: string; leadName: string; ownerId: string | null; actorId: string; actorName: string }
  | { type: "LEAD_ARCHIVED"; leadId: string; leadName: string; ownerId: string | null; actorId: string; actorName: string }
  | { type: "ICP_CREATED"; icpId: string; icpName: string; actorId: string; actorName: string }
  | { type: "USER_CREATED"; userId: string; userName: string; role: string; actorId: string; actorName: string };

// Notification.type used in DB. Mapped from AppEvent.type.
type NotificationType =
  | "LEAD_ASSIGNED"
  | "LEAD_REASSIGNED_AWAY"
  | "NOTE_ON_OWNED_LEAD"
  | "OWNED_LEAD_WON_LOST"
  | "LEAD_STALLED"
  | "TASK_DUE_TODAY"
  | "MENTION"
  | "IMPORT_FINISHED"
  | "EXPORT_READY"
  | "ICP_ADDED"
  | "TEAM_ACTIVITY"; // generic feed for admins/managers

// Per-user filter: respects their notifPrefs (set in /settings/notifications).
// If a pref is missing, defaults to ON.
function shouldDeliver(prefs: Record<string, boolean>, key: string): boolean {
  if (!(key in prefs)) return true;
  return !!prefs[key];
}

async function getRoleSubscribers(roles: Role[]): Promise<{ id: string; notifPrefs: Prisma.JsonValue }[]> {
  return prisma.user.findMany({
    where: { role: { in: roles }, status: "ACTIVE" },
    select: { id: true, notifPrefs: true },
  });
}

function buildPayload(event: AppEvent): {
  href: string | null;
  text: string;
} {
  switch (event.type) {
    case "LEAD_CREATED":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} added lead "${event.leadName}" (${event.icpName})`,
      };
    case "LEAD_STAGE_CHANGED":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} moved "${event.leadName}" to ${event.to}`,
      };
    case "LEAD_ASSIGNED":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} assigned "${event.leadName}" to you`,
      };
    case "LEAD_REASSIGNED_AWAY":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} reassigned "${event.leadName}" away from you`,
      };
    case "LEAD_NOTE_ADDED":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} added a note to "${event.leadName}"`,
      };
    case "LEAD_WON":
      return {
        href: `/leads/${event.leadId}`,
        text: `🎉 ${event.actorName} marked "${event.leadName}" as Won`,
      };
    case "LEAD_LOST":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} marked "${event.leadName}" as Lost`,
      };
    case "LEAD_ARCHIVED":
      return {
        href: `/leads/${event.leadId}`,
        text: `${event.actorName} archived "${event.leadName}"`,
      };
    case "ICP_CREATED":
      return {
        href: `/icps/${event.icpId}`,
        text: `${event.actorName} created a new ICP "${event.icpName}"`,
      };
    case "USER_CREATED":
      return {
        href: `/settings/users`,
        text: `${event.actorName} added ${event.userName} as ${event.role}`,
      };
  }
}

// Map our AppEvent to the existing NotificationType column. Lots of events
// map to the generic TEAM_ACTIVITY type; specific recipient-relevant ones
// (assignment, reassignment, note on owned lead, won/lost on owned lead)
// use their PRD-specified type.
function notificationType(event: AppEvent, recipient: { id: string }): NotificationType {
  switch (event.type) {
    case "LEAD_ASSIGNED":
      return event.toUserId === recipient.id ? "LEAD_ASSIGNED" : "TEAM_ACTIVITY";
    case "LEAD_REASSIGNED_AWAY":
      return event.fromUserId === recipient.id ? "LEAD_REASSIGNED_AWAY" : "TEAM_ACTIVITY";
    case "LEAD_NOTE_ADDED":
      return event.ownerId === recipient.id ? "NOTE_ON_OWNED_LEAD" : "TEAM_ACTIVITY";
    case "LEAD_WON":
    case "LEAD_LOST":
      return event.ownerId === recipient.id ? "OWNED_LEAD_WON_LOST" : "TEAM_ACTIVITY";
    case "ICP_CREATED":
      return "ICP_ADDED";
    default:
      return "TEAM_ACTIVITY";
  }
}

export async function notify(event: AppEvent): Promise<void> {
  const recipients = new Map<string, { reason: "admin" | "manager" | "owner" | "assignee" }>();

  // Admin + Manager get team-activity events (transparency).
  const admins = await getRoleSubscribers(["ADMIN"]);
  for (const u of admins) recipients.set(u.id, { reason: "admin" });
  const managers = await getRoleSubscribers(["MANAGER"]);
  for (const u of managers) {
    if (!recipients.has(u.id)) recipients.set(u.id, { reason: "manager" });
  }

  // Lead owner / assignee gets pinged on events about their lead.
  if ("ownerId" in event && event.ownerId) {
    if (!recipients.has(event.ownerId)) {
      recipients.set(event.ownerId, { reason: "owner" });
    }
  }
  if (event.type === "LEAD_ASSIGNED" && event.toUserId) {
    if (!recipients.has(event.toUserId)) {
      recipients.set(event.toUserId, { reason: "assignee" });
    }
  }
  if (event.type === "LEAD_REASSIGNED_AWAY" && event.fromUserId) {
    if (!recipients.has(event.fromUserId)) {
      recipients.set(event.fromUserId, { reason: "assignee" });
    }
  }

  // Don't notify the actor of their own action.
  recipients.delete(event.actorId);

  if (recipients.size === 0) return;

  const recipientIds = Array.from(recipients.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, notifPrefs: true },
  });

  const message = buildPayload(event);

  // Prefs key — coarse-grained. Users can toggle these in /settings/notifications.
  // For TEAM_ACTIVITY we always deliver in-app (admins explicitly want it);
  // for assignment / mention / digest, we honor prefs.
  const prefsKey: Record<NotificationType, string | null> = {
    LEAD_ASSIGNED: "lead_assigned_app",
    LEAD_REASSIGNED_AWAY: "lead_assigned_app",
    NOTE_ON_OWNED_LEAD: null,
    OWNED_LEAD_WON_LOST: null,
    LEAD_STALLED: "stalled_app",
    TASK_DUE_TODAY: "task_due_app",
    MENTION: null,
    IMPORT_FINISHED: null,
    EXPORT_READY: null,
    ICP_ADDED: null,
    TEAM_ACTIVITY: null,
  };

  const rows: { userId: string; type: NotificationType; payload: Prisma.InputJsonValue }[] = [];
  for (const u of users) {
    const prefs = parseJson<Record<string, boolean>>(u.notifPrefs, {});
    const t = notificationType(event, u);
    const pkey = prefsKey[t];
    if (pkey && !shouldDeliver(prefs, pkey)) continue;
    rows.push({
      userId: u.id,
      type: t,
      payload: toJson({ event: event.type, href: message.href, text: message.text }),
    });
  }

  if (rows.length === 0) return;
  await prisma.notification.createMany({ data: rows });
}
