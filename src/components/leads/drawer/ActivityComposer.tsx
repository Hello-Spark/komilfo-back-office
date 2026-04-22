"use client";
import React, { useState } from "react";
import type { LogEventInput } from "@/hooks/useLeadsRealtime";

type ComposerType = "note" | "call" | "email" | "meeting" | "quote_sent";

type CallOutcome = "reached" | "no_answer" | "voicemail" | "busy" | "wrong_number";
type Direction = "outbound" | "inbound";

const TYPE_LABEL: Record<ComposerType, string> = {
  note: "Note",
  call: "Appel",
  email: "Email",
  meeting: "RDV",
  quote_sent: "Devis",
};

const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  reached: "A répondu",
  no_answer: "Pas de réponse",
  voicemail: "Messagerie",
  busy: "Occupé",
  wrong_number: "Mauvais numéro",
};

const DIRECTION_LABEL: Record<Direction, string> = {
  outbound: "Sortant",
  inbound: "Entrant",
};

interface Props {
  onSubmit: (event: LogEventInput) => Promise<void> | void;
}

function TypeIcon({ type }: { type: ComposerType }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { flexShrink: 0 },
    "aria-hidden": true,
  };
  switch (type) {
    case "note":
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "call":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "meeting":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "quote_sent":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
  }
}

function SendIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3 11.5 21 3l-8.5 18-2.5-7.5L3 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ActivityComposer({ onSubmit }: Props) {
  const [type, setType] = useState<ComposerType>("note");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type-specific state
  const [callOutcome, setCallOutcome] = useState<CallOutcome>("reached");
  const [callDirection, setCallDirection] = useState<Direction>("outbound");
  const [callDuration, setCallDuration] = useState<string>("");
  const [emailDirection, setEmailDirection] = useState<Direction>("outbound");
  const [emailSubject, setEmailSubject] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteRef, setQuoteRef] = useState("");

  const disabled = submitting || !canSubmit();

  function canSubmit(): boolean {
    switch (type) {
      case "note":
        return body.trim().length > 0;
      case "call":
        return true; // outcome is always set
      case "email":
        return emailSubject.trim().length > 0 || body.trim().length > 0;
      case "meeting":
        return meetingAt.trim().length > 0;
      case "quote_sent":
        return quoteAmount.trim().length > 0;
    }
  }

  function buildEvent(): LogEventInput | null {
    const trimmedBody = body.trim() || null;
    switch (type) {
      case "note":
        if (!trimmedBody) return null;
        return { type: "note", title: "Note ajoutée", body: trimmedBody };
      case "call": {
        const dur = callDuration ? Number(callDuration) : null;
        const title = callDirection === "outbound" ? "Appel passé" : "Appel reçu";
        return {
          type: "call",
          title,
          body: trimmedBody,
          details: {
            direction: callDirection,
            outcome: callOutcome,
            duration_min: dur && !Number.isNaN(dur) && dur > 0 ? dur : null,
          },
        };
      }
      case "email": {
        const subj = emailSubject.trim() || null;
        const title = emailDirection === "outbound" ? "Email envoyé" : "Email reçu";
        return {
          type: "email",
          title,
          body: trimmedBody,
          details: {
            direction: emailDirection,
            subject: subj,
          },
        };
      }
      case "meeting": {
        return {
          type: "meeting",
          title: `RDV planifié`,
          body: trimmedBody,
          details: {
            starts_at: meetingAt,
            location: meetingLocation.trim() || null,
          },
        };
      }
      case "quote_sent": {
        const amount = Number(quoteAmount);
        return {
          type: "quote_sent",
          title: `Devis envoyé`,
          body: trimmedBody,
          details: {
            amount_ht: !Number.isNaN(amount) ? amount : null,
            quote_ref: quoteRef.trim() || null,
          },
        };
      }
    }
  }

  function resetForm() {
    setBody("");
    setCallOutcome("reached");
    setCallDirection("outbound");
    setCallDuration("");
    setEmailDirection("outbound");
    setEmailSubject("");
    setMeetingAt("");
    setMeetingLocation("");
    setQuoteAmount("");
    setQuoteRef("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const event = buildEvent();
    if (!event) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(event);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur à l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const bodyPlaceholder: Record<ComposerType, string> = {
    note: "Ajouter une note (détails, contexte, rappel...)",
    call: "Notes de l'appel (sujet, suite à donner...)",
    email: "Résumé du mail / contenu (optionnel)",
    meeting: "Objet du RDV, notes de préparation...",
    quote_sent: "Commentaires sur le devis (optionnel)",
  };

  const types: ComposerType[] = ["note", "call", "email", "meeting", "quote_sent"];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.02]"
    >
      {/* Type picker */}
      <div className="mb-3 flex flex-wrap gap-1">
        {types.map((t) => {
          const active = t === type;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-theme-xs font-medium transition ${
                active
                  ? "border-brand-500 bg-brand-50 text-gray-900 dark:bg-brand-500/15 dark:text-brand-400"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              aria-pressed={active}
            >
              <TypeIcon type={t} />
              {TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      {/* Type-specific fields */}
      {type === "call" && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <SelectField
            label="Résultat"
            value={callOutcome}
            onChange={(v) => setCallOutcome(v as CallOutcome)}
            options={(Object.keys(CALL_OUTCOME_LABEL) as CallOutcome[]).map(
              (k) => ({ value: k, label: CALL_OUTCOME_LABEL[k] })
            )}
          />
          <SelectField
            label="Sens"
            value={callDirection}
            onChange={(v) => setCallDirection(v as Direction)}
            options={(["outbound", "inbound"] as Direction[]).map((k) => ({
              value: k,
              label: DIRECTION_LABEL[k],
            }))}
          />
          <InputField
            label="Durée (min)"
            type="number"
            min={0}
            value={callDuration}
            onChange={setCallDuration}
            placeholder="Optionnel"
            className="col-span-2"
          />
        </div>
      )}

      {type === "email" && (
        <div className="mb-3 flex flex-col gap-2">
          <SelectField
            label="Sens"
            value={emailDirection}
            onChange={(v) => setEmailDirection(v as Direction)}
            options={(["outbound", "inbound"] as Direction[]).map((k) => ({
              value: k,
              label: DIRECTION_LABEL[k],
            }))}
          />
          <InputField
            label="Sujet"
            value={emailSubject}
            onChange={setEmailSubject}
            placeholder="Sujet de l'email (optionnel)"
          />
        </div>
      )}

      {type === "meeting" && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <InputField
            label="Date & heure"
            type="datetime-local"
            value={meetingAt}
            onChange={setMeetingAt}
            required
          />
          <InputField
            label="Lieu"
            value={meetingLocation}
            onChange={setMeetingLocation}
            placeholder="Magasin, client, visio..."
          />
        </div>
      )}

      {type === "quote_sent" && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <InputField
            label="Montant HT (€)"
            type="number"
            min={0}
            value={quoteAmount}
            onChange={setQuoteAmount}
            placeholder="ex : 4590"
            required
          />
          <InputField
            label="Réf. devis"
            value={quoteRef}
            onChange={setQuoteRef}
            placeholder="Ex : Q-2026-042"
          />
        </div>
      )}

      {/* Body (shared) */}
      <label htmlFor="activity-body" className="sr-only">
        Notes
      </label>
      <textarea
        id="activity-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void handleSubmit(e as unknown as React.FormEvent);
          }
        }}
        rows={type === "note" ? 3 : 2}
        placeholder={bodyPlaceholder[type]}
        className="w-full resize-none rounded-lg border-0 bg-transparent px-0 py-0 text-theme-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
        disabled={submitting}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {error ? (
          <p className="text-theme-xs text-error-500">{error}</p>
        ) : (
          <p className="text-theme-xs text-gray-400 dark:text-gray-500">
            Cmd / Ctrl + Entrée pour publier
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-theme-xs font-semibold text-gray-900 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendIcon />
          {submitting ? "Publication..." : "Publier"}
        </button>
      </div>
    </form>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  min,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "datetime-local";
  required?: boolean;
  min?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
        {required && <span className="text-error-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        min={min}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-theme-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-theme-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
