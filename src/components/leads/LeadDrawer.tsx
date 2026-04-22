"use client";
import React, { useEffect, useRef, useState } from "react";
import Badge from "../ui/badge/Badge";
import { columnForStatus } from "./status";
import type { LeadFull, LeadStatus } from "@/lib/supabase/types";
import QuickActions from "./drawer/QuickActions";
import StatusSelector from "./drawer/StatusSelector";
import AssigneeSelector from "./drawer/AssigneeSelector";
import ActivityTimeline from "./drawer/ActivityTimeline";
import ActivityComposer from "./drawer/ActivityComposer";
import type { LogEventInput } from "@/hooks/useLeadsRealtime";
import {
  ECHEANCE_LABEL,
  TRAVAUX_LABEL,
  HABITAT_LABEL,
  CRENEAU_LABEL,
  formatPhoneDisplay,
  formatPhoneHref,
} from "./drawer/utils";
import type { LeadCreneau } from "@/lib/supabase/types";

interface Props {
  lead: LeadFull | null;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (
    leadId: string,
    newStatus: LeadStatus,
    note?: string
  ) => Promise<void>;
  onLogEvent: (leadId: string, event: LogEventInput) => Promise<void>;
  onAssign: (leadId: string, profileId: string | null) => Promise<void>;
}

function priorityColor(
  priority: string
): "error" | "warning" | "light" | "info" {
  switch (priority) {
    case "urgent":
      return "error";
    case "high":
      return "warning";
    case "low":
      return "info";
    default:
      return "light";
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "Prioritaire";
    case "low":
      return "Faible";
    default:
      return "Normal";
  }
}

export default function LeadDrawer({
  lead,
  isAdmin,
  onClose,
  onStatusChange,
  onLogEvent,
  onAssign,
}: Props) {
  const open = !!lead;
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [topOffset, setTopOffset] = useState(76);

  // Measure the sticky admin header to anchor the drawer below it.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const header =
        document.querySelector<HTMLElement>("header.sticky") ??
        document.querySelector<HTMLElement>("header");
      if (header) {
        const h = Math.round(header.getBoundingClientRect().height);
        if (h > 0) setTopOffset(h);
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  // Focus close button on open + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  // Prevent background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ top: topOffset }}
        className={`fixed inset-x-0 bottom-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={lead ? `lead-drawer-title-${lead.id}` : undefined}
        aria-hidden={!open}
        style={{ top: topOffset, height: `calc(100vh - ${topOffset}px)` }}
        className={`fixed right-0 z-50 flex w-full max-w-xl flex-col bg-gray-50 shadow-2xl dark:bg-gray-950 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {lead && (
          <DrawerContent
            key={lead.id}
            lead={lead}
            isAdmin={isAdmin}
            column={columnForStatus(lead.status)}
            closeBtnRef={closeBtnRef}
            onClose={onClose}
            onStatusChange={onStatusChange}
            onLogEvent={onLogEvent}
            onAssign={onAssign}
          />
        )}
      </aside>
    </>
  );
}

interface ContentProps {
  lead: LeadFull;
  isAdmin: boolean;
  column: ReturnType<typeof columnForStatus>;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onStatusChange: (
    leadId: string,
    newStatus: LeadStatus,
    note?: string
  ) => Promise<void>;
  onLogEvent: (leadId: string, event: LogEventInput) => Promise<void>;
  onAssign: (leadId: string, profileId: string | null) => Promise<void>;
}

function DrawerContent({
  lead,
  isAdmin,
  column,
  closeBtnRef,
  onClose,
  onStatusChange,
  onLogEvent,
  onAssign,
}: ContentProps) {
  const [terminalSaving, setTerminalSaving] = useState<LeadStatus | null>(null);
  const titleId = `lead-drawer-title-${lead.id}`;
  const leadIdShort = lead.id.slice(0, 8).toUpperCase();
  const telHref = formatPhoneHref(lead.tel);

  const isTerminal = lead.status === "won" || lead.status === "lost";

  const handleStatusChange = async (
    newStatus: LeadStatus,
    note?: string
  ): Promise<void> => {
    await onStatusChange(lead.id, newStatus, note);
  };

  const handleLogEvent = async (event: LogEventInput): Promise<void> => {
    await onLogEvent(lead.id, event);
  };

  const handleAssign = async (profileId: string | null): Promise<void> => {
    await onAssign(lead.id, profileId);
  };

  const handleTerminal = async (target: LeadStatus) => {
    setTerminalSaving(target);
    try {
      await onStatusChange(lead.id, target);
    } finally {
      setTerminalSaving(null);
    }
  };

  const creneaux =
    lead.contact_creneaux && lead.contact_creneaux.length > 0
      ? lead.contact_creneaux
          .map((c: LeadCreneau) => CRENEAU_LABEL[c] ?? c)
          .join(", ")
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header (non-scroll) */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge size="sm" variant="solid" color="dark">
                {lead.type.toUpperCase()}
              </Badge>
              {column && <StatusSelector status={lead.status} onChange={handleStatusChange} />}
              <Badge size="sm" color={priorityColor(lead.priority)}>
                {priorityLabel(lead.priority)}
              </Badge>
            </div>
            <h2
              id={titleId}
              className="mt-2 truncate text-title-sm font-semibold text-gray-800 dark:text-white/90"
            >
              {lead.prenom} {lead.nom}
            </h2>
            <p className="mt-1 truncate text-theme-sm text-gray-500 dark:text-gray-400">
              {lead.ville} · {lead.code_postal}
              {isAdmin && lead.magasin_name ? ` · ${lead.magasin_name}` : ""}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fermer le panneau du lead"
            className="-mr-1 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-200"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="m5 5 10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Quick actions band (non-scroll) */}
      <div className="shrink-0 border-b border-gray-200 bg-white/95 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/95">
        <QuickActions
          prenom={lead.prenom}
          nom={lead.nom}
          email={lead.email}
          tel={lead.tel}
          leadIdShort={leadIdShort}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Assignation */}
        <section
          className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
          aria-labelledby={`assign-heading-${lead.id}`}
        >
          <h3
            id={`assign-heading-${lead.id}`}
            className="mb-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Assignation
          </h3>
          <AssigneeSelector
            assignedId={lead.assigned_to}
            assignedName={lead.assigned_name}
            onAssign={handleAssign}
          />
        </section>

        {/* Infos commerciales */}
        <section
          className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
          aria-labelledby={`infos-heading-${lead.id}`}
        >
          <h3
            id={`infos-heading-${lead.id}`}
            className="mb-4 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Infos commerciales
          </h3>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Email">
              <a
                href={`mailto:${lead.email}`}
                className="break-all text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {lead.email}
              </a>
            </Field>
            <Field label="Téléphone">
              {telHref ? (
                <a
                  href={`tel:${telHref}`}
                  className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {formatPhoneDisplay(lead.tel)}
                </a>
              ) : (
                <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                  {lead.tel}
                </span>
              )}
            </Field>
            <Field label="Localisation">
              <span className="text-theme-sm text-gray-800 dark:text-white/90">
                {lead.ville} ({lead.code_postal})
              </span>
            </Field>
            <Field label="Créneaux préférés">
              <span className="text-theme-sm text-gray-800 dark:text-white/90">
                {creneaux ?? "—"}
              </span>
            </Field>
            <Field label="Travaux">
              <span className="text-theme-sm text-gray-800 dark:text-white/90">
                {lead.travaux ? TRAVAUX_LABEL[lead.travaux] ?? lead.travaux : "—"}
              </span>
            </Field>
            <Field label="Habitat">
              <span className="text-theme-sm text-gray-800 dark:text-white/90">
                {lead.habitat ? HABITAT_LABEL[lead.habitat] ?? lead.habitat : "—"}
              </span>
            </Field>
            <Field label="Échéance">
              <span className="text-theme-sm text-gray-800 dark:text-white/90">
                {lead.echeance ? ECHEANCE_LABEL[lead.echeance] : "—"}
              </span>
            </Field>
            {isAdmin && (
              <Field label="Magasin">
                <span className="text-theme-sm text-gray-800 dark:text-white/90">
                  {lead.magasin_name ?? "Non assigné"}
                </span>
              </Field>
            )}
          </dl>

          {lead.produits && lead.produits.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Produits demandés
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.produits.map((p) => (
                  <Badge key={p.code} size="sm" color="light">
                    {p.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {lead.message && (
            <div className="mt-4">
              <p className="mb-2 text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Message du client
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-theme-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
                <p className="whitespace-pre-wrap">{lead.message}</p>
              </div>
            </div>
          )}

          {(lead.src || lead.campaign) && (
            <p className="mt-4 border-t border-dashed border-gray-200 pt-3 text-theme-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
              Source : {lead.src ?? "—"}
              {lead.campaign ? ` · Campagne : ${lead.campaign}` : ""}
              {" · ID : "}
              {leadIdShort}
            </p>
          )}
        </section>

        {/* Timeline */}
        <section
          className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
          aria-labelledby={`timeline-heading-${lead.id}`}
        >
          <h3
            id={`timeline-heading-${lead.id}`}
            className="mb-4 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Activité
          </h3>
          <ActivityTimeline leadId={lead.id} isAdmin={isAdmin} />
          <div className="mt-4">
            <ActivityComposer onSubmit={handleLogEvent} />
          </div>
        </section>

        {/* Bottom spacer so footer doesn't cover content */}
        <div className="h-4" aria-hidden="true" />
      </div>

      {/* Footer */}
      {!isTerminal && (
        <footer className="shrink-0 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTerminal("won")}
              disabled={terminalSaving !== null}
              className="flex-1 rounded-lg bg-success-500 px-3 py-2.5 text-theme-sm font-semibold text-white transition hover:bg-success-600 disabled:opacity-60"
            >
              {terminalSaving === "won" ? "..." : "Marquer Gagné"}
            </button>
            <button
              type="button"
              onClick={() => handleTerminal("lost")}
              disabled={terminalSaving !== null}
              className="flex-1 rounded-lg border border-error-500 bg-white px-3 py-2.5 text-theme-sm font-semibold text-error-600 transition hover:bg-error-50 disabled:opacity-60 dark:bg-transparent dark:text-error-400 dark:hover:bg-error-500/10"
            >
              {terminalSaving === "lost" ? "..." : "Marquer Perdu"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  );
}
