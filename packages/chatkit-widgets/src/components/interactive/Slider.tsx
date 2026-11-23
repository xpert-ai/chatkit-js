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

import { Slider as PrimitiveSlider, Label } from "@xpert-ai/chatkit-primitives";
import React, { useMemo, useCallback, useId, useState } from "react";
import { Types } from "@a2ui/lit/0.8";
import { useDataBinding } from "../../hooks/useDataBinding.js";
import { useTheme } from "../../context/ThemeContext.js";
import { cn, classMapToString } from "../../lib/utils.js";
import type { A2UIComponentProps } from "../../types/index.js";

interface SliderProps extends A2UIComponentProps {
  node: Types.AnyComponentNode & { type: "Slider" };
}

export function Slider({ node, surfaceId }: SliderProps) {
  const theme = useTheme();
  const id = useId();
  const { resolveString, resolveNumber, setValue } = useDataBinding(
    node,
    surfaceId
  );

  const properties = node.properties as {
    label?: { literalString?: string; path?: string };
    value?: { literalNumber?: number; path?: string };
    minValue?: number;
    maxValue?: number;
  };

  const label = resolveString(properties.label ?? null);
  const initialValue = resolveNumber(properties.value ?? null) ?? 0;
  const minValue = properties.minValue ?? 0;
  const maxValue = properties.maxValue ?? 100;
  const valuePath = properties.value?.path;

  const [value, setLocalValue] = useState(initialValue);

  const containerClasses = useMemo(() => {
    return classMapToString(theme.components.Slider.container);
  }, [theme]);

  const elementClasses = useMemo(() => {
    return classMapToString(theme.components.Slider.element);
  }, [theme]);

  const labelClasses = useMemo(() => {
    return classMapToString(theme.components.Slider.label);
  }, [theme]);

  const handleChange = useCallback(
    (values: number[]) => {
      const newValue = values[0] ?? minValue;
      setLocalValue(newValue);

      if (valuePath) {
        setValue(valuePath, newValue);
      }
    },
    [valuePath, setValue, minValue]
  );

  return (
    <div className={cn("ck-field", containerClasses)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className={cn(labelClasses)}>
            {label}
          </Label>
          <span className="text-sm text-muted-foreground">{value}</span>
        </div>
      )}
      <PrimitiveSlider
        id={id}
        aria-label={label ?? undefined}
        min={minValue}
        max={maxValue}
        value={[value]}
        onValueChange={handleChange}
        className={cn(elementClasses)}
      />
    </div>
  );
}
