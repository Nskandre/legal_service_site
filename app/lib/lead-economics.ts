export type LeadQualification = "unreviewed" | "target" | "non_target";
export type ConsultationStatus = "unreviewed" | "held" | "not_held";
export type ContractStatus = "unreviewed" | "signed" | "not_signed";

export function normalizeMarketingChannel(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function unitCost(spend: number, count: number) {
  if (!Number.isFinite(spend) || spend < 0 || !Number.isInteger(count) || count <= 0) return null;
  return Math.round((spend / count) * 100) / 100;
}
