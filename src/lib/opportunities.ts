export const OPPORTUNITY_KINDS = [
  { value: "cofounder", label: "Co-founder" },
  { value: "collaborator", label: "Creative collaborator" },
  { value: "feedback", label: "Feedback" },
  { value: "client", label: "Clients or customers" },
  { value: "other", label: "Something else" },
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number]["value"];
export type PostKind = "post" | "opportunity";

export function isOpportunityKind(value: unknown): value is OpportunityKind {
  return OPPORTUNITY_KINDS.some((kind) => kind.value === value);
}

export function getOpportunityLabel(value: OpportunityKind | null) {
  return OPPORTUNITY_KINDS.find((kind) => kind.value === value)?.label ?? "Looking for";
}
