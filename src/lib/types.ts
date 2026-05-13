// Shared TS string-literal types. With SQLite, these were stored as Prisma enums
// in Postgres; we now store them as plain strings on the model and constrain at
// the application boundary via these types and Zod.

export type Role = "ADMIN" | "MANAGER" | "REP" | "VIEWER";
export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type IcpStatus = "ACTIVE" | "ARCHIVED";

export type CriterionType = "STRING" | "NUMBER" | "BOOLEAN" | "ENUM" | "RANGE" | "URL";
export type MatchRule =
  | "EQUALS"
  | "CONTAINS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "BETWEEN"
  | "IN_LIST";

export type LeadSource =
  | "LINKEDIN"
  | "APOLLO"
  | "REFERRAL"
  | "EVENT"
  | "MANUAL"
  | "CSV"
  | "OTHER";
export type LeadStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type LostReason =
  | "NOT_INTERESTED"
  | "NO_BUDGET"
  | "WRONG_FIT"
  | "UNRESPONSIVE"
  | "COMPETITOR"
  | "OTHER";

export type ActivityType =
  | "CREATED"
  | "STAGE_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "SCORE_CHANGED"
  | "FIELD_EDITED"
  | "TAG_ADDED"
  | "TAG_REMOVED"
  | "NOTE_ADDED"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "ARCHIVED"
  | "RESTORED"
  | "DELETED"
  | "VIEWED"
  | "IMPORTED";
