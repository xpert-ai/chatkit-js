import * as React from 'react';
import { Button } from '../../components/ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

// Keep a failed lazy import or editor render inside its own workbench tab.
export class NativeViewBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <ViewError /> : this.props.children;
  }
}

function ViewError() {
  const { t } = useChatkitTranslation();
  return (
    <div role="alert" className="space-y-3 p-6 text-sm">
      <p className="font-medium">{t('workbench.viewError.title')}</p>
      <p className="text-muted-foreground">
        {t('workbench.viewError.description')}
      </p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        {t('workbench.viewError.reload')}
      </Button>
    </div>
  );
}
