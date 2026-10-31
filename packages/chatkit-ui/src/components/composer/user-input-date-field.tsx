import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { enUS, zhCN } from 'react-day-picker/locale';
import { isInputDate } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/** Keep date-only values in local calendar time; UTC conversion shifts some dates. */
function parseCalendarDate(value: string) {
  if (!isInputDate(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatCalendarDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function UserInputDateField({
  value,
  onValueChange,
  label,
  buttonClassName,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  buttonClassName: string;
}) {
  const { t, i18n } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const selected = parseCalendarDate(value);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Input
        {...props}
        type="text"
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={buttonClassName}
            disabled={props.disabled}
            aria-label={`${label} ${t('composer.userInputForm.chooseDate')}`}
          >
            <CalendarIcon aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
          aria-label={label}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            autoFocus
            locale={i18n?.language?.startsWith('zh') ? zhCN : enUS}
            onSelect={(date) => {
              onValueChange(date ? formatCalendarDate(date) : '');
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
