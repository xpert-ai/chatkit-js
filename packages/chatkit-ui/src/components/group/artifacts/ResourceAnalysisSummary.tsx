import type { ResourceAnalysisPolicy } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

/** Generic resource capability summary; no dashboard-specific fields or behavior. */
export function ResourceAnalysisSummary({
  policy,
}: {
  policy: ResourceAnalysisPolicy;
}) {
  const { t } = useChatkitTranslation();
  return (
    <div className="space-y-2 text-sm">
      <p>
        {t(
          policy.mode === 'explore'
            ? 'group.artifacts.analysisExplore'
            : 'group.artifacts.analysisBindings',
        )}
      </p>
      <p className="text-muted-foreground">
        {t('group.artifacts.analysisAudience')}
      </p>
      <ul className="space-y-1">
        {policy.datasets.map((dataset) => (
          <li key={dataset.key} className="break-words">
            {dataset.key}: {dataset.fields.join(', ')}
            {dataset.filters.map((filter, index) => (
              <p key={index} className="text-muted-foreground">
                {filter.field} {filter.operator}{' '}
                {filter.values.map((value) => String(value)).join(', ')}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        {t('group.artifacts.analysisLimits', { rows: policy.maxRows })} ·{' '}
        {t(
          policy.allowDetails
            ? 'group.artifacts.detailsAllowed'
            : 'group.artifacts.aggregatesOnly',
        )}
      </p>
    </div>
  );
}
