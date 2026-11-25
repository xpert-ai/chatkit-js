import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@xpert-ai/chatkit-primitives';

interface ChoiceSelectProps {
  id: string;
  className?: string;
  value?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

// A2UI permits an empty option value; Radix reserves it for the placeholder.
export function ChoiceSelect({ id, className, value, options, placeholder, onValueChange }: ChoiceSelectProps) {
  const selected = options.findIndex(option => option.value === value);
  return <Select value={selected < 0 ? '' : String(selected)} onValueChange={index => onValueChange(options[Number(index)].value)}>
    <SelectTrigger id={id} className={cn('w-full', className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent position="popper" align="start">
      {options.map((option, index) => <SelectItem key={index} value={String(index)}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
