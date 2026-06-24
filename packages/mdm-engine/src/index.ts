export type NormalizedSourcePayload = {
  externalId?: string;
  sku?: string;
  title?: string;
  description?: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  attributes?: Record<string, unknown>;
};

export type MatchCandidateResult = {
  productId: string;
  matchScore: number;
  matchReason: string;
};

export type MatchContext = {
  sourceSystem: string;
  externalIdToProductId: Map<string, string>;
  gtinToProductId: Map<string, string>;
  brandMpnToProductId: Map<string, string>;
  skuToProductId: Map<string, string>;
};

export type SurvivorshipRuleConfig = {
  attributeCode: string;
  ruleType: "SOURCE_PRIORITY" | "MOST_RECENT" | "MOST_COMPLETE";
  ruleConfigJson: Record<string, unknown>;
};

export type SurvivorshipCandidate = {
  sourceSystem: string;
  value: unknown;
  updatedAt: string;
};

export type SurvivorshipOutcome = {
  attributeCode: string;
  value: unknown | null;
  winningSource: string | null;
  reason: string;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function brandMpnKey(brand: string, mpn: string): string {
  return `${normalizeKey(brand)}::${normalizeKey(mpn)}`;
}

export function normalizeSourcePayload(
  raw: Record<string, unknown>,
): NormalizedSourcePayload {
  const attributes =
    raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
      ? (raw.attributes as Record<string, unknown>)
      : {};

  const gtin =
    (raw.gtin as string | undefined) ??
    (raw.upc as string | undefined) ??
    (attributes.gtin as string | undefined) ??
    (attributes.upc as string | undefined);

  const mpn =
    (raw.mpn as string | undefined) ??
    (raw.manufacturer_part_number as string | undefined) ??
    (attributes.mpn as string | undefined);

  return {
    externalId:
      (raw.external_id as string | undefined) ??
      (raw.externalId as string | undefined) ??
      (raw.erp_id as string | undefined),
    sku: (raw.sku as string | undefined) ?? undefined,
    title: (raw.title as string | undefined) ?? undefined,
    description: (raw.description as string | undefined) ?? undefined,
    brand: (raw.brand as string | undefined) ?? undefined,
    gtin: gtin ? String(gtin) : undefined,
    mpn: mpn ? String(mpn) : undefined,
    attributes,
  };
}

export function findDeterministicMatches(
  payload: NormalizedSourcePayload,
  context: MatchContext,
): MatchCandidateResult[] {
  const candidates = new Map<string, MatchCandidateResult>();

  const addCandidate = (productId: string, matchReason: string) => {
    if (!candidates.has(productId)) {
      candidates.set(productId, { productId, matchScore: 1, matchReason });
    }
  };

  if (payload.externalId) {
    const productId = context.externalIdToProductId.get(
      `${context.sourceSystem}::${payload.externalId}`,
    );
    if (productId) addCandidate(productId, "exact_external_id");
  }

  if (payload.gtin) {
    const productId = context.gtinToProductId.get(normalizeKey(payload.gtin));
    if (productId) addCandidate(productId, "exact_gtin");
  }

  if (payload.brand && payload.mpn) {
    const productId = context.brandMpnToProductId.get(brandMpnKey(payload.brand, payload.mpn));
    if (productId) addCandidate(productId, "name_brand_match");
  }

  if (payload.sku) {
    const productId = context.skuToProductId.get(payload.sku);
    if (productId) addCandidate(productId, "exact_sku");
  }

  return [...candidates.values()];
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function completenessScore(value: unknown): number {
  if (!isPresent(value)) return 0;
  if (typeof value === "string") return value.trim().length;
  if (typeof value === "number" || typeof value === "boolean") return 1;
  return JSON.stringify(value).length;
}

export function applySurvivorshipRule(
  rule: SurvivorshipRuleConfig,
  candidates: SurvivorshipCandidate[],
  masterValue?: unknown,
): SurvivorshipOutcome {
  const presentCandidates = candidates.filter((candidate) => isPresent(candidate.value));

  if (rule.ruleType === "SOURCE_PRIORITY") {
    const priorities = (rule.ruleConfigJson.source_priority as string[] | undefined) ?? [];
    for (const source of priorities) {
      const match = presentCandidates.find((candidate) => candidate.sourceSystem === source);
      if (match) {
        return {
          attributeCode: rule.attributeCode,
          value: match.value,
          winningSource: match.sourceSystem,
          reason: `source_priority:${source}`,
        };
      }
    }
  }

  if (rule.ruleType === "MOST_RECENT" && presentCandidates.length > 0) {
    const winner = [...presentCandidates].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]!;
    return {
      attributeCode: rule.attributeCode,
      value: winner.value,
      winningSource: winner.sourceSystem,
      reason: "most_recent",
    };
  }

  if (rule.ruleType === "MOST_COMPLETE" && presentCandidates.length > 0) {
    const winner = [...presentCandidates].sort(
      (a, b) => completenessScore(b.value) - completenessScore(a.value),
    )[0]!;
    return {
      attributeCode: rule.attributeCode,
      value: winner.value,
      winningSource: winner.sourceSystem,
      reason: "most_complete",
    };
  }

  return {
    attributeCode: rule.attributeCode,
    value: masterValue ?? null,
    winningSource: null,
    reason: "no_candidate",
  };
}

export function resolveMatchStatus(
  candidates: MatchCandidateResult[],
): "matched" | "unmatched" | "ambiguous" {
  if (candidates.length === 0) return "unmatched";
  if (candidates.length === 1) return "matched";
  return "ambiguous";
}
