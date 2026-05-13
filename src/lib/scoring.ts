import type { IcpCriterion, Lead } from "@prisma/client";
import { parseJson } from "./json";

// Per PRD §11: each criterion contributes its full weight if met, else 0.
// Missing data contributes 0 and is flagged. Score = sum of contributions (0–100).

export type ScoreBreakdownItem = {
  criterionId: string;
  label: string;
  weight: number;
  met: boolean;
  missing: boolean;
};

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdownItem[];
  hasMissingData: boolean;
};

function getFieldValue(lead: Lead, path: string): unknown {
  if (path.startsWith("custom_fields.")) {
    const key = path.slice("custom_fields.".length);
    const cf = parseJson<Record<string, unknown>>(lead.customFields, {});
    return cf[key];
  }
  // Map snake_case PRD field names to Prisma camelCase
  const map: Record<string, keyof Lead> = {
    company_name: "companyName",
    company_website: "companyWebsite",
    industry: "industry",
    geography: "geography",
    headcount: "headcount",
    annual_revenue: "annualRevenue",
    contact_email: "contactEmail",
    contact_title: "contactTitle",
    contact_linkedin: "contactLinkedin",
    lead_source: "leadSource",
  };
  const key = (map[path] ?? path) as keyof Lead;
  return lead[key];
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function evaluate(rule: string, leadValue: unknown, matchValue: Record<string, unknown>): boolean {
  switch (rule) {
    case "EQUALS":
      return String(leadValue) === String(matchValue.value);
    case "CONTAINS": {
      if (typeof leadValue !== "string" || typeof matchValue.value !== "string") return false;
      return leadValue.toLowerCase().includes(matchValue.value.toLowerCase());
    }
    case "GREATER_THAN":
      return Number(leadValue) > Number(matchValue.value);
    case "LESS_THAN":
      return Number(leadValue) < Number(matchValue.value);
    case "BETWEEN": {
      const n = Number(leadValue);
      const min = Number(matchValue.min);
      const max = Number(matchValue.max);
      if (Number.isNaN(n) || Number.isNaN(min) || Number.isNaN(max)) return false;
      return n >= min && n <= max;
    }
    case "IN_LIST": {
      const arr = Array.isArray(matchValue.values) ? matchValue.values : [];
      if (typeof leadValue === "string") {
        return arr.some(
          (v) => typeof v === "string" && v.toLowerCase() === leadValue.toLowerCase(),
        );
      }
      return arr.includes(leadValue as never);
    }
    default:
      return false;
  }
}

export function scoreLead(lead: Lead, criteria: IcpCriterion[]): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];
  let total = 0;
  let anyMissing = false;

  for (const c of criteria) {
    const v = getFieldValue(lead, c.fieldPath);
    const missing = isMissing(v);
    const mv = parseJson<Record<string, unknown>>(c.matchValue, {});
    const met = !missing && evaluate(c.matchRule, v, mv);
    if (met) total += c.weight;
    if (missing) anyMissing = true;
    breakdown.push({
      criterionId: c.id,
      label: c.label,
      weight: met ? c.weight : 0,
      met,
      missing,
    });
  }

  return {
    score: Math.min(100, Math.max(0, total)),
    breakdown,
    hasMissingData: anyMissing,
  };
}
