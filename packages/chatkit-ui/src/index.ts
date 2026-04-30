export { Chat } from './components/chat';
export type { ChatProps } from './components/chat';

export { Button } from './components/ui/button';
export { Input } from './components/ui/input';
export { ScrollArea, ScrollBar } from './components/ui/scroll-area';
export { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
export {
  ChatkitAvatar,
  extractAssistantAvatar,
  getAvatarFallback,
  normalizeChatkitAvatar,
} from './components/ui/chatkit-avatar';
export type {
  ChatkitAvatarData,
  ChatkitAvatarProps,
} from './components/ui/chatkit-avatar';
export { IconDefinitionRenderer } from './components/ui/icon-definition';
export type { IconDefinitionRendererProps } from './components/ui/icon-definition';
export { Badge } from './components/ui/badge';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/ui/card';
export { Separator } from './components/ui/separator';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
export { ParentMessengerProvider } from './providers/ParentMessenger';
export { useParentMessenger } from './hooks/useParentMessenger';
export type {
  ParentMessenger,
  ParentMessengerProviderProps,
} from './providers/ParentMessenger';
export { ThemeProvider, useTheme } from './providers/Theme';
export type { ThemeProviderProps } from './providers/Theme';
export {
  getLanguage as getChatkitLanguage,
  setLanguage as setChatkitLanguage,
  supportedLocales as chatkitSupportedLocales,
} from './i18n';
