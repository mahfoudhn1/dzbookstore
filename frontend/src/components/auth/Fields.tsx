'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface BaseFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  required?: boolean;
  className?: string;
}

export function TextField({
  id,
  label,
  error,
  hint,
  icon: Icon,
  required,
  className,
  ...props
}: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft"
      >
        <span>
          {label}
          {required ? <span className="ml-1 text-clay">*</span> : null}
        </span>
        {hint ? <span className="font-medium normal-case tracking-normal text-muted">{hint}</span> : null}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        ) : null}
        <input
          id={id}
          className={cn(
            'h-11 w-full border border-line bg-ivory px-3 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-sea',
            Icon && 'pl-9',
            error && 'border-clay focus:border-clay',
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[10.5px] text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  error,
  hint,
  icon: Icon,
  required,
  className,
  ...props
}: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft"
      >
        <span>
          {label}
          {required ? <span className="ml-1 text-clay">*</span> : null}
        </span>
        {hint ? <span className="font-medium normal-case tracking-normal text-muted">{hint}</span> : null}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        ) : null}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cn(
            'h-11 w-full border border-line bg-ivory pl-3 pr-11 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-sea',
            Icon && 'pl-9',
            error && 'border-clay focus:border-clay',
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted transition-colors hover:text-sea"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[10.5px] text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  required,
  className,
  children,
  ...props
}: BaseFieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft"
      >
        {label}
        {required ? <span className="ml-1 text-clay">*</span> : null}
      </label>
      <select
        id={id}
        className={cn(
          'h-11 w-full border border-line bg-ivory px-3 text-[12.5px] text-ink outline-none transition-colors focus:border-sea',
          error && 'border-clay focus:border-clay',
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-1.5 text-[10.5px] text-clay">{error}</p> : null}
    </div>
  );
}

export function AuthAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 border px-3.5 py-3 text-[11.5px] leading-relaxed',
        tone === 'error' && 'border-clay/30 bg-clay/5 text-clay-deep',
        tone === 'success' && 'border-emerald-dz/25 bg-emerald-dz/5 text-emerald-dz',
        tone === 'info' && 'border-sea/20 bg-sea/5 text-sea',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
