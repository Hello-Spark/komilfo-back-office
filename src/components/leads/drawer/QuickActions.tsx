"use client";
import React, { useState } from "react";
import { formatPhoneHref } from "./utils";

interface Props {
  prenom: string;
  nom: string;
  email: string;
  tel: string;
  leadIdShort: string;
}

type IconProps = {
  className?: string;
  size?: number;
};

function IconPhone({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconSms({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconCopy({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export default function QuickActions({
  prenom,
  nom,
  email,
  tel,
  leadIdShort,
}: Props) {
  const [copied, setCopied] = useState(false);
  const telHref = formatPhoneHref(tel);
  const fullName = `${prenom} ${nom}`.trim();
  const mailSubject = encodeURIComponent(
    `Votre demande Komilfo #${leadIdShort}`
  );

  const handleCopy = async () => {
    const text = `${fullName}\n${email}\n${tel}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable; silently ignore.
    }
  };

  const baseBtn =
    "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-3 text-theme-xs font-medium text-gray-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-gray-900 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-white";

  return (
    <div className="grid grid-cols-4 gap-2">
      <a
        href={telHref ? `tel:${telHref}` : "#"}
        className={baseBtn}
        aria-label={`Appeler ${fullName}`}
        onClick={(e) => {
          if (!telHref) e.preventDefault();
        }}
      >
        <IconPhone className="shrink-0" />
        <span>Appeler</span>
      </a>
      <a
        href={`mailto:${email}?subject=${mailSubject}`}
        className={baseBtn}
        aria-label={`Envoyer un email à ${fullName}`}
      >
        <IconMail className="shrink-0" />
        <span>Email</span>
      </a>
      <a
        href={telHref ? `sms:${telHref}` : "#"}
        className={baseBtn}
        aria-label={`Envoyer un SMS à ${fullName}`}
        onClick={(e) => {
          if (!telHref) e.preventDefault();
        }}
      >
        <IconSms className="shrink-0" />
        <span>SMS</span>
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className={`${baseBtn} ${
          copied
            ? "!border-success-500 !bg-success-50 !text-success-600 dark:!bg-success-500/10"
            : ""
        }`}
        aria-label="Copier les coordonnées du lead"
      >
        {copied ? (
          <IconCheck className="shrink-0" />
        ) : (
          <IconCopy className="shrink-0" />
        )}
        <span>{copied ? "Copié !" : "Copier"}</span>
      </button>
    </div>
  );
}
