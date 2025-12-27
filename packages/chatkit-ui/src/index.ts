export { Chat } from './components/chat';
export type { ChatProps } from './components/chat';

export { Button } from './components/ui/button';
export { Input } from './components/ui/input';
export { ScrollArea, ScrollBar } from './components/ui/scroll-area';
export { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
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
export { useParentMessenger } from './hooks/useParentMessenger';
export type { ParentMessenger } from './hooks/useParentMessenger';
export {
  getLanguage as getChatkitLanguage,
  setLanguage as setChatkitLanguage,
  supportedLocales as chatkitSupportedLocales,
} from './i18n';
