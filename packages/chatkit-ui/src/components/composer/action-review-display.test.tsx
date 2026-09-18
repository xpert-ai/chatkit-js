import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeHITLRequest, type HITLReviewDisplay } from '@xpert-ai/chatkit-types';
import { ActionReviewDisplay } from './action-review-display';
vi.mock('../../i18n/useChatkitTranslation', () => ({ useChatkitTranslation: () => ({ t: () => '技术详情', i18n: { language: 'zh-CN' } }) }));
const display: HITLReviewDisplay = {
  title: { en: 'Review', zh: '确认操作' }, summary: '摘要', sections: [
    { type: 'text', label: '范围', text: { en: 'One item', zh: '一项' } },
    { type: 'code', label: '内容', code: '<script>literal text</script>' },
    { type: 'table', label: '预览', columns: ['名称', '数量'], rows: [['项目', 2], [null, true]] },
  ],
};
const request = (metadata: unknown) => ({ actionRequests: [{ name: 'any_plugin_action', args: { id: 'original-id' }, display: metadata }], reviewConfigs: [{ actionName: 'any_plugin_action', allowedDecisions: ['approve'] }] });
describe('generic approval display', () => {
  it('preserves valid plugin display through normalization without changing arguments', () => {
    const normalized = normalizeHITLRequest(request(display));
    expect(normalized?.actionRequests[0].display).toEqual(display);
    expect(normalized?.actionRequests[0].args).toEqual({ id: 'original-id' });
  });
  it.each([undefined, { ...display, sections: [{ type: 'html', label: 'Unsafe', html: '<script />' }] }, { ...display, sections: [{ type: 'table', label: 'Rows', columns: ['a'], rows: [[{}]] }] }])('falls back to raw review for unsupported metadata', (metadata) => {
    const normalized = normalizeHITLRequest(request(metadata));
    expect(normalized).not.toBeNull();
    expect(normalized?.actionRequests[0].display).toBeUndefined();
  });
  it('renders localized text, literal code and table data and folds the original arguments', () => {
    render(<ActionReviewDisplay display={display} args={{ id: 'original-id' }} />);
    expect(screen.getByText('一项')).toBeInTheDocument();
    expect(screen.getByText('<script>literal text</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('项目')).toBeInTheDocument();
    expect(screen.queryByText(/original-id/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '技术详情' }));
    expect(screen.getByText(/original-id/)).toBeInTheDocument();
  });
});
