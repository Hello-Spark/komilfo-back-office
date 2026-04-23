import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function NotFound() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden bg-white dark:bg-gray-900 z-1">
      <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
        <Link href="/" className="mb-10 inline-block">
          <Image
            src="/images/logo/komilfo.svg"
            alt="Komilfo"
            width={180}
            height={54}
            className="dark:hidden"
          />
          <Image
            src="/images/logo/komilfo.svg"
            alt="Komilfo"
            width={180}
            height={54}
            className="hidden dark:block"
          />
        </Link>

        <h1 className="font-bold text-brand-500 text-[120px] leading-none sm:text-[180px]">
          404
        </h1>

        <h2 className="mt-4 mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-3xl">
          Page introuvable
        </h2>

        <p className="mb-8 text-base text-gray-600 dark:text-gray-400 sm:text-lg">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-6 py-3.5 text-sm font-medium text-brand-950 shadow-theme-xs transition hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:ring-offset-gray-900"
        >
          Retour à l&apos;accueil
        </Link>
      </div>

      <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
        &copy; {new Date().getFullYear()} Komilfo — Tous droits réservés
      </p>
    </div>
  );
}
