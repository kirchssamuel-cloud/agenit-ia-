/**
 * Banque de tests centralisée — registre de tous les domaines.
 *
 * Ajout d'un nouveau domaine :
 * 1. Créer src/data/test-bank/{domain}.ts qui exporte un DomainTestSuite
 * 2. L'importer ici et l'ajouter à TEST_BANK
 *
 * Le test runner et le dashboard découvrent automatiquement les domaines
 * via cette liste.
 */

import type { DomainTestSuite } from "./types";
import { FINANCE_SUITE } from "./finance";
import { BTP_SUITE } from "./btp";
import { COMPTABILITE_SUITE } from "./comptabilite";
import { JUDAISME_SUITE } from "./judaisme";
import { COMMERCIAL_SUITE } from "./commercial";

export const TEST_BANK: DomainTestSuite[] = [
  FINANCE_SUITE,
  BTP_SUITE,
  COMPTABILITE_SUITE,
  JUDAISME_SUITE,
  COMMERCIAL_SUITE,
];

export function getSuiteByDomain(domain: string): DomainTestSuite | undefined {
  return TEST_BANK.find((s) => s.domain === domain);
}

export function listDomains(): Array<{
  domain: string;
  name: string;
  emoji: string;
  questionCount: number;
}> {
  return TEST_BANK.map((s) => ({
    domain: s.domain,
    name: s.name,
    emoji: s.emoji,
    questionCount: s.questions.length,
  }));
}

export function getTotalQuestionCount(): number {
  return TEST_BANK.reduce((s, d) => s + d.questions.length, 0);
}

export type { TestQuestion, TestDifficulty, DomainTestSuite } from "./types";
