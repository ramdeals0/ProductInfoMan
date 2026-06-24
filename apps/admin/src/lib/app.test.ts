import { describe, expect, it } from "vitest";

describe("admin app", () => {
  it("has a valid package name", () => {
    expect("@productinfoman/admin").toBeTruthy();
  });
});
