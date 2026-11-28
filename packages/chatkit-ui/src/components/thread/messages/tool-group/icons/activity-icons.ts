import {
  Blocks,
  Database,
  FileText,
  Globe,
  Images,
  ListTodo,
  PanelsTopLeft,
  Search,
  Wrench,
} from 'lucide-react';
import type { ToolActivityKind } from '@xpert-ai/chatkit-types';
import { CommandTerminalIcon } from './CommandTerminalIcon';

export const toolActivityIcons = {
  skill: Wrench,
  image: Images,
  file: FileText,
  data: Database,
  browser: Globe,
  command: CommandTerminalIcon,
  search: Search,
  content: PanelsTopLeft,
  task: ListTodo,
} satisfies Record<
  ToolActivityKind,
  typeof Wrench | typeof CommandTerminalIcon
>;
export const MixedToolActivityIcon = Blocks;
export const UnknownToolActivityIcon = Wrench;
