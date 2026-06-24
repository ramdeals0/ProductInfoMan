import type { AttributeSource } from "@productinfoman/contracts";

export interface AttributeDefinitionRef {
  id: string;
  key: string;
  inheritFromParent: boolean;
}

export interface StoredAttributeValue {
  attributeDefinitionId: string;
  key: string;
  value: unknown;
  source: AttributeSource;
}

export interface ResolvedAttributeValue {
  attributeDefinitionId: string;
  key: string;
  value: unknown;
  source: AttributeSource;
}

export function resolveAttributes(
  schema: AttributeDefinitionRef[],
  parentValues: StoredAttributeValue[],
  childValues: StoredAttributeValue[],
): ResolvedAttributeValue[] {
  const parentByDefId = new Map(
    parentValues.map((v) => [v.attributeDefinitionId, v]),
  );
  const childByDefId = new Map(
    childValues.map((v) => [v.attributeDefinitionId, v]),
  );

  return schema.map((def) => {
    const child = childByDefId.get(def.id);

    if (child && (child.source === "LOCAL" || child.source === "OVERRIDDEN")) {
      return {
        attributeDefinitionId: def.id,
        key: def.key,
        value: child.value,
        source: child.source,
      };
    }

    if (def.inheritFromParent) {
      const parent = parentByDefId.get(def.id);
      if (parent) {
        return {
          attributeDefinitionId: def.id,
          key: def.key,
          value: parent.value,
          source: "INHERITED" as const,
        };
      }
    }

    if (child) {
      return {
        attributeDefinitionId: def.id,
        key: def.key,
        value: child.value,
        source: child.source,
      };
    }

    return {
      attributeDefinitionId: def.id,
      key: def.key,
      value: null,
      source: "LOCAL" as const,
    };
  });
}

export function variantAxisKey(
  axisKeys: string[],
  attributes: Record<string, unknown>,
): string {
  return axisKeys.map((k) => String(attributes[k] ?? "")).join("|");
}
