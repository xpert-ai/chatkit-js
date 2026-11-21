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

import { Tabs as PrimitiveTabs, TabsList, TabsTrigger, TabsContent, RadioGroup, RadioGroupItem, Label } from "@xpert-ai/chatkit-primitives";
import React, { useState, useMemo, type ReactNode } from "react";
import { Types } from "@a2ui/lit/0.8";
import { useSurfaceStyles } from "../../context/A2UIContext.js";
import { useTheme } from "../../context/ThemeContext.js";
import { cn, classMapToString } from "../../lib/utils.js";
import type { A2UIComponentProps } from "../../types/index.js";

interface TabItem {
  title?: { literalString?: string; path?: string };
  child?: Types.AnyComponentNode;
}

interface TabsProps extends A2UIComponentProps {
  node: Types.AnyComponentNode & { type: "Tabs" };
  renderChild?: (node: Types.AnyComponentNode) => ReactNode;
}

export function Tabs({ node, renderChild, surfaceId }: TabsProps) {
  const theme = useTheme();
  const radio = useSurfaceStyles(surfaceId)?.tabsVariant === "radio";
  const [activeIndex, setActiveIndex] = useState(0);

  const properties = node.properties as {
    tabItems?: TabItem[];
  };

  const tabItems = properties.tabItems ?? [];

  const containerClasses = useMemo(() => {
    return classMapToString(theme.components.Tabs.container);
  }, [theme]);

  const controlsClasses = useMemo(() => {
    return classMapToString(theme.components.Tabs.controls.all);
  }, [theme]);

  const selectedClasses = useMemo(() => {
    return classMapToString(theme.components.Tabs.controls.selected);
  }, [theme]);

  if (tabItems.length === 0) {
    return null;
  }

  if (radio) {
    return (
      <div className={containerClasses}>
        <RadioGroup value={String(activeIndex)} onValueChange={value => setActiveIndex(Number(value))}
          aria-label={tabItems.map(item => item.title?.literalString).join(" / ")}
          className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {tabItems.map((item, index) => <Label key={index} className="ck-checkbox-field">
            <RadioGroupItem value={String(index)} aria-label={item.title?.literalString} />
            {item.title?.literalString}
          </Label>)}
        </RadioGroup>
        <div className="mt-3" key={activeIndex}>
          {tabItems[activeIndex]?.child && renderChild?.(tabItems[activeIndex].child)}
        </div>
      </div>
    );
  }

  return (
    <PrimitiveTabs value={String(activeIndex)} onValueChange={value => setActiveIndex(Number(value))} className={containerClasses}>
      <TabsList className={controlsClasses}>
        {tabItems.map((item, index) => <TabsTrigger key={index} value={String(index)} className={cn(index === activeIndex && selectedClasses)}>
          {item.title?.literalString ?? `Tab ${index + 1}`}
        </TabsTrigger>)}
      </TabsList>
      {tabItems.map((item, index) => <TabsContent key={index} value={String(index)}>
        {item.child && renderChild?.(item.child)}
      </TabsContent>)}
    </PrimitiveTabs>
  );
}
