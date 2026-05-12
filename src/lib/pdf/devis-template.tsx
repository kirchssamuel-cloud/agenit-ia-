import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

/**
 * Template PDF Devis — charte Kizzo (navy + orange).
 * Utilisé par le workflow devis-btp et toute autre génération de devis.
 *
 * @react-pdf/renderer est pure Node : marche en serverless Vercel sans
 * puppeteer/chromium (qui sont trop lourds pour fonctions Lambda).
 */

const KIZZO_NAVY = "#0F172A";
const KIZZO_ORANGE = "#F97316";
const SLATE_300 = "#CBD5E1";
const SLATE_500 = "#64748B";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    backgroundColor: WHITE,
    paddingTop: 0,
    paddingBottom: 30,
  },
  header: {
    backgroundColor: KIZZO_NAVY,
    color: WHITE,
    padding: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },
  brandTagline: {
    fontSize: 9,
    color: SLATE_300,
    marginTop: 4,
  },
  devisLabel: {
    fontSize: 10,
    color: KIZZO_ORANGE,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  devisNumber: {
    fontSize: 14,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 9,
    color: KIZZO_ORANGE,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  twoColumns: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    flex: 1,
    paddingRight: 20,
  },
  fieldLabel: {
    fontSize: 8,
    color: SLATE_500,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 11,
    color: KIZZO_NAVY,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: KIZZO_NAVY,
    color: WHITE,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_300,
  },
  tableCell: {
    flex: 2,
    fontSize: 10,
  },
  tableCellRight: {
    flex: 1,
    fontSize: 10,
    textAlign: "right",
  },
  tableHeaderCell: {
    flex: 2,
    fontSize: 9,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  tableHeaderCellRight: {
    flex: 1,
    fontSize: 9,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textAlign: "right",
  },
  totalsBlock: {
    marginTop: 20,
    marginHorizontal: 30,
    backgroundColor: "#F8FAFC",
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: KIZZO_ORANGE,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: SLATE_500,
  },
  totalValue: {
    fontSize: 10,
    color: KIZZO_NAVY,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE_300,
  },
  grandTotalLabel: {
    fontSize: 13,
    color: KIZZO_NAVY,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalValue: {
    fontSize: 16,
    color: KIZZO_ORANGE,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: SLATE_500,
  },
  conditions: {
    marginTop: 30,
    marginHorizontal: 30,
    fontSize: 9,
    color: SLATE_500,
    lineHeight: 1.5,
  },
});

export interface DevisData {
  numero: string;
  date: string;
  client: {
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
  };
  prestation: {
    type: string;
    gamme: string;
    surface: number;
    prixHtM2: number;
  };
  calcul: {
    sousTotal: number;
    marge: number;
    totalHt: number;
    tva: number;
    totalTtc: number;
  };
  emetteur?: {
    nom: string;
    siret?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
}

const DevisPdfDoc: React.FC<{ data: DevisData }> = ({ data }) => (
  <Document
    title={`Devis ${data.numero}`}
    author={data.emetteur?.nom ?? "Agenit-IA"}
  >
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>
            {data.emetteur?.nom ?? "Mon Entreprise"}
          </Text>
          <Text style={styles.brandTagline}>
            {data.emetteur?.email ?? ""}
            {data.emetteur?.telephone ? ` · ${data.emetteur.telephone}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.devisLabel}>DEVIS</Text>
          <Text style={styles.devisNumber}>{data.numero}</Text>
          <Text style={[styles.brandTagline, { marginTop: 4 }]}>
            Émis le {data.date}
          </Text>
        </View>
      </View>

      {/* Client */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adressé à</Text>
        <Text style={styles.fieldValue}>{data.client.nom}</Text>
        {data.client.email && (
          <Text style={styles.fieldLabel}>{data.client.email}</Text>
        )}
        {data.client.telephone && (
          <Text style={styles.fieldLabel}>{data.client.telephone}</Text>
        )}
        {data.client.adresse && (
          <Text style={styles.fieldLabel}>{data.client.adresse}</Text>
        )}
      </View>

      {/* Détail prestation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Détail de la prestation</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Description</Text>
            <Text style={styles.tableHeaderCellRight}>Quantité</Text>
            <Text style={styles.tableHeaderCellRight}>Prix unité HT</Text>
            <Text style={styles.tableHeaderCellRight}>Total HT</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>
              {capitalize(data.prestation.type)} {data.prestation.gamme} — pose
              et fournitures
            </Text>
            <Text style={styles.tableCellRight}>
              {data.prestation.surface} m²
            </Text>
            <Text style={styles.tableCellRight}>
              {data.prestation.prixHtM2.toFixed(2)} €
            </Text>
            <Text style={styles.tableCellRight}>
              {data.calcul.sousTotal.toFixed(2)} €
            </Text>
          </View>
        </View>
      </View>

      {/* Totaux */}
      <View style={styles.totalsBlock}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Sous-total</Text>
          <Text style={styles.totalValue}>
            {data.calcul.sousTotal.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Coefficient artisan ×{data.calcul.marge}
          </Text>
          <Text style={styles.totalValue}>
            {data.calcul.totalHt.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TVA (10%)</Text>
          <Text style={styles.totalValue}>
            {data.calcul.tva.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total TTC</Text>
          <Text style={styles.grandTotalValue}>
            {data.calcul.totalTtc.toFixed(2)} €
          </Text>
        </View>
      </View>

      {/* Conditions */}
      <View style={styles.conditions}>
        <Text>Validité du devis : 30 jours à compter de la date d&apos;émission.</Text>
        <Text>Acompte de 30% à la signature, solde à la fin des travaux.</Text>
        <Text>TVA applicable au taux de 10% (travaux d&apos;amélioration en résidence principale &gt; 2 ans).</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        {data.emetteur?.nom ?? "Mon Entreprise"}
        {data.emetteur?.siret ? ` · SIRET ${data.emetteur.siret}` : ""}
        {" · Devis généré par agent IA"}
      </Text>
    </Page>
  </Document>
);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Rend le PDF en Buffer Node — utilisable directement en attachment email
 * ou en upload sur Supabase Storage.
 */
export async function renderDevisPdf(data: DevisData): Promise<Buffer> {
  return renderToBuffer(<DevisPdfDoc data={data} />);
}
