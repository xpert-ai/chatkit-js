import * as React from 'react';
import {
  validateUserInputValues,
  type RequestUserInputForm,
  type UserInputValues,
  type UserInputValidationError,
} from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/select';
import { XIcon } from 'lucide-react';
import { UserInputDateField } from './user-input-date-field';

export function UserInputFormPanel({
  form,
  onSubmit,
  onCancel,
  attachToComposer = true,
  className,
}: {
  form: RequestUserInputForm;
  onSubmit: (values: UserInputValues) => void;
  onCancel?: () => void;
  attachToComposer?: boolean;
  className?: string;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const prefix = React.useId();
  const [values, setValues] = React.useState<UserInputValues>({});
  const [errors, setErrors] = React.useState<{
    [id: string]: UserInputValidationError;
  }>({});
  const submitted = React.useRef(false);
  const density = theme.density ?? 'normal';
  const spacing =
    density === 'compact'
      ? 'p-3 space-y-3'
      : density === 'spacious'
        ? 'p-5 space-y-5'
        : 'p-4 space-y-4';
  const controlHeight =
    density === 'compact'
      ? 'h-8 py-1 text-sm'
      : density === 'spacious'
        ? 'h-11 py-2 text-base'
        : 'h-9 py-1.5 text-sm';
  const control = cn(
    'w-full min-w-0 bg-background text-foreground aria-invalid:border-destructive',
    controlHeight,
  );
  function update(id: string, value: UserInputValues[string] | undefined) {
    setValues((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }
  function submit() {
    if (submitted.current) return;
    const result = validateUserInputValues(form, values);
    if (!result.valid) {
      setErrors(result.errors);
      document
        .getElementById(`${prefix}-${Object.keys(result.errors)[0]}`)
        ?.focus();
      return;
    }
    submitted.current = true;
    onSubmit(result.values);
  }
  return (
    <section
      aria-label={form.title}
      className={cn(
        'min-w-0 rounded-chat-panel border border-border bg-background text-foreground [overflow-wrap:anywhere]',
        attachToComposer && 'mx-2 rounded-b-none border-b-0',
        spacing,
        className,
      )}
    >
      <div>
        <h3 className="font-medium">{form.title}</h3>
        {form.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {form.description}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {t('composer.userInputForm.waiting')}
        </p>
      </div>
      {/* Keep the controls' outer focus rings inside the scroll viewport. */}
      <div className="-mx-1.5 max-h-[50vh] space-y-4 overflow-y-auto p-1.5">
        {form.fields.map((field) => {
          const id = `${prefix}-${field.id}`;
          const value = values[field.id];
          const common = {
            id,
            'aria-invalid': !!errors[field.id],
            'aria-required': !!field.required,
            'aria-describedby':
              [
                field.description && `${id}-description`,
                errors[field.id] && `${id}-error`,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            className: control,
          };
          const label = (
            <Label htmlFor={id} className="mb-1 block leading-5">
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </Label>
          );
          return (
            <div key={field.id}>
              {label}
              {field.description && (
                <p
                  id={`${id}-description`}
                  className="mb-1 text-xs text-muted-foreground"
                >
                  {field.description}
                </p>
              )}
              {field.type === 'textarea' ? (
                <Textarea
                  {...common}
                  className={cn(control, 'h-auto min-h-24')}
                  rows={3}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => update(field.id, event.target.value)}
                />
              ) : field.type === 'select' || field.type === 'boolean' ? (
                <div className="flex min-w-0 gap-2">
                  <Select
                    value={value === undefined ? '' : String(value)}
                    onValueChange={(selected) =>
                      update(
                        field.id,
                        selected === ''
                          ? undefined
                          : field.type === 'boolean'
                            ? selected === 'true'
                            : selected,
                      )
                    }
                  >
                    <SelectTrigger
                      {...common}
                      className={cn(
                        control,
                        'flex-1',
                        density === 'compact'
                          ? 'data-[size=default]:h-8'
                          : density === 'spacious'
                            ? 'data-[size=default]:h-11'
                            : 'data-[size=default]:h-9',
                      )}
                    >
                      <SelectValue
                        placeholder={t('composer.userInputForm.choose')}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      {field.type === 'boolean' ? (
                        <>
                          <SelectItem value="true">
                            {t('composer.hitl.true')}
                          </SelectItem>
                          <SelectItem value="false">
                            {t('composer.hitl.false')}
                          </SelectItem>
                        </>
                      ) : (
                        field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {!field.required && value !== undefined && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={controlHeight}
                      aria-label={`${field.label} ${t('composer.userInputForm.clear')}`}
                      onClick={() => update(field.id, undefined)}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ) : field.type === 'multiselect' ? (
                <fieldset
                  id={id}
                  tabIndex={-1}
                  aria-label={field.label}
                  aria-describedby={common['aria-describedby']}
                  aria-invalid={common['aria-invalid']}
                  className="space-y-1"
                >
                  {field.options?.map((option) => (
                    <Label
                      key={option.value}
                      className={cn(
                        'flex items-center gap-2 text-sm font-normal',
                        controlHeight,
                      )}
                    >
                      <Checkbox
                        className="rounded-[min(var(--chat-item-radius),4px)] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        checked={
                          Array.isArray(value) && value.includes(option.value)
                        }
                        onCheckedChange={(checked) => {
                          const previous = Array.isArray(value) ? value : [];
                          update(
                            field.id,
                            checked === true
                              ? [...previous, option.value]
                              : previous.filter(
                                  (item) => item !== option.value,
                                ),
                          );
                        }}
                      />
                      {option.label}
                    </Label>
                  ))}
                </fieldset>
              ) : field.type === 'date_range' ? (
                <div className="flex flex-wrap gap-2">
                  {(['start', 'end'] as const).map((part, index) => {
                    const range =
                      value &&
                      typeof value === 'object' &&
                      !Array.isArray(value)
                        ? value
                        : { start: '', end: '' };
                    return (
                      <div key={part} className="min-w-0 basis-48 grow">
                        <Label
                          htmlFor={index === 0 ? id : `${id}-end`}
                          className="mb-1 block text-xs text-muted-foreground"
                        >
                          {t(`composer.userInputForm.${part}`)}
                        </Label>
                        <UserInputDateField
                          {...common}
                          label={`${field.label} ${t(`composer.userInputForm.${part}`)}`}
                          buttonClassName={controlHeight}
                          id={index === 0 ? id : `${id}-end`}
                          aria-label={`${field.label} ${t(`composer.userInputForm.${part}`)}`}
                          value={range[part]}
                          onValueChange={(date) => {
                            const next = {
                              ...range,
                              [part]: date,
                            };
                            update(
                              field.id,
                              !next.start && !next.end ? undefined : next,
                            );
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : field.type === 'date' ? (
                <UserInputDateField
                  {...common}
                  label={field.label}
                  buttonClassName={controlHeight}
                  value={typeof value === 'string' ? value : ''}
                  onValueChange={(date) => update(field.id, date)}
                />
              ) : (
                <Input
                  {...common}
                  type={field.type === 'number' ? 'number' : 'text'}
                  step={field.type === 'number' ? 'any' : undefined}
                  value={
                    typeof value === 'string' || typeof value === 'number'
                      ? value
                      : ''
                  }
                  onChange={(event) =>
                    update(
                      field.id,
                      field.type === 'number'
                        ? event.target.value === ''
                          ? undefined
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
              {errors[field.id] && (
                <p
                  id={`${id}-error`}
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {t(`composer.userInputForm.errors.${errors[field.id]}`)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className={controlHeight}
            onClick={onCancel}
          >
            {t('composer.userInputForm.cancel')}
          </Button>
        )}
        <Button type="button" className={controlHeight} onClick={submit}>
          {t('composer.userInputForm.submit')}
        </Button>
      </div>
    </section>
  );
}
