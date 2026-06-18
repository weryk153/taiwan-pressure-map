import { WEIGHTS } from '@/lib/score'
import { THRESHOLDS } from '@/lib/normalize'
import { RAW_LABEL, formatRaw } from '@/lib/metricMeta'
import { METRIC_KEYS } from '@/lib/types'

/** 計算方式（可展開）：攤開綜合指數的加權與各子指標的門檻換算依據。 */
export function Methodology() {
  return (
    <details className="border-t border-[var(--color-ink)]/15 px-6 py-4 bg-[var(--color-paper)]">
      <summary className="kicker cursor-pointer select-none">計算方式</summary>
      <div className="mt-3 flex flex-col gap-2.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
        <p>
          <span className="text-[var(--color-ink)]">綜合壓力指數</span> ＝ 五項子指標的加權平均。
          各子指標把原始值依「絕對門檻」換算成 0–100（低標→0、高標→100，超出裁切）；
          數值越高壓力越大，<span className="text-[var(--color-ink)]">醫療資源相反</span>（病床越少壓力越大）。
        </p>
        <ul className="flex flex-col gap-1">
          {METRIC_KEYS.map((k) => {
            const { lo, hi } = THRESHOLDS[k]
            return (
              <li key={k} className="flex items-baseline justify-between gap-2">
                <span>
                  {RAW_LABEL[k]}
                  <span className="text-[var(--color-ink-2)]/70">（權重 {Math.round(WEIGHTS[k] * 100)}%）</span>
                </span>
                <span className="font-display tabular-nums text-right text-[var(--color-ink)]">
                  {formatRaw(k, lo)} → {formatRaw(k, hi)}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-[11px] text-[var(--color-ink-2)]/70">
          門檻為先驗設定、可校準；原始統計來源見上方「資料來源」。
        </p>
      </div>
    </details>
  )
}
