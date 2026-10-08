// Stable reason codes from the terminal protocol; never infer capabilities from error text.
export type TerminalRestriction =
  | 'computer_desktop_required'
  | 'unsupported_provider'
  | 'sandbox_disabled';

export function terminalRestriction(code: string): TerminalRestriction | null {
  switch (code) {
    case 'computer_desktop_required':
    case 'unsupported_provider':
    case 'sandbox_disabled':
      return code;
    default:
      return null;
  }
}

export const terminalRestrictionMessage = {
  computer_desktop_required: 'workbench.files.terminalComputerRequired',
  unsupported_provider: 'workbench.files.terminalUnsupported',
  sandbox_disabled: 'workbench.files.terminalSandboxDisabled',
} as const;
