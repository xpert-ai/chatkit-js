/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import React, { useMemo, useState, type ReactNode } from 'react';
import { Types } from '@a2ui/lit/0.8';
import { Dialog, DialogContent, DialogTitle, usePrimitiveLabels } from '@xpert-ai/chatkit-primitives';
import { useTheme } from '../../context/ThemeContext.js';
import { classMapToString } from '../../lib/utils.js';
import type { A2UIComponentProps } from '../../types/index.js';

interface ModalProps extends A2UIComponentProps {
  node: Types.AnyComponentNode & { type: 'Modal' };
  renderChild?: (node: Types.AnyComponentNode) => ReactNode;
}

export function Modal({ node, renderChild }: ModalProps) {
  const theme = useTheme();
  const labels = usePrimitiveLabels();
  const [isOpen, setIsOpen] = useState(false);
  const properties = node.properties as {
    entryPointChild?: Types.AnyComponentNode;
    contentChild?: Types.AnyComponentNode;
  };
  const { entryPointChild, contentChild } = properties;
  const elementClasses = useMemo(() => classMapToString(theme.components.Modal.element), [theme]);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
    {entryPointChild && renderChild && <div
      ref={triggerRef}
      role={entryPointChild.type === 'Button' ? undefined : 'button'}
      tabIndex={entryPointChild.type === 'Button' ? undefined : 0}
      onClick={() => setIsOpen(true)}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); setIsOpen(true);
        }
      }}
    >{renderChild(entryPointChild)}</div>}
    <DialogContent overlayClassName={classMapToString(theme.components.Modal.backdrop)} className={elementClasses} aria-describedby={undefined}
      onCloseAutoFocus={event => {
        event.preventDefault();
        (triggerRef.current?.querySelector<HTMLElement>('button') ?? triggerRef.current)?.focus();
      }}>
      <DialogTitle className="sr-only">{labels.dialog}</DialogTitle>
      {contentChild && renderChild?.(contentChild)}
    </DialogContent>
  </Dialog>;
}
