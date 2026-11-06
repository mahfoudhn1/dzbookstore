'use client';

import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function NewsletterForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  return done ? (
    <div className="flex items-center gap-2.5 border border-brass/40 px-4 py-3 text-[11.5px] text-ivory/80">
      <Check className="h-3.5 w-3.5 text-brass-light" />
      {t("Merci — votre adresse est bien notée.")}{' '}</div>
  ) : (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim()) setDone(true);
      }}
      className="flex w-full max-w-md border border-ivory/20 bg-ivory/[0.04] p-1"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        {t("Votre adresse e-mail")}{' '}</label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("votre@adresse.dz")}
        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[12px] text-ivory placeholder:text-ivory/35 focus:outline-none"
      />
      <button
        type="submit"
        className="flex h-10 shrink-0 items-center gap-2 bg-brass-light px-4 text-[9px] font-bold uppercase tracking-[0.12em] text-sea-deep transition-colors hover:bg-ivory"
      >
        {t("S’inscrire")}{' '}<ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
