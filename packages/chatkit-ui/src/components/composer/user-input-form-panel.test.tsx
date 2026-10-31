import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserInputFormPanel } from './user-input-form-panel';
import type { RequestUserInputForm } from '@xpert-ai/chatkit-types';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { density: 'compact' } }),
}));

const form: RequestUserInputForm = {
  schemaVersion: 1,
  mode: 'blocking',
  purpose: 'clarification',
  title: 'Analysis scope',
  fields: [
    { id: 'refunds', type: 'boolean', label: 'Refunds', required: true },
    { id: 'amount', type: 'number', label: 'Amount', required: true, min: 0 },
    {
      id: 'region',
      type: 'select',
      label: 'Region',
      options: [{ value: 'east', label: 'East' }],
    },
    { id: 'notes', type: 'textarea', label: 'Notes' },
  ],
};
describe('mixed user input form', () => {
  it('validates, preserves false and zero, and requires an explicit final submit', async () => {
    const onSubmit = vi.fn();
    render(<UserInputFormPanel form={form} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('composer.userInputForm.submit'));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Refunds' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(
      await screen.findByRole('option', { name: 'composer.hitl.false' }),
    );
    fireEvent.change(screen.getByLabelText('Amount *'), {
      target: { value: '0' },
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Region' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('option', { name: 'East' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('composer.userInputForm.submit'));
    fireEvent.click(screen.getByText('composer.userInputForm.submit'));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      refunds: false,
      amount: 0,
      region: 'east',
    });
  });
  it('cancels without submitting values', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(
      <UserInputFormPanel
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('composer.userInputForm.cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('allows an optional selection to be cleared without turning it into an answer', async () => {
    const onSubmit = vi.fn();
    render(
      <UserInputFormPanel
        form={{ ...form, fields: [form.fields[2]] }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Region' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('option', { name: 'East' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Region composer.userInputForm.clear',
      }),
    );
    fireEvent.click(screen.getByText('composer.userInputForm.submit'));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({});
  });
  it('collects dates, ranges and multiple selections without losing an endpoint', () => {
    const onSubmit = vi.fn();
    render(
      <UserInputFormPanel
        form={{
          ...form,
          fields: [
            {
              id: 'period',
              type: 'date_range',
              label: 'Period',
              required: true,
            },
            { id: 'due', type: 'date', label: 'Due' },
            {
              id: 'regions',
              type: 'multiselect',
              label: 'Regions',
              minItems: 1,
              options: [
                { value: 'east', label: 'East' },
                { value: 'west', label: 'West' },
              ],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(
      screen.getByLabelText('Period composer.userInputForm.start'),
      { target: { value: '2026-07-01' } },
    );
    fireEvent.change(
      screen.getByLabelText('Period composer.userInputForm.end'),
      { target: { value: '2026-09-30' } },
    );
    fireEvent.change(screen.getByLabelText('Due'), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(screen.getByLabelText('East'));
    fireEvent.click(screen.getByLabelText('West'));
    fireEvent.click(screen.getByText('composer.userInputForm.submit'));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      period: { start: '2026-07-01', end: '2026-09-30' },
      due: '2026-10-31',
      regions: ['east', 'west'],
    });
  });
});
