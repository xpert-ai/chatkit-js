import { GroupMemberAvatar } from './GroupMemberAvatar';
import type { ChatGroupParticipant } from '@xpert-ai/xpert-sdk';
import { Users } from 'lucide-react';
import { ChatkitAvatar, normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import { cn } from '../../lib/utils';

export function GroupAvatar({
  members,
  className,
}: {
  members: ChatGroupParticipant[];
  className?: string;
}) {
  const active = members.filter((member) => member.active);
  const overflow = active.length > 4;
  const visible = active.slice(0, overflow ? 3 : 4);
  const slots = visible.length + Number(overflow);
  const positions =
    slots === 1
      ? ['left-[20%] top-[20%]']
      : slots === 2
        ? ['left-0 top-0', 'bottom-0 right-0']
        : [
            'left-0 top-0',
            'right-0 top-0',
            'bottom-0 left-0',
            'bottom-0 right-0',
          ];
  return (
    <div
      aria-hidden="true"
      data-slot="group-avatar"
      className={cn('relative size-10 shrink-0', className)}
    >
      {!slots && <Users className="size-full p-2 text-muted-foreground" />}
      {visible.map((member, index) => (
        <GroupMemberAvatar
          key={member.id}
          label={member.name}
          avatar={normalizeChatkitAvatar(member.avatar)}
          className={`absolute size-[56%] ring-2 ring-background ${positions[index]}`}
          fallbackClassName="text-[10px]"
        />
      ))}
      {overflow && (
        <ChatkitAvatar
          label={`+${active.length - 3}`}
          fallback={`+${active.length - 3}`}
          className="absolute bottom-0 right-0 size-[48%]"
          fallbackClassName="bg-background text-[10px] font-semibold text-muted-foreground"
        />
      )}
    </div>
  );
}
