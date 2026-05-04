import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClients, listClientModules, ensureLoaded } from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";
import { NewClientDialog } from "./new-client-dialog";

export default async function ClientsPage() {
  await ensureLoaded();
  const clients = listClients();

  return (
    <>
      <AdminTopbar
        title="Clients"
        description="Gérez vos clients et les modules qui leur sont attribués."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length > 1 ? "s" : ""} enregistré
            {clients.length > 1 ? "s" : ""}
          </p>
          <NewClientDialog />
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Modules actifs</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => {
                const cms = listClientModules(c.id).filter((m) => m.enabled);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.industry ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cms.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Aucun
                          </span>
                        ) : (
                          cms.map((cm) => {
                            const m = getModuleById(cm.moduleId);
                            return (
                              <Badge key={cm.moduleId} variant="secondary">
                                {m?.name ?? cm.moduleId}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.contactEmail}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${c.id}`}
                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        aria-label="Ouvrir"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    Aucun client. Cliquez sur « Nouveau client » pour commencer.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
