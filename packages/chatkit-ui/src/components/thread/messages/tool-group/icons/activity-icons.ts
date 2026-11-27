import {
  Blocks,
  Database,
  FileText,
  Globe,
  ListTodo,
  PanelsTopLeft,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react';
import type { ToolActivityKind } from '@xpert-ai/chatkit-types';

export const toolActivityIcons = {
  skill: Wrench,
  file: FileText,
  data: Database,
  browser: Globe,
  command: SquareTerminal,
  search: Search,
  content: PanelsTopLeft,
  task: ListTodo,
} satisfies Record<ToolActivityKind, typeof Wrench>;
export const MixedToolActivityIcon = Blocks;
export const UnknownToolActivityIcon = Wrench;
