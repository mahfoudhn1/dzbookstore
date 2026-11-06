import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export default async function Loading() {
  const { t } = await getT();
  return (
    <div className="bg-ivory" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("Chargement de la page…")}</span>

      <div className="border-b border-line bg-parchment">
        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-10 sm:px-6 lg:px-10 lg:pb-16">
          <div className="skeleton h-3 w-32" />
          <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <div className="skeleton h-3 w-44" />
              <div className="skeleton mt-4 h-14 w-[80%] max-w-xl" />
              <div className="skeleton mt-3 h-14 w-[55%] max-w-md" />
              <div className="skeleton mt-5 h-3 w-[70%] max-w-lg" />
            </div>
            <div className="skeleton h-[118px] w-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index}>
              <div className="skeleton aspect-[3/4] w-full" />
              <div className="skeleton mt-4 h-3 w-3/4" />
              <div className="skeleton mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>

        <div className="relative mt-16 flex items-center justify-center overflow-hidden border border-line bg-parchment px-6 py-10">
          <ZelligeField className="text-sea" opacity={0.035} />
          <div className="relative flex items-center gap-3 text-[9px] font-semibold uppercase tracking-label text-muted">
            <ZelligeStar className="h-4 w-4 text-brass/70" />
            {t("La librairie ouverte d’Algérie")}{' '}</div>
        </div>
      </div>
    </div>
  );
}
