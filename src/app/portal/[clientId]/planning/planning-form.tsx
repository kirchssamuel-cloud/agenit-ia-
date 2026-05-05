"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Map as MapIcon,
  Clock,
  Car,
  CheckCircle2,
  AlertTriangle,
  Users,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SalesInput {
  id: string;
  name: string;
  homeAddress: string;
  email: string;
}

interface AppointmentInput {
  id: string;
  address: string;
  durationMinutes: number;
  assignedToSalesId: string; // "" = libre
}

interface RouteStep {
  appointmentId: string;
  address: string;
  startTime: string;
  endTime: string;
  driveMinutesFromPrev: number;
}
interface OptimizedRoute {
  salesId: string;
  salesName: string;
  steps: RouteStep[];
  totalDriveMinutes: number;
  unscheduledAppointmentIds: string[];
}
interface PlanningResult {
  ok: boolean;
  summary: string;
  durationMs: number;
  data?: {
    routes: OptimizedRoute[];
    unassigned: string[];
    warnings: string[];
  };
  error?: string;
}

const SAMPLE_SALES: SalesInput[] = [
  {
    id: "s1",
    name: "Marc",
    homeAddress: "10 rue de Rivoli, 75001 Paris",
    email: "marc@example.com",
  },
  {
    id: "s2",
    name: "Léa",
    homeAddress: "5 avenue de la République, 75011 Paris",
    email: "lea@example.com",
  },
];

const SAMPLE_APPOINTMENTS: AppointmentInput[] = [
  { id: "rdv1", address: "12 rue Saint-Antoine, 75004 Paris", durationMinutes: 60, assignedToSalesId: "" },
  { id: "rdv2", address: "45 boulevard Voltaire, 75011 Paris", durationMinutes: 60, assignedToSalesId: "" },
  { id: "rdv3", address: "8 rue de Belleville, 75019 Paris", durationMinutes: 45, assignedToSalesId: "" },
  { id: "rdv4", address: "1 place de la Bastille, 75004 Paris", durationMinutes: 60, assignedToSalesId: "" },
  { id: "rdv5", address: "100 rue de Vaugirard, 75006 Paris", durationMinutes: 60, assignedToSalesId: "" },
  { id: "rdv6", address: "20 rue de la Roquette, 75011 Paris", durationMinutes: 60, assignedToSalesId: "" },
];

export function PlanningForm({ clientId }: { clientId: string }) {
  const [sales, setSales] = useState<SalesInput[]>(SAMPLE_SALES);
  const [appointments, setAppointments] = useState<AppointmentInput[]>(SAMPLE_APPOINTMENTS);
  const [maxDrive, setMaxDrive] = useState(90);
  const [startTime, setStartTime] = useState("09:00");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Sales handlers ----
  const addSales = () =>
    setSales((prev) => [
      ...prev,
      { id: `s${prev.length + 1}`, name: "", homeAddress: "", email: "" },
    ]);
  const updateSales = (i: number, patch: Partial<SalesInput>) =>
    setSales((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeSales = (i: number) => {
    if (sales.length <= 1) return;
    setSales((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ---- Appointments handlers ----
  const addAppointment = () =>
    setAppointments((prev) => [
      ...prev,
      {
        id: `rdv${prev.length + 1}`,
        address: "",
        durationMinutes: 60,
        assignedToSalesId: "",
      },
    ]);
  const updateAppointment = (i: number, patch: Partial<AppointmentInput>) =>
    setAppointments((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  const removeAppointment = (i: number) => {
    if (appointments.length <= 1) return;
    setAppointments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    setError(null);
    setResult(null);

    // Validations simples
    const validSales = sales.filter((s) => s.name.trim());
    const validAppts = appointments.filter((a) => a.address.trim());
    if (validSales.length === 0) {
      setError("Ajoute au moins un commercial avec un nom.");
      return;
    }
    if (validAppts.length === 0) {
      setError("Ajoute au moins un RDV avec une adresse.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/portal/plan-tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          sales: validSales.map((s) => ({
            id: s.id,
            name: s.name,
            homeAddress: s.homeAddress || undefined,
            email: s.email || undefined,
          })),
          appointments: validAppts.map((a) => ({
            id: a.id,
            address: a.address,
            durationMinutes: a.durationMinutes,
            assignedToSalesId: a.assignedToSalesId || undefined,
          })),
          maxDriveMinutes: maxDrive,
          workingHoursStart: startTime,
        }),
      });
      const data = (await res.json()) as PlanningResult;
      setResult(data);
      if (!data.ok && data.error) setError(data.error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sales */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Tes commerciaux ({sales.length})
              </CardTitle>
              <CardDescription>
                Ajoute chaque commercial avec son adresse de départ (le matin).
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addSales}>
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {sales.map((s, i) => (
              <div
                key={s.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end rounded-md border border-border p-3"
              >
                <div className="md:col-span-3 grid gap-1.5">
                  <Label htmlFor={`sn-${i}`} className="text-xs">Nom</Label>
                  <Input
                    id={`sn-${i}`}
                    value={s.name}
                    onChange={(e) => updateSales(i, { name: e.target.value })}
                    placeholder="Marc"
                  />
                </div>
                <div className="md:col-span-5 grid gap-1.5">
                  <Label htmlFor={`sa-${i}`} className="text-xs">
                    Adresse de départ (matin)
                  </Label>
                  <Input
                    id={`sa-${i}`}
                    value={s.homeAddress}
                    onChange={(e) => updateSales(i, { homeAddress: e.target.value })}
                    placeholder="10 rue de Rivoli, 75001 Paris"
                  />
                </div>
                <div className="md:col-span-3 grid gap-1.5">
                  <Label htmlFor={`se-${i}`} className="text-xs">
                    Email (optionnel)
                  </Label>
                  <Input
                    id={`se-${i}`}
                    type="email"
                    value={s.email}
                    onChange={(e) => updateSales(i, { email: e.target.value })}
                    placeholder="marc@..."
                  />
                </div>
                <div className="md:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSales(i)}
                    disabled={sales.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Tes RDV à dispatcher ({appointments.length})
              </CardTitle>
              <CardDescription>
                Adresses des rendez-vous à répartir entre les commerciaux.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addAppointment}>
              <Plus className="size-4" /> Ajouter un RDV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {appointments.map((a, i) => (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end rounded-md border border-border p-3"
              >
                <div className="md:col-span-7 grid gap-1.5">
                  <Label htmlFor={`aa-${i}`} className="text-xs">Adresse du RDV</Label>
                  <Input
                    id={`aa-${i}`}
                    value={a.address}
                    onChange={(e) => updateAppointment(i, { address: e.target.value })}
                    placeholder="12 rue Saint-Antoine, 75004 Paris"
                  />
                </div>
                <div className="md:col-span-2 grid gap-1.5">
                  <Label htmlFor={`ad-${i}`} className="text-xs">Durée (min)</Label>
                  <Input
                    id={`ad-${i}`}
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    value={a.durationMinutes}
                    onChange={(e) =>
                      updateAppointment(i, {
                        durationMinutes: parseInt(e.target.value, 10) || 60,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2 grid gap-1.5">
                  <Label htmlFor={`as-${i}`} className="text-xs">
                    Affecter à
                  </Label>
                  <select
                    id={`as-${i}`}
                    value={a.assignedToSalesId}
                    onChange={(e) =>
                      updateAppointment(i, { assignedToSalesId: e.target.value })
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">Auto</option>
                    {sales
                      .filter((s) => s.name.trim())
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAppointment(i)}
                    disabled={appointments.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Paramètres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="start" className="text-xs">
                Heure de départ matin
              </Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="maxd" className="text-xs">
                Trajet max entre 2 RDV (minutes)
              </Label>
              <Input
                id="maxd"
                type="number"
                min={15}
                max={240}
                step={5}
                value={maxDrive}
                onChange={(e) => setMaxDrive(parseInt(e.target.value, 10) || 90)}
              />
              <span className="text-[11px] text-muted-foreground">
                Au-delà, le RDV est marqué non-planifiable.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          🔮 Bientôt : l&apos;agent ira chercher tes RDV directement dans ton CRM.
        </p>
        <Button onClick={submit} disabled={pending} size="lg">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Calcul en cours...
            </>
          ) : (
            <>
              <MapIcon className="size-4" /> Calculer les tournées
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {result?.ok && result.data ? <PlanningResults data={result.data} /> : null}
    </div>
  );
}

function PlanningResults({
  data,
}: {
  data: NonNullable<PlanningResult["data"]>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="size-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Tournées calculées</p>
            <p className="text-xs text-muted-foreground">
              {data.routes.length} commercial
              {data.routes.length > 1 ? "(aux)" : ""},{" "}
              {data.routes.reduce((s, r) => s + r.steps.length, 0)} RDV planifiés
              {data.unassigned.length > 0
                ? `, ${data.unassigned.length} non affectés`
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {data.warnings.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="size-5 mt-0.5 text-amber-500" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Avertissements</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.routes.map((route) => (
          <Card key={route.salesId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{route.salesName}</span>
                <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <Car className="size-3.5" />
                  {route.totalDriveMinutes} min total
                </div>
              </CardTitle>
              <CardDescription>
                {route.steps.length} RDV
                {route.unscheduledAppointmentIds.length > 0
                  ? ` · ${route.unscheduledAppointmentIds.length} non planifié(s)`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {route.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun RDV affecté à ce commercial.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {route.steps.map((step, i) => (
                    <div key={step.appointmentId} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                          {i + 1}
                        </div>
                        {i < route.steps.length - 1 ? (
                          <div className="my-1 w-0.5 flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 pb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {step.startTime} → {step.endTime}
                          {step.driveMinutesFromPrev > 0 ? (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Car className="size-3" /> {step.driveMinutesFromPrev} min
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{step.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
