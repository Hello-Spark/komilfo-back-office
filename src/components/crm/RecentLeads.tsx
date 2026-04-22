import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import {
  LEAD_COLUMN_BADGE_COLOR,
  LEAD_COLUMN_LABEL,
  columnForStatus,
} from "../leads/status";
import type { LeadFull } from "@/lib/supabase/types";

interface Props {
  leads: LeadFull[];
  isAdmin: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RecentLeads({ leads, isAdmin }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Derniers leads
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            {leads.length} lead{leads.length > 1 ? "s" : ""} les plus récents
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
          Aucun lead pour le moment.
        </p>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Lead
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Ville
                </TableCell>
                {isAdmin && (
                  <TableCell
                    isHeader
                    className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Magasin
                  </TableCell>
                )}
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Type
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Date
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Statut
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.map((lead) => {
                const col = columnForStatus(lead.status);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="py-3">
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {lead.prenom} {lead.nom}
                      </p>
                      <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                        {lead.email}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {lead.ville} · {lead.code_postal}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                        {lead.magasin_name ?? "—"}
                      </TableCell>
                    )}
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 uppercase">
                      {lead.type}
                    </TableCell>
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell className="py-3">
                      {col ? (
                        <Badge size="sm" color={LEAD_COLUMN_BADGE_COLOR[col]}>
                          {LEAD_COLUMN_LABEL[col]}
                        </Badge>
                      ) : (
                        <Badge size="sm" color="light">
                          {lead.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
