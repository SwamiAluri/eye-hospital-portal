'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ModalSelectContent,
} from '@/components/ui/select';
import {
  OTHER_OPTION,
  resolveOptionWithOther,
  splitOptionWithOther,
} from '@/lib/medical-history/option-with-other';

interface SelectWithOtherProps {
  label: string;
  required?: boolean;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  customPlaceholder?: string;
}

export function SelectWithOther({
  label,
  required,
  options,
  value,
  onChange,
  placeholder = 'Select',
  customPlaceholder = 'Enter value',
}: SelectWithOtherProps) {
  const [selectValue, setSelectValue] = useState('');
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    const parsed = splitOptionWithOther(value, options);
    setSelectValue(parsed.selectValue);
    setCustomText(parsed.customText);
  }, [value, options]);

  const handleSelectChange = (next: string) => {
    setSelectValue(next);
    if (next !== OTHER_OPTION) {
      onChange(next);
    } else {
      onChange(resolveOptionWithOther(OTHER_OPTION, customText));
    }
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    if (selectValue === OTHER_OPTION) {
      onChange(resolveOptionWithOther(OTHER_OPTION, text));
    }
  };

  return (
    <div>
      <Label required={required}>{label}</Label>
      <Select value={selectValue || undefined} onValueChange={handleSelectChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <ModalSelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </ModalSelectContent>
      </Select>
      {selectValue === OTHER_OPTION && (
        <Input
          className="mt-2"
          value={customText}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder={customPlaceholder}
          aria-label={`${label} (other)`}
        />
      )}
    </div>
  );
}

/** Validates SelectWithOther before form submit. */
export function validateSelectWithOther(
  value: string,
  label: string,
): string | null {
  if (!value.trim()) return `Please select or enter ${label.toLowerCase()}`;
  return null;
}
