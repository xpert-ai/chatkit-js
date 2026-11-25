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

import { Label, NativeSelect } from "@xpert-ai/chatkit-primitives";
import React, { useId, useState } from "react";
import { Types } from "@a2ui/lit/0.8";
import { useDataBinding } from "../../hooks/useDataBinding.js";
import { defaultTheme, useTheme } from "../../context/ThemeContext.js";
import { cn, classMapToString } from "../../lib/utils.js";
import type { A2UIComponentProps } from "../../types/index.js";

import { ChoiceSelect } from "../ui/select.js";

interface StringValue {
  literalString?: string;
  path?: string;
}

interface Option {
  value?: string;
  label?: StringValue;
}

interface MultipleChoiceProps extends A2UIComponentProps {
  node: Types.AnyComponentNode & { type: "MultipleChoice" };
}

export function MultipleChoice({ node, surfaceId }: MultipleChoiceProps) {
  const theme = useTheme();
  const id = useId();
  const { resolveString, setValue, getValue } = useDataBinding(node, surfaceId);

  const properties = node.properties as {
    label?: { literalString?: string; path?: string };
    options?: Option[];
    selections?: { path?: string };
    maxAllowedSelections?: number;
  };

  const label = resolveString(properties.label ?? null);
  const options = properties.options ?? [];
  const selectionsPath = properties.selections?.path;
  const maxAllowedSelections = properties.maxAllowedSelections ?? 1;

  const [localSelections, setLocalSelections] = useState<string[]>([]);
  const data = selectionsPath ? getValue(selectionsPath) : localSelections;
  const selections = Array.isArray(data)
    ? (data as string[])
    : typeof data === "string"
      ? [data]
      : [];
  const isMultiple = maxAllowedSelections > 1;
  const styles = theme.components.MultipleChoice;
  const choices = options.map((option, index) => {
    const text = resolveString(option.label);
    return {
      value: option.value ?? text ?? "",
      label: text ?? option.value ?? `Option ${index + 1}`,
    };
  });

  function update(next: string[]) {
    if (selectionsPath) {
      setValue(selectionsPath, isMultiple ? next : next[0]);
    } else {
      setLocalSelections(next);
    }
  }

  return (
    <div className={cn("ck-field", classMapToString(styles.container))}>
      {label && (
        <Label htmlFor={id} className={cn(classMapToString(styles.label))}>
          {label}
        </Label>
      )}
      {isMultiple ? (
        <NativeSelect
          id={id}
          multiple
          value={selections}
          onChange={(event) =>
            update(
              Array.from(
                event.currentTarget.selectedOptions,
                (option) => option.value,
              ).slice(0, maxAllowedSelections),
            )
          }
          className={cn("ck-control min-h-24 rounded-chat-item border border-input bg-background text-sm text-foreground", classMapToString(styles.element))}
        >
          {choices.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <ChoiceSelect
          id={id}
          value={selections[0]}
          placeholder={
            (choices.find((option) => option.value === "") ?? choices[0])?.label
          }
          options={choices}
          onValueChange={(value) => update([value])}
          className={
            styles.element !== defaultTheme.components.MultipleChoice.element
              ? classMapToString(styles.element)
              : undefined
          }
        />
      )}
    </div>
  );
}
