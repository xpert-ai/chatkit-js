import * as React from 'react';

const DisabledContext = React.createContext(false);
export function useControlsDisabled() {
  return React.useContext(DisabledContext);
}

/** A disabled form scope also governs controls without native fieldset semantics. */
export function Fieldset({
  disabled,
  children,
  ...props
}: React.ComponentProps<'fieldset'>) {
  const inherited = useControlsDisabled();
  const effectiveDisabled = inherited || Boolean(disabled);
  return (
    <DisabledContext.Provider value={effectiveDisabled}>
      <fieldset disabled={effectiveDisabled} {...props}>
        {children}
      </fieldset>
    </DisabledContext.Provider>
  );
}
