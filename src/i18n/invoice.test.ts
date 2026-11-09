import { describe, expect, it } from "vitest";
import { formatUsd } from "@/domain/money";
import { invoiceTexts, type InvoiceTextInput } from "./invoice";

const demo: InvoiceTextInput = { projectTitle: "Online ordering site", hours: 13, hourlyRateCents: 5000, roundedUp: false };
const rounded: InvoiceTextInput = { ...demo, hours: 12.5, roundedUp: true };

// The English lines as server/billing.ts wrote them before languages existed; every recorded PayPal answer used these.
function englishBefore(input: InvoiceTextInput) {
  const hours = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(input.hours);
  return {
    description: `Estimated ${hours} h at ${formatUsd(input.hourlyRateCents)}/h${input.roundedUp ? ", rounded up to the next $10" : ""}`,
    note: `Change order for ${input.projectTitle}. Not part of the agreed scope.`,
  };
}

describe("청구서 문구: 고객 언어별", () => {
  it("영어는 언어 기능 전의 문구와 한 글자도 다르지 않다", () => {
    const cases: InvoiceTextInput[] = [demo, rounded, { ...demo, hours: 0.25, hourlyRateCents: 7550 }, { ...demo, projectTitle: "Café & Bar" }];

    for (const input of cases) expect(invoiceTexts("en", input)).toEqual(englishBefore(input));
    expect(invoiceTexts("en", demo)).toEqual({
      description: "Estimated 13 h at $50/h",
      note: "Change order for Online ordering site. Not part of the agreed scope.",
    });
  });

  it("한국어는 합니다체 메모와 시간·시급 설명을 쓴다", () => {
    expect(invoiceTexts("ko", demo)).toEqual({
      description: "예상 작업 13시간 × 시간당 US$50",
      note: "Online ordering site 관련 추가 작업 청구서입니다. 처음 합의한 작업 범위에 포함되지 않은 항목입니다.",
    });
    expect(invoiceTexts("ko", rounded).description).toBe("예상 작업 12.5시간 × 시간당 US$50 (US$10 단위로 올림)");
  });

  it("일본어는 정중한 메모와 시간·시급 설명을 쓴다", () => {
    expect(invoiceTexts("ja", demo)).toEqual({
      description: "見積作業時間 13 時間 × 時給 $50",
      note: "Online ordering site の追加作業分のご請求です。当初合意した作業範囲には含まれておりません。",
    });
  });

  it("스페인어·포르투갈어는 그 언어의 소수점 표기로 시간을 쓴다", () => {
    expect(invoiceTexts("es", rounded)).toEqual({
      description: expect.stringMatching(/^Estimado: 12,5 h a 50\sUS\$\/h, redondeado al alza a múltiplos de 10\sUS\$$/),
      note: "Orden de cambio para Online ordering site. No forma parte del alcance acordado.",
    });
    expect(invoiceTexts("pt", rounded)).toEqual({
      description: expect.stringMatching(/^Estimativa: 12,5 h a US\$\s50\/h, arredondado para cima em múltiplos de US\$\s10$/),
      note: "Orçamento adicional para Online ordering site. Não faz parte do escopo combinado.",
    });
  });

  it("프로젝트 이름은 데이터라서 어느 언어에서도 번역하지 않고 그대로 넣는다", () => {
    const title = "Harbor & Pine {project} <b>site</b>";

    for (const locale of ["en", "ko", "ja", "es", "pt"] as const) {
      expect(invoiceTexts(locale, { ...demo, projectTitle: title }).note).toContain(title);
    }
  });
});
