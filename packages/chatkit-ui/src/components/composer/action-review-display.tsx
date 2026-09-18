import * as React from 'react';
import type { HITLReviewDisplay } from '@xpert-ai/chatkit-types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { resolveLocalizedText } from '../../i18n/localized-text';
import { JsonTreeView, toJsonValue } from '../thread/json-tree-view';
import { Button } from '../ui/button';

export function ActionReviewDisplay({ display, args }: { display: HITLReviewDisplay; args: unknown }) {
  const { t, i18n } = useChatkitTranslation();
  const [expanded, setExpanded] = React.useState(false);
  return <div className="min-w-0 space-y-3 text-sm">
    {display.sections.map((section, index) => <div key={index} className="min-w-0 space-y-2">
      <div className="font-medium">{resolveLocalizedText(section.label, i18n?.language)}</div>
      {section.type === 'text' && <p className="break-words">{resolveLocalizedText(section.text, i18n?.language)}</p>}
      {section.type === 'code' && <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/35 p-3 text-xs">{section.code}</pre>}
      {section.type === 'table' && <div className="max-h-32 overflow-auto rounded-md border border-border"><table className="w-full text-left text-xs">
        <thead><tr>{section.columns.map((column, i) => <th key={i} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium">{column}</th>)}</tr></thead>
        <tbody>{section.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="max-w-64 break-words border-b border-border px-3 py-2">{cell === null ? 'NULL' : String(cell)}</td>)}</tr>)}</tbody>
      </table></div>}
    </div>)}
    <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{t('composer.hitl.technicalDetails')}
    </Button>
    {expanded && <div className="max-h-56 overflow-auto rounded-md border border-border bg-muted/35"><JsonTreeView value={toJsonValue(args) ?? {}} /></div>}
  </div>;
}
