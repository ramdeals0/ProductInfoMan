import { describe, expect, it } from "vitest";
import { resolveAttributes, variantAxisKey } from "./index.js";

describe("resolveAttributes", () => {
  const schema = [
    { id: "a1", key: "brand", inheritFromParent: true },
    { id: "a2", key: "color", inheritFromParent: false },
    { id: "a3", key: "fabric", inheritFromParent: true },
  ];

  it("inherits parent values when child has no override", () => {
    const parent = [
      { attributeDefinitionId: "a1", key: "brand", value: "Acme", source: "LOCAL" as const },
      { attributeDefinitionId: "a3", key: "fabric", value: "Cotton", source: "LOCAL" as const },
    ];
    const child = [
      { attributeDefinitionId: "a2", key: "color", value: "Blue", source: "LOCAL" as const },
    ];

    const result = resolveAttributes(schema, parent, child);
    expect(result.find((r) => r.key === "brand")).toMatchObject({
      value: "Acme",
      source: "INHERITED",
    });
    expect(result.find((r) => r.key === "color")).toMatchObject({
      value: "Blue",
      source: "LOCAL",
    });
    expect(result.find((r) => r.key === "fabric")).toMatchObject({
      value: "Cotton",
      source: "INHERITED",
    });
  });

  it("uses overridden child values", () => {
    const parent = [
      { attributeDefinitionId: "a3", key: "fabric", value: "Cotton", source: "LOCAL" as const },
    ];
    const child = [
      { attributeDefinitionId: "a3", key: "fabric", value: "Linen", source: "OVERRIDDEN" as const },
    ];

    const result = resolveAttributes(schema, parent, child);
    expect(result.find((r) => r.key === "fabric")).toMatchObject({
      value: "Linen",
      source: "OVERRIDDEN",
    });
  });
});

describe("variantAxisKey", () => {
  it("builds composite key from axis values", () => {
    expect(variantAxisKey(["color", "size"], { color: "Blue", size: "M" })).toBe("Blue|M");
  });
});
