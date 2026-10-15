import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourceCommandShortcuts } from './ResourceCommandShortcuts';

const command = {
  skill: { bindingId: 'id', version: 'v1', skillKey: 'bom' },
  packageName: 'operations',
  description: 'BOM',
  command: { subcommands: { import: {}, update: {} } },
};
it('renders command/subcommand tags and dispatches the skill and literal subcommand separately', () => {
  const select = vi.fn();
  render(
    <ResourceCommandShortcuts
      commands={[command]}
      disabled={false}
      onSelect={select}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'bom/import' }));
  expect(select).toHaveBeenCalledWith(command, 'import');
  expect(screen.queryByRole('button', { name: 'bom' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'bom/update' }),
  ).toBeInTheDocument();
});
describe('plain command tags', () => {
  it('renders command only and honors disabled state', () => {
    const select = vi.fn();
    render(
      <ResourceCommandShortcuts
        commands={[{ ...command, command: {} }]}
        disabled
        onSelect={select}
      />,
    );
    const button = screen.getByRole('button', { name: 'bom' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(select).not.toHaveBeenCalled();
  });
});

it('uses descriptive labels for both levels without changing the dispatched skill key or subcommand', () => {
  const onSelect = vi.fn();
  const labeled = { ...command, command: { label: 'BOM 管理', subcommands: { plan: { label: '审核计划' } } } };
  render(<ResourceCommandShortcuts commands={[labeled]} disabled={false} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'BOM 管理/审核计划' }));
  expect(onSelect).toHaveBeenCalledWith(labeled, 'plan');
  expect(labeled.skill.skillKey).toBe('bom');
});
