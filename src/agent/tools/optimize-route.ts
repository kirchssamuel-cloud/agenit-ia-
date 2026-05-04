import { z } from "zod";
import { createHash } from "node:crypto";
import type { ToolDefinition } from "./types";

const appointmentSchema = z.object({
  id: z.string(),
  address: z.string(),
  /** Coordonnées (optionnel — sinon mock géocode déterministe) */
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Durée du RDV en minutes */
  durationMinutes: z.number().int().min(5).default(60),
  /** Préférence d'horaire (HH:mm) — non strict */
  preferredStart: z.string().optional(),
  /** Identifiant du commercial assigné (sinon assignation libre) */
  assignedToSalesId: z.string().optional(),
});

const salesSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Adresse de départ (matin) */
  homeAddress: z.string().optional(),
  homeLat: z.number().optional(),
  homeLng: z.number().optional(),
});

const inputSchema = z.object({
  appointments: z.array(appointmentSchema),
  sales: z.array(salesSchema),
  workingHoursStart: z.string().default("09:00"),
  maxDriveMinutesBetween: z.number().int().min(15).max(240).default(90),
  /** Vitesse moyenne en km/h pour estimer le temps de trajet */
  averageSpeedKmh: z.number().int().min(20).max(120).default(50),
});

interface RouteStep {
  appointmentId: string;
  address: string;
  startTime: string;
  endTime: string;
  driveMinutesFromPrev: number;
}

export interface OptimizedRoute {
  salesId: string;
  salesName: string;
  steps: RouteStep[];
  totalDriveMinutes: number;
  unscheduledAppointmentIds: string[];
}

export interface OptimizeRouteOutput {
  routes: OptimizedRoute[];
  unassignedAppointmentIds: string[];
  warnings: string[];
}

/**
 * Géocodage déterministe mock (lat/lng stables par adresse).
 * À remplacer par un vrai appel Google Routes / Mapbox quand on aura la clé.
 */
function mockGeocode(address: string): { lat: number; lng: number } {
  const hash = createHash("sha256").update(address.toLowerCase().trim()).digest();
  // France métropolitaine : lat 41-51, lng -5 à 9
  const lat = 41 + (hash[0] / 255) * 10;
  const lng = -5 + (hash[1] / 255) * 14;
  return { lat, lng };
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export const optimizeRouteTool: ToolDefinition<typeof inputSchema, OptimizeRouteOutput> = {
  id: "optimize-route",
  name: "Optimiser une tournée commerciale",
  description:
    "Affecte des RDV aux commerciaux (nearest-neighbor) en respectant la contrainte de temps de trajet max entre 2 RDV. Géocode auto si lat/lng manquants.",
  category: "utility",
  exposedToLLM: true,
  inputSchema,
  execute: async (input, ctx) => {
    const { appointments, sales, workingHoursStart, maxDriveMinutesBetween, averageSpeedKmh } =
      input;
    const warnings: string[] = [];

    // Géocode au besoin
    const geocoded = appointments.map((a) => {
      if (a.lat != null && a.lng != null) return a;
      const { lat, lng } = mockGeocode(a.address);
      return { ...a, lat, lng };
    });
    const salesGeocoded = sales.map((s) => {
      if (s.homeLat != null && s.homeLng != null) return s;
      const { lat, lng } = s.homeAddress
        ? mockGeocode(s.homeAddress)
        : { lat: 48.8566, lng: 2.3522 }; // Paris par défaut
      return { ...s, homeLat: lat, homeLng: lng };
    });

    // Pré-affectation : si assignedToSalesId, on respecte ; sinon round-robin
    const buckets = new Map<string, typeof geocoded>();
    for (const s of salesGeocoded) buckets.set(s.id, []);
    const unassigned: typeof geocoded = [];

    let rrIndex = 0;
    for (const a of geocoded) {
      if (a.assignedToSalesId && buckets.has(a.assignedToSalesId)) {
        buckets.get(a.assignedToSalesId)!.push(a);
      } else if (salesGeocoded.length > 0) {
        const target = salesGeocoded[rrIndex % salesGeocoded.length];
        buckets.get(target.id)!.push(a);
        rrIndex++;
      } else {
        unassigned.push(a);
      }
    }

    // Pour chaque commercial : nearest-neighbor depuis la base
    const routes: OptimizedRoute[] = [];
    for (const sales of salesGeocoded) {
      const bucket = buckets.get(sales.id) ?? [];
      const remaining = [...bucket];
      const steps: RouteStep[] = [];
      const unscheduled: string[] = [];

      let cur = { lat: sales.homeLat!, lng: sales.homeLng! };
      let curTime = workingHoursStart;
      let totalDrive = 0;

      while (remaining.length > 0) {
        // Trouve le RDV le plus proche
        let bestIdx = -1;
        let bestKm = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const dist = haversineKm(cur, {
            lat: remaining[i].lat!,
            lng: remaining[i].lng!,
          });
          if (dist < bestKm) {
            bestKm = dist;
            bestIdx = i;
          }
        }
        if (bestIdx === -1) break;

        const next = remaining.splice(bestIdx, 1)[0];
        const driveMinutes = Math.round((bestKm / averageSpeedKmh) * 60);

        if (steps.length > 0 && driveMinutes > maxDriveMinutesBetween) {
          warnings.push(
            `${sales.name} : RDV ${next.id} ignoré (trajet ${driveMinutes} min > max ${maxDriveMinutesBetween}).`,
          );
          unscheduled.push(next.id);
          continue;
        }

        const startTime = addMinutes(curTime, driveMinutes);
        const endTime = addMinutes(startTime, next.durationMinutes);

        steps.push({
          appointmentId: next.id,
          address: next.address,
          startTime,
          endTime,
          driveMinutesFromPrev: driveMinutes,
        });

        totalDrive += driveMinutes;
        cur = { lat: next.lat!, lng: next.lng! };
        curTime = endTime;
      }

      routes.push({
        salesId: sales.id,
        salesName: sales.name,
        steps,
        totalDriveMinutes: totalDrive,
        unscheduledAppointmentIds: unscheduled,
      });
    }

    ctx.log(
      "info",
      `Tournées calculées : ${routes.length} commerciaux, ${routes.reduce((s, r) => s + r.steps.length, 0)} RDV planifiés, ${unassigned.length} non affectés`,
      { warnings: warnings.length },
    );

    return {
      routes,
      unassignedAppointmentIds: unassigned.map((a) => a.id),
      warnings,
    };
  },
};
