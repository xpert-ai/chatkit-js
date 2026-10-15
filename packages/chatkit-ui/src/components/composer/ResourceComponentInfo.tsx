import type { RuntimeResourceCatalogItem } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function ResourceComponentInfo({
  component,
}: {
  component: RuntimeResourceCatalogItem['components'][number];
}) {
  const { t } = useChatkitTranslation();
  return (
    <div className="min-w-0 text-xs text-muted-foreground">
      <p>
        {component.kind === 'assistant_template' &&
          `${t('composer.resources.assistant_template')} · `}
        {component.title || component.key} ·{' '}
        {t(`composer.resources.${component.status}`)}
      </p>
      {component.description && (
        <p className="mt-1 whitespace-pre-wrap">{component.description}</p>
      )}
    </div>
  );
}
