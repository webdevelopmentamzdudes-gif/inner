// Resource type taxonomy + UI metadata. Centralized here so pages and
// the create form both read from one source.
export type ResourceType =
  | "PITCH_DECK"
  | "EMAIL_TEMPLATE"
  | "CALL_SCRIPT"
  | "REPORT_SOP"
  | "CONTRACT"
  | "PRICING"
  | "OTHER";

export type ResourceCategory = {
  type: ResourceType;
  label: string;
  description: string;
  // Whether the form should show a file upload input.
  supportsFile: boolean;
  // Whether the form should show a markdown body input.
  supportsBody: boolean;
};

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    type: "PITCH_DECK",
    label: "Pitch decks",
    description: "Slide decks tailored to this ICP. Multiple versions allowed.",
    supportsFile: true,
    supportsBody: true,
  },
  {
    type: "EMAIL_TEMPLATE",
    label: "Email templates",
    description: "Approved sequences and one-off email copy.",
    supportsFile: false,
    supportsBody: true,
  },
  {
    type: "CALL_SCRIPT",
    label: "Call scripts",
    description: "Talking points, objection handling, demo flows.",
    supportsFile: false,
    supportsBody: true,
  },
  {
    type: "REPORT_SOP",
    label: "Report / audit SOPs",
    description: "Process docs for building the report a lead asks for.",
    supportsFile: true,
    supportsBody: true,
  },
  {
    type: "CONTRACT",
    label: "Contract templates",
    description: "MSA, SOW, and other legal templates for this ICP.",
    supportsFile: true,
    supportsBody: true,
  },
  {
    type: "PRICING",
    label: "Pricing",
    description: "Standard pricing structures so reps don't freelance.",
    supportsFile: false,
    supportsBody: true,
  },
  {
    type: "OTHER",
    label: "Other",
    description: "Anything else useful for this ICP.",
    supportsFile: true,
    supportsBody: true,
  },
];

const byType: Record<string, ResourceCategory> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.type, c]),
);

export function getCategory(type: string): ResourceCategory {
  return byType[type] ?? byType.OTHER;
}

export const RESOURCE_TYPE_VALUES = RESOURCE_CATEGORIES.map((c) => c.type) as ResourceType[];
