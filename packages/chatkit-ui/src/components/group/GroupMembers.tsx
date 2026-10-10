import { GroupMemberAvatar } from './GroupMemberAvatar';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  Client,
  ChatGroupCandidate,
  ChatGroupSnapshot,
} from '@xpert-ai/xpert-sdk';
import { Button } from '../ui/button';
import { normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from '../ui/command';

export function GroupMembers({
  client,
  group,
  onError,
}: {
  client: Client;
  group: ChatGroupSnapshot;
  onError: (error: unknown) => void;
}) {
  const { t } = useChatkitTranslation();
  const id = useId();
  const [kind, setKind] = useState<'user' | 'assistant'>('user');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChatGroupCandidate | null>(null);
  const [candidates, setCandidates] = useState<ChatGroupCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const owner =
    group.members.find((member) => member.id === group.viewerParticipantId)
      ?.role === 'owner';
  const eligible = (candidate: ChatGroupCandidate) =>
    !group.members.some(
      (member) =>
        member.active &&
        member.kind === candidate.kind &&
        member.subjectId === candidate.subjectId,
    );
  useEffect(() => {
    if (!owner || !open) return;
    const controller = new AbortController();
    setLoading(true);
    setCandidates([]);
    const timer = setTimeout(() => {
      void client.groups
        .candidates(
          { kind, search, groupId: group.id },
          { signal: controller.signal },
        )
        .then((rows) => {
          if (!controller.signal.aborted) setCandidates(rows);
        })
        .catch((error) => {
          if (!controller.signal.aborted) onError(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, group.id, owner, kind, search, open]);
  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!selected || !eligible(selected) || inviting) return;
    setInviting(true);
    try {
      await client.groups.addMember(group.id, {
        kind: selected.kind,
        subjectId: selected.subjectId,
      });
      setSelected(null);
      setSearch('');
    } catch (error) {
      onError(error);
    } finally {
      setInviting(false);
    }
  }
  async function remove(memberId: string) {
    if (removing) return;
    setRemoving(memberId);
    try {
      await client.groups.removeMember(group.id, memberId);
    } catch (error) {
      onError(error);
    } finally {
      setRemoving(null);
    }
  }
  const changeKind = (value: string) => {
    setKind(value === 'assistant' ? 'assistant' : 'user');
    setSelected(null);
    setSearch('');
    setCandidates([]);
    setOpen(false);
  };
  return (
    <Tabs value={kind} onValueChange={changeKind}>
      <TabsList
        className="grid w-full grid-cols-2"
        aria-label={t('group.memberKind')}
        onKeyDown={(event) => {
          if (
            inviting ||
            !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
          )
            return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 'user'
              : event.key === 'End'
                ? 'assistant'
                : kind === 'user'
                  ? 'assistant'
                  : 'user';
          changeKind(next);
          document.getElementById(`${id}-${next}-tab`)?.focus();
        }}
      >
        {(['user', 'assistant'] as const).map((value) => (
          <TabsTrigger
            key={value}
            value={value}
            id={`${id}-${value}-tab`}
            aria-controls={`${id}-${value}-panel`}
            tabIndex={kind === value ? 0 : -1}
            disabled={inviting}
          >
            {t(value === 'user' ? 'group.person' : 'group.assistant')}
            <span className="ml-2 text-xs text-muted-foreground">
              {
                group.members.filter(
                  (member) => member.active && member.kind === value,
                ).length
              }
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        value={kind}
        id={`${id}-${kind}-panel`}
        aria-labelledby={`${id}-${kind}-tab`}
      >
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {group.members
            .filter((member) => member.active && member.kind === kind)
            .map((member) => (
              <div
                key={member.id}
                className="flex min-w-0 items-center justify-between gap-2 py-1 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <GroupMemberAvatar
                    label={member.name}
                    avatar={normalizeChatkitAvatar(member.avatar)}
                    className="size-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="block truncate font-medium">
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(
                        member.kind === 'assistant'
                          ? member.subjectId === group.xpertId
                            ? 'group.primaryAssistant'
                            : 'group.otherAssistant'
                          : 'group.person',
                      )}
                    </span>
                  </div>
                </div>
                {owner &&
                  member.role !== 'owner' &&
                  !(
                    member.kind === 'assistant' &&
                    member.subjectId === group.xpertId
                  ) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!removing}
                      aria-label={`${t('group.remove')} ${member.name}`}
                      onClick={() => void remove(member.id)}
                    >
                      {removing === member.id && (
                        <Loader2 className="size-3 animate-spin" />
                      )}
                      {t('group.remove')}
                    </Button>
                  )}
              </div>
            ))}
        </div>
        {owner && (
          <form
            onSubmit={(event) => void invite(event)}
            className="mt-5 flex min-w-0 items-center gap-2 border-t pt-4"
          >
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-label={t('group.selectMember')}
                  aria-expanded={open}
                  aria-controls={`${id}-candidates`}
                  disabled={inviting}
                  className="min-w-0 flex-1 justify-between font-normal"
                >
                  {selected && eligible(selected) ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <GroupMemberAvatar
                        label={selected.name}
                        avatar={normalizeChatkitAvatar(selected.avatar)}
                        className="size-6 shrink-0"
                      />
                      <span className="truncate">{selected.name}</span>
                    </span>
                  ) : (
                    <span className="truncate text-muted-foreground">
                      {t('group.selectMember')}
                    </span>
                  )}
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command shouldFilter={false} label={t('group.searchMembers')}>
                  <CommandInput
                    aria-label={t('group.searchMembers')}
                    placeholder={t('group.searchMembers')}
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList id={`${id}-candidates`} aria-busy={loading}>
                    {loading ? (
                      <div
                        role="status"
                        className="flex items-center justify-center gap-2 p-5 text-sm text-muted-foreground"
                      >
                        <Loader2 className="size-4 animate-spin" />
                        {t('group.loadingMembers')}
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>{t('group.noMatches')}</CommandEmpty>
                        {candidates.filter(eligible).map((candidate) => (
                          <CommandItem
                            key={candidate.subjectId}
                            value={candidate.subjectId}
                            aria-label={candidate.name}
                            onSelect={() => {
                              setSelected(candidate);
                              setOpen(false);
                            }}
                          >
                            <GroupMemberAvatar
                              label={candidate.name}
                              avatar={normalizeChatkitAvatar(candidate.avatar)}
                              className="size-8 shrink-0"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {candidate.name}
                            </span>
                            {selected?.subjectId === candidate.subjectId && (
                              <Check className="size-4 shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              type="submit"
              disabled={!selected || !eligible(selected) || inviting}
            >
              {inviting && <Loader2 className="size-4 animate-spin" />}
              {t('group.invite')}
            </Button>
          </form>
        )}
      </TabsContent>
    </Tabs>
  );
}
