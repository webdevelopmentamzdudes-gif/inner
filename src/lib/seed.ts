// Shared seed runner used by both the standalone CLI (prisma/seed.ts) and the
// Next.js instrumentation hook (src/instrumentation.ts). Idempotent — if users
// already exist, exits without touching anything.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

function defaultStages() {
  return [
    { name: "New", isWon: false, isLost: false, sortOrder: 0, isTerminal: false, stallThresholdDays: 3, color: "#94A3B8" },
    { name: "Researching", isWon: false, isLost: false, sortOrder: 1, isTerminal: false, stallThresholdDays: 5, color: "#64748B" },
    { name: "Qualified", isWon: false, isLost: false, sortOrder: 2, isTerminal: false, stallThresholdDays: 3, color: "#3FB6F0" },
    { name: "Contacted", isWon: false, isLost: false, sortOrder: 3, isTerminal: false, stallThresholdDays: 5, color: "#1E7FC4" },
    { name: "Engaged", isWon: false, isLost: false, sortOrder: 4, isTerminal: false, stallThresholdDays: 7, color: "#0A2540" },
    { name: "Meeting Booked", isWon: false, isLost: false, sortOrder: 5, isTerminal: false, stallThresholdDays: 14, color: "#F59E0B" },
    { name: "Won", isWon: true, isLost: false, sortOrder: 6, isTerminal: true, color: "#10B981" },
    { name: "Lost", isWon: false, isLost: true, sortOrder: 7, isTerminal: true, color: "#EF4444" },
  ];
}

const ICPS: {
  name: string;
  description: string;
  color: string;
  criteria: {
    label: string;
    fieldPath: string;
    dataType: string;
    matchRule: string;
    matchValue: object;
    weight: number;
  }[];
}[] = [
  {
    name: "ICP 1 — Mid-Market SaaS Buyer",
    description: "Illustrative placeholder per PRD §8.5. Replace with real Product Owner spec.",
    color: "#1E7FC4",
    criteria: [
      { label: "Annual Revenue", fieldPath: "annualRevenue", dataType: "RANGE", matchRule: "BETWEEN", matchValue: { min: 5_000_000, max: 50_000_000 }, weight: 25 },
      { label: "Headcount", fieldPath: "headcount", dataType: "RANGE", matchRule: "BETWEEN", matchValue: { min: 50, max: 500 }, weight: 20 },
      { label: "Industry", fieldPath: "industry", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["SaaS", "MarTech", "FinTech"] }, weight: 20 },
      { label: "Tech Stack", fieldPath: "custom_fields.tech_stack", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["HubSpot", "Salesforce"] }, weight: 15 },
      { label: "Decision Maker Identified", fieldPath: "custom_fields.decision_maker", dataType: "BOOLEAN", matchRule: "EQUALS", matchValue: { value: "true" }, weight: 15 },
      { label: "Geography", fieldPath: "geography", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["US", "CA", "UK"] }, weight: 5 },
    ],
  },
  {
    name: "ICP 2 — Enterprise FinServ",
    description: "Placeholder ICP. Banks, insurers, large fintech.",
    color: "#0A2540",
    criteria: [
      { label: "Annual Revenue", fieldPath: "annualRevenue", dataType: "NUMBER", matchRule: "GREATER_THAN", matchValue: { value: 100_000_000 }, weight: 35 },
      { label: "Industry", fieldPath: "industry", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["Banking", "Insurance", "FinTech", "FinServ"] }, weight: 30 },
      { label: "Headcount", fieldPath: "headcount", dataType: "NUMBER", matchRule: "GREATER_THAN", matchValue: { value: 1000 }, weight: 25 },
      { label: "Geography", fieldPath: "geography", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["US", "UK", "EU"] }, weight: 10 },
    ],
  },
  {
    name: "ICP 3 — DTC E-commerce",
    description: "Placeholder ICP. Direct-to-consumer brands $1M–$50M revenue.",
    color: "#F59E0B",
    criteria: [
      { label: "Annual Revenue", fieldPath: "annualRevenue", dataType: "RANGE", matchRule: "BETWEEN", matchValue: { min: 1_000_000, max: 50_000_000 }, weight: 30 },
      { label: "Industry", fieldPath: "industry", dataType: "STRING", matchRule: "CONTAINS", matchValue: { value: "ecommerce" }, weight: 25 },
      { label: "Headcount", fieldPath: "headcount", dataType: "RANGE", matchRule: "BETWEEN", matchValue: { min: 5, max: 200 }, weight: 20 },
      { label: "Has Shopify Store", fieldPath: "custom_fields.shopify", dataType: "BOOLEAN", matchRule: "EQUALS", matchValue: { value: "true" }, weight: 20 },
      { label: "Geography", fieldPath: "geography", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["US", "CA"] }, weight: 5 },
    ],
  },
  {
    name: "ICP 4 — Agency / Consultancy",
    description: "Placeholder ICP. Marketing, growth, and creative agencies.",
    color: "#10B981",
    criteria: [
      { label: "Industry", fieldPath: "industry", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["Marketing", "Advertising", "Agency", "Consulting"] }, weight: 35 },
      { label: "Headcount", fieldPath: "headcount", dataType: "RANGE", matchRule: "BETWEEN", matchValue: { min: 10, max: 250 }, weight: 25 },
      { label: "Has Existing Clients in Target Vertical", fieldPath: "custom_fields.target_vertical_clients", dataType: "BOOLEAN", matchRule: "EQUALS", matchValue: { value: "true" }, weight: 25 },
      { label: "Geography", fieldPath: "geography", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["US", "CA", "UK", "EU"] }, weight: 15 },
    ],
  },
  {
    name: "ICP 5 — Healthcare / Healthtech",
    description: "Placeholder ICP. Provider groups, clinics, and healthtech vendors.",
    color: "#EF4444",
    criteria: [
      { label: "Industry", fieldPath: "industry", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["Healthcare", "Healthtech", "Medical"] }, weight: 30 },
      { label: "Annual Revenue", fieldPath: "annualRevenue", dataType: "NUMBER", matchRule: "GREATER_THAN", matchValue: { value: 5_000_000 }, weight: 25 },
      { label: "Headcount", fieldPath: "headcount", dataType: "NUMBER", matchRule: "GREATER_THAN", matchValue: { value: 25 }, weight: 20 },
      { label: "HIPAA Compliant", fieldPath: "custom_fields.hipaa", dataType: "BOOLEAN", matchRule: "EQUALS", matchValue: { value: "true" }, weight: 15 },
      { label: "Geography", fieldPath: "geography", dataType: "ENUM", matchRule: "IN_LIST", matchValue: { values: ["US"] }, weight: 10 },
    ],
  },
];

export async function runSeed(prisma: PrismaClient): Promise<void> {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`Seed: ${existingUsers} user(s) already exist — skipping seed.`);
    return;
  }

  console.log("Seeding admin user…");
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      role: "ADMIN",
      hashedPassword: hashed,
      status: "ACTIVE",
    },
    update: { hashedPassword: hashed },
  });

  console.log("Seeding additional users…");
  const [manager, rep] = await Promise.all([
    prisma.user.upsert({
      where: { email: "manager@example.com" },
      create: {
        email: "manager@example.com",
        name: "Marcus Manager",
        role: "MANAGER",
        hashedPassword: await bcrypt.hash("ChangeMe123!", 10),
      },
      update: {},
    }),
    prisma.user.upsert({
      where: { email: "rep@example.com" },
      create: {
        email: "rep@example.com",
        name: "Sara Rep",
        role: "REP",
        hashedPassword: await bcrypt.hash("ChangeMe123!", 10),
      },
      update: {},
    }),
  ]);

  console.log("Seeding 5 placeholder ICPs…");
  for (const spec of ICPS) {
    const totalWeight = spec.criteria.reduce((s, c) => s + c.weight, 0);
    if (totalWeight !== 100) {
      throw new Error(`ICP ${spec.name} weights sum to ${totalWeight}, expected 100`);
    }
    await prisma.icp.upsert({
      where: { name: spec.name },
      create: {
        name: spec.name,
        description: spec.description,
        color: spec.color,
        status: "ACTIVE",
        createdById: admin.id,
        criteria: {
          create: spec.criteria.map((c, i) => ({
            label: c.label,
            fieldPath: c.fieldPath,
            dataType: c.dataType,
            matchRule: c.matchRule,
            matchValue: c.matchValue,
            weight: c.weight,
            sortOrder: i,
          })),
        },
        stages: { create: defaultStages() },
      },
      update: {},
    });
  }

  console.log("Seeding sample leads…");
  const icp1 = await prisma.icp.findUnique({
    where: { name: "ICP 1 — Mid-Market SaaS Buyer" },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });

  if (icp1) {
    const newStage = icp1.stages[0];
    const samples = [
      {
        companyName: "Acme Corp",
        companyWebsite: "https://acme.com",
        industry: "SaaS",
        geography: "US",
        headcount: 210,
        annualRevenue: BigInt(12_000_000),
        contactFirstName: "Jane",
        contactLastName: "Doe",
        contactTitle: "VP of Marketing",
        contactEmail: "jane@acme.com",
        leadSource: "LINKEDIN",
        customFields: { tech_stack: "HubSpot", decision_maker: "true" },
      },
      {
        companyName: "Globex Industries",
        companyWebsite: "https://globex.io",
        industry: "MarTech",
        geography: "CA",
        headcount: 80,
        annualRevenue: BigInt(8_000_000),
        contactEmail: "ops@globex.io",
        leadSource: "APOLLO",
        customFields: { tech_stack: "Salesforce", decision_maker: "false" },
      },
      {
        companyName: "Initech",
        companyWebsite: "https://initech.com",
        industry: "FinTech",
        geography: "Germany",
        headcount: 320,
        annualRevenue: BigInt(20_000_000),
        contactEmail: "leads@initech.com",
        leadSource: "REFERRAL",
        customFields: { tech_stack: "HubSpot", decision_maker: "true" },
      },
    ];
    for (const s of samples) {
      const { customFields, ...rest } = s;
      await prisma.lead.upsert({
        where: { uniq_icp_email: { icpId: icp1.id, contactEmail: rest.contactEmail! } },
        create: {
          ...rest,
          icpId: icp1.id,
          stageId: newStage.id,
          assignedToId: rep.id,
          createdById: manager.id,
          customFields,
        },
        update: {},
      });
    }
  }

  console.log("Computing initial scores…");
  const allLeads = await prisma.lead.findMany();
  const { scoreLead } = await import("./scoring");
  for (const l of allLeads) {
    const criteria = await prisma.icpCriterion.findMany({ where: { icpId: l.icpId } });
    const result = scoreLead(l, criteria);
    await prisma.lead.update({
      where: { id: l.id },
      data: { score: result.score, scoreBreakdown: result.breakdown },
    });
  }

  console.log("\n✅ Seed complete.");
  console.log(`  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Manager: manager@example.com / ChangeMe123!`);
  console.log(`  Rep:     rep@example.com / ChangeMe123!`);
}
