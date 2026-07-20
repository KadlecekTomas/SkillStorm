import { describe, expect, it } from "vitest";
import { vocative } from "@/lib/czech-vocative";

describe("vocative", () => {
  it("skloňuje jména končící na -a", () => {
    expect(vocative("Anička")).toBe("Aničko");
    expect(vocative("Kuba")).toBe("Kubo");
    expect(vocative("Jana")).toBe("Jano");
    expect(vocative("Terezka")).toBe("Terezko");
  });

  it("skloňuje běžné mužské koncovky", () => {
    expect(vocative("Ondřej")).toBe("Ondřeji");
    expect(vocative("Tomáš")).toBe("Tomáši");
    expect(vocative("Petr")).toBe("Petře");
    expect(vocative("Marek")).toBe("Marku");
    expect(vocative("Šimon")).toBe("Šimone");
    expect(vocative("Filip")).toBe("Filipe");
    expect(vocative("Jakub")).toBe("Jakube");
  });

  it("nechává nejistá a nesklonná jména beze změny", () => {
    expect(vocative("Jiří")).toBe("Jiří");
    expect(vocative("Lucie")).toBe("Lucie");
    expect(vocative("Karel")).toBe("Karel"); // -el je nejednoznačné → fallback
    expect(vocative("Karin")).toBe("Karin");
    expect(vocative("Ester")).toBe("Ester");
  });
});
