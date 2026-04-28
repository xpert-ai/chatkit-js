import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Info,
} from 'lucide-react';
import type {
  RequestUserInputAnswer,
  RequestUserInputQuestion,
} from '@xpert-ai/chatkit-types';

import type { PendingRequestUserInput } from '../../providers/Stream';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type AnswerDraft =
  | {
      type: 'option';
      optionIndex: number;
      otherText?: string;
    }
  | {
      type: 'other';
      otherText: string;
      optionIndex?: number;
    };

export type RequestUserInputPanelProps = {
  request: PendingRequestUserInput | null;
  onSubmit: (answers: RequestUserInputAnswer[]) => void;
  onDismiss?: () => void;
  attachToComposer?: boolean;
  className?: string;
};

function useRoundedClasses() {
  const { theme } = useTheme();
  const density = theme.density ?? 'normal';
  const densityClasses =
    {
      compact: {
        section: 'px-3.5 py-2',
        eyebrow: 'mb-0 text-[11px]',
        title: 'text-[15px] leading-5',
        pager: 'gap-1.5 text-xs',
        pagerButton: 'h-6 w-6',
        pagerIcon: 'h-3.5 w-3.5',
        choices: 'mt-2.5 space-y-0.5',
        row: 'min-h-8 grid-cols-[28px_minmax(0,1fr)_auto] gap-2 px-2.5 py-1',
        otherRow: 'min-h-8 grid-cols-[28px_minmax(0,1fr)] gap-2 px-2.5 py-1',
        input: 'h-6',
        footer: 'mt-2.5 gap-2',
        dismissButton: 'h-7',
        continueButton: 'h-8 px-3.5',
        continueIcon: 'h-5 min-w-5',
      },
      normal: {
        section: 'px-4 py-2.5',
        eyebrow: 'mb-0.5 text-xs',
        title: 'text-base leading-5',
        pager: 'gap-2 text-sm',
        pagerButton: 'h-7 w-7',
        pagerIcon: 'h-4 w-4',
        choices: 'mt-3 space-y-0.5',
        row: 'min-h-9 grid-cols-[30px_minmax(0,1fr)_auto] gap-2.5 px-2.5 py-1.5',
        otherRow: 'min-h-9 grid-cols-[30px_minmax(0,1fr)] gap-2.5 px-2.5 py-1.5',
        input: 'h-6',
        footer: 'mt-3 gap-3',
        dismissButton: 'h-7',
        continueButton: 'h-8 px-4',
        continueIcon: 'h-5 min-w-5',
      },
      spacious: {
        section: 'px-5 py-3',
        eyebrow: 'mb-0.5 text-xs',
        title: 'text-base leading-5',
        pager: 'gap-2 text-sm',
        pagerButton: 'h-7 w-7',
        pagerIcon: 'h-4 w-4',
        choices: 'mt-4 space-y-1',
        row: 'min-h-10 grid-cols-[32px_minmax(0,1fr)_auto] gap-3 px-3 py-2',
        otherRow: 'min-h-10 grid-cols-[32px_minmax(0,1fr)] gap-3 px-3 py-2',
        input: 'h-7',
        footer: 'mt-4 gap-3',
        dismissButton: 'h-8',
        continueButton: 'h-9 px-4',
        continueIcon: 'h-5 min-w-5',
      },
    }[density] ??
    {
      section: 'px-4 py-2.5',
      eyebrow: 'mb-0.5 text-xs',
      title: 'text-base leading-5',
      pager: 'gap-2 text-sm',
      pagerButton: 'h-7 w-7',
      pagerIcon: 'h-4 w-4',
      choices: 'mt-3 space-y-0.5',
      row: 'min-h-9 grid-cols-[30px_minmax(0,1fr)_auto] gap-2.5 px-2.5 py-1.5',
      otherRow: 'min-h-9 grid-cols-[30px_minmax(0,1fr)] gap-2.5 px-2.5 py-1.5',
      input: 'h-6',
      footer: 'mt-3 gap-3',
      dismissButton: 'h-7',
      continueButton: 'h-8 px-4',
      continueIcon: 'h-5 min-w-5',
    };

  return {
    top: theme.radius
      ? {
          pill: 'rounded-t-3xl',
          round: 'rounded-t-xl',
          soft: 'rounded-t-lg',
          sharp: 'rounded-t-none',
        }[theme.radius]
      : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
    control: getRoundedClass(theme.radius, 'rounded-md'),
    density: densityClasses,
  };
}

function parseRecommendedLabel(label: string) {
  const recommendedPattern = /\s*(?:\((?:recommended)\)|（推荐）)\s*$/i;
  return {
    label: label.replace(recommendedPattern, '').trim() || label,
    recommended: recommendedPattern.test(label),
  };
}

function getAnswerForQuestion(
  question: RequestUserInputQuestion,
  draft: AnswerDraft | undefined,
): RequestUserInputAnswer | null {
  if (!draft) return null;

  if (draft.type === 'other') {
    const value = draft.otherText.trim();
    if (!value) return null;

    return {
      id: question.id,
      question: question.question,
      type: 'other',
      value,
    };
  }

  const option = question.options[draft.optionIndex];
  if (!option) return null;

  return {
    id: question.id,
    question: question.question,
    type: 'option',
    value: option.label,
    label: option.label,
    description: option.description,
  };
}

function getSelectedChoiceIndex(
  question: RequestUserInputQuestion,
  draft: AnswerDraft | undefined,
) {
  if (!draft) return -1;
  if (draft.type === 'other') return question.options.length;
  return draft.optionIndex;
}

export function RequestUserInputPanel({
  request,
  onSubmit,
  onDismiss,
  attachToComposer = true,
  className,
}: RequestUserInputPanelProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();
  const [drafts, setDrafts] = React.useState<Record<string, AnswerDraft>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const otherInputRef = React.useRef<HTMLInputElement | null>(null);
  const questions = request?.params.questions ?? [];

  React.useEffect(() => {
    setDrafts({});
    setCurrentQuestionIndex(0);
  }, [request?.id]);

  React.useEffect(() => {
    if (questions.length === 0) return;
    setCurrentQuestionIndex((index) =>
      Math.min(Math.max(index, 0), questions.length - 1),
    );
  }, [questions.length]);

  const setQuestionDraft = React.useCallback(
    (questionId: string, draft: AnswerDraft) => {
      setDrafts((previous) => ({
        ...previous,
        [questionId]: draft,
      }));
    },
    [],
  );

  const focusOtherInput = React.useCallback(() => {
    window.setTimeout(() => otherInputRef.current?.focus(), 0);
  }, []);

  const selectOption = React.useCallback(
    (question: RequestUserInputQuestion, optionIndex: number) => {
      const previousDraft = drafts[question.id];
      setQuestionDraft(question.id, {
        type: 'option',
        optionIndex,
        otherText: previousDraft?.otherText ?? '',
      });
    },
    [drafts, setQuestionDraft],
  );

  const selectOther = React.useCallback(
    (question: RequestUserInputQuestion, otherText?: string) => {
      const previousDraft = drafts[question.id];
      setQuestionDraft(question.id, {
        type: 'other',
        otherText:
          otherText ??
          (previousDraft?.type === 'other'
            ? previousDraft.otherText
            : previousDraft?.otherText) ??
          '',
      });
      focusOtherInput();
    },
    [drafts, focusOtherInput, setQuestionDraft],
  );

  const goToQuestion = React.useCallback(
    (index: number) => {
      if (questions.length === 0) return;
      setCurrentQuestionIndex(
        Math.min(Math.max(index, 0), questions.length - 1),
      );
    },
    [questions.length],
  );

  const answers = React.useMemo(
    () =>
      questions
        .map((question) => getAnswerForQuestion(question, drafts[question.id]))
        .filter((answer): answer is RequestUserInputAnswer => Boolean(answer)),
    [drafts, questions],
  );
  const canSubmit = answers.length === questions.length;
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const currentDraft = currentQuestion
    ? drafts[currentQuestion.id]
    : undefined;
  const currentAnswer = currentQuestion
    ? getAnswerForQuestion(currentQuestion, currentDraft)
    : null;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const buildAnswersFromDrafts = React.useCallback(
    (nextDrafts: Record<string, AnswerDraft>) =>
      questions
        .map((question) => getAnswerForQuestion(question, nextDrafts[question.id]))
        .filter((answer): answer is RequestUserInputAnswer => Boolean(answer)),
    [questions],
  );

  const submitOrFocusFirstMissing = React.useCallback(
    (nextDrafts: Record<string, AnswerDraft>) => {
      const nextAnswers = buildAnswersFromDrafts(nextDrafts);
      if (nextAnswers.length === questions.length) {
        onSubmit(nextAnswers);
        return;
      }

      const firstMissingIndex = questions.findIndex(
        (question) => !getAnswerForQuestion(question, nextDrafts[question.id]),
      );
      if (firstMissingIndex >= 0) {
        goToQuestion(firstMissingIndex);
      }
    },
    [buildAnswersFromDrafts, goToQuestion, onSubmit, questions],
  );

  const activateOption = React.useCallback(
    (question: RequestUserInputQuestion, optionIndex: number) => {
      const previousDraft = drafts[question.id];
      const nextDrafts = {
        ...drafts,
        [question.id]: {
          type: 'option' as const,
          optionIndex,
          otherText: previousDraft?.otherText ?? '',
        },
      };
      setDrafts(nextDrafts);

      if (isLastQuestion) {
        submitOrFocusFirstMissing(nextDrafts);
        return;
      }

      goToQuestion(currentQuestionIndex + 1);
    },
    [
      currentQuestionIndex,
      drafts,
      goToQuestion,
      isLastQuestion,
      submitOrFocusFirstMissing,
    ],
  );

  const chooseChoiceByIndex = React.useCallback(
    (choiceIndex: number) => {
      if (!currentQuestion) return;
      if (choiceIndex < 0) return;
      if (choiceIndex < currentQuestion.options.length) {
        selectOption(currentQuestion, choiceIndex);
        return;
      }
      if (choiceIndex === currentQuestion.options.length) {
        selectOther(currentQuestion);
      }
    },
    [currentQuestion, selectOption, selectOther],
  );

  const moveCurrentChoice = React.useCallback(
    (direction: 1 | -1) => {
      if (!currentQuestion) return;
      const choiceCount = currentQuestion.options.length + 1;
      const currentIndex = getSelectedChoiceIndex(currentQuestion, currentDraft);
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : choiceCount - 1
          : (currentIndex + direction + choiceCount) % choiceCount;
      chooseChoiceByIndex(nextIndex);
    },
    [chooseChoiceByIndex, currentDraft, currentQuestion],
  );

  const handleContinue = React.useCallback(() => {
    if (!currentAnswer) return;

    if (!isLastQuestion) {
      goToQuestion(currentQuestionIndex + 1);
      return;
    }

    if (canSubmit) {
      onSubmit(answers);
      return;
    }

    const firstMissingIndex = questions.findIndex(
      (question) => !getAnswerForQuestion(question, drafts[question.id]),
    );
    if (firstMissingIndex >= 0) {
      goToQuestion(firstMissingIndex);
    }
  }, [
    answers,
    canSubmit,
    currentAnswer,
    currentQuestionIndex,
    drafts,
    goToQuestion,
    isLastQuestion,
    onSubmit,
    questions,
  ]);

  React.useEffect(() => {
    if (!request) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable ||
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT';

      if (event.key === 'Escape' || event.key === 'Esc') {
        if (onDismiss) {
          event.preventDefault();
          onDismiss();
        }
        return;
      }

      if (isTypingTarget && event.key !== 'Enter') {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleContinue();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToQuestion(currentQuestionIndex - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToQuestion(currentQuestionIndex + 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveCurrentChoice(-1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveCurrentChoice(1);
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const choiceIndex = Number(event.key) - 1;
        if (
          currentQuestion &&
          choiceIndex < currentQuestion.options.length + 1
        ) {
          event.preventDefault();
          chooseChoiceByIndex(choiceIndex);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    chooseChoiceByIndex,
    currentQuestion,
    currentQuestionIndex,
    goToQuestion,
    handleContinue,
    moveCurrentChoice,
    onDismiss,
    request,
  ]);

  if (!request || !currentQuestion) {
    return null;
  }

  const handleOtherTextChange = (value: string) => {
    setDrafts((previous) => ({
      ...previous,
      [currentQuestion.id]: {
        type: 'other',
        otherText: value,
      },
    }));
  };
  const otherText = currentDraft?.otherText ?? '';

  return (
    <section
      aria-label={t('composer.requestUserInput.title')}
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 shadow-sm',
        rounded.density.section,
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              'font-medium text-muted-foreground',
              rounded.density.eyebrow,
            )}
          >
            {currentQuestion.header}
          </div>
          <h3
            className={cn(
              'font-semibold text-foreground',
              rounded.density.title,
            )}
          >
            {currentQuestion.question}
          </h3>
        </div>

        {questions.length > 1 ? (
          <div
            className={cn(
              'flex shrink-0 items-center font-medium text-muted-foreground',
              rounded.density.pager,
            )}
          >
            <button
              type="button"
              onClick={() => goToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className={cn(
                'inline-flex items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-35',
                rounded.density.pagerButton,
              )}
              aria-label={t('composer.requestUserInput.previousQuestion')}
            >
              <ChevronLeft className={rounded.density.pagerIcon} />
            </button>
            <span className="min-w-12 text-center">
              {t('composer.requestUserInput.questionProgress', {
                current: currentQuestionIndex + 1,
                total: questions.length,
              })}
            </span>
            <button
              type="button"
              onClick={() => goToQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === questions.length - 1}
              className={cn(
                'inline-flex items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-35',
                rounded.density.pagerButton,
              )}
              aria-label={t('composer.requestUserInput.nextQuestion')}
            >
              <ChevronRight className={rounded.density.pagerIcon} />
            </button>
          </div>
        ) : null}
      </div>

      <div className={rounded.density.choices}>
        {currentQuestion.options.map((option, optionIndex) => {
          const selected =
            currentDraft?.type === 'option' &&
            currentDraft.optionIndex === optionIndex;
          const parsedLabel = parseRecommendedLabel(option.label);

          return (
            <div
              key={`${currentQuestion.id}-${optionIndex}`}
              role="button"
              tabIndex={0}
              onClick={() => activateOption(currentQuestion, optionIndex)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  activateOption(currentQuestion, optionIndex);
                }
              }}
              aria-pressed={selected}
              aria-label={`${optionIndex + 1}. ${option.label}`}
              className={cn(
                'grid cursor-pointer items-center text-left transition-colors',
                rounded.density.row,
                rounded.panel,
                selected
                  ? 'bg-muted text-foreground'
                  : 'text-foreground/90 hover:bg-muted/55',
              )}
            >
              <span className="text-sm font-semibold text-muted-foreground">
                {optionIndex + 1}.
              </span>
              <span className="min-w-0">
                <span className="inline min-w-0 text-sm font-semibold leading-5">
                  {parsedLabel.label}
                </span>
                {parsedLabel.recommended ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" />
                    ({t('composer.requestUserInput.recommended')})
                  </span>
                ) : null}
              </span>

              <span className="flex items-center gap-2 text-muted-foreground">
                {option.description ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        title={option.description}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-background/80 hover:text-foreground"
                        aria-label={t('composer.requestUserInput.optionInfo', {
                          label: parsedLabel.label,
                        })}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-72 text-left leading-5"
                    >
                      {option.description}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="hidden items-center gap-0.5 sm:flex"
                  >
                    <ArrowUp className="h-4 w-4 opacity-45" />
                    <ArrowDown className="h-4 w-4 opacity-45" />
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}

        <label
          className={cn(
            'grid items-center transition-colors',
            rounded.density.otherRow,
            rounded.panel,
            currentDraft?.type === 'other'
              ? 'bg-muted text-foreground'
              : 'hover:bg-muted/55',
          )}
        >
          <span className="text-sm font-semibold text-muted-foreground">
            {currentQuestion.options.length + 1}.
          </span>
          <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <input
              ref={otherInputRef}
              value={otherText}
              onChange={(event) => handleOtherTextChange(event.target.value)}
              onFocus={() => selectOther(currentQuestion, otherText)}
              placeholder={t('composer.requestUserInput.otherPlaceholder')}
              className={cn(
                'min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
                rounded.density.input,
              )}
            />
          </span>
        </label>
      </div>

      <div
        className={cn(
          'flex items-center justify-end',
          rounded.density.footer,
        )}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
              rounded.density.dismissButton,
            )}
          >
            {t('composer.requestUserInput.dismiss')}
            <kbd className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              ESC
            </kbd>
          </button>
        ) : null}

        <button
          type="button"
          disabled={!currentAnswer}
          onClick={handleContinue}
          className={cn(
            'inline-flex items-center gap-2 bg-primary text-sm font-semibold text-background transition-all',
            rounded.density.continueButton,
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40',
            rounded.panel,
          )}
        >
          {t('composer.requestUserInput.continue')}
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-background/20',
              rounded.density.continueIcon,
            )}
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </section>
  );
}

export default RequestUserInputPanel;
