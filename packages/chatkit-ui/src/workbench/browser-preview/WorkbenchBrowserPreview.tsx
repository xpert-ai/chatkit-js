import * as React from 'react';
import type { WorkbenchPreview } from '../client-command-payload';
import type { RecentWorkbenchPreview } from '../useWorkbenchPages';
import { WorkbenchPreviewContent } from '../WorkbenchPreview';
import {
  WorkbenchAddressBar,
  type BrowserNavigation,
} from './WorkbenchAddressBar';

export function WorkbenchBrowserPreview({
  preview,
  recent,
  navigation,
  apiUrl,
  onNavigate,
}: {
  preview: WorkbenchPreview;
  recent: RecentWorkbenchPreview[];
  navigation: BrowserNavigation;
  apiUrl: string;
  onNavigate: (preview: WorkbenchPreview) => void;
}) {
  const [value, setValue] = React.useState(preview.url);
  const [revision, reload] = React.useReducer((version) => version + 1, 0);
  React.useEffect(() => setValue(preview.url), [preview.url]);
  const navigate = (next: WorkbenchPreview) => {
    setValue(next.url);
    if (next.url === preview.url) reload();
    else onNavigate(next);
  };
  return (
    <WorkbenchPreviewContent
      preview={preview}
      reloadKey={revision}
      toolbar={
        <WorkbenchAddressBar
          value={value}
          onChange={setValue}
          currentUrl={preview.url}
          apiUrl={apiUrl}
          navigation={navigation}
          onReload={reload}
          onOpen={navigate}
          suggestions={recent
            .filter(({ preview }) => preview.kind === 'browser')
            .map(({ preview }) => ({
              key: preview.key,
              title: preview.title,
              detail: preview.url,
              history: true,
              onSelect: () => navigate(preview),
            }))}
        />
      }
    />
  );
}
