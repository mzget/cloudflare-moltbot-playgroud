import React, { useState, useEffect } from 'react';
import { Input, type InputProps } from '@mui/joy';

interface DebouncedInputProps extends Omit<InputProps, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  debounceTimeout?: number;
}

export default function DebouncedInput({
  value,
  onChange,
  debounceTimeout = 250,
  onBlur,
  onKeyDown,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState<string | number>(value ?? '');

  // Synchronize when the parent value changes externally
  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  // Debounce the change propagation
  useEffect(() => {
    const handler = setTimeout(() => {
      if (String(localValue) !== String(value)) {
        onChange(String(localValue));
      }
    }, debounceTimeout);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, onChange, debounceTimeout, value]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (String(localValue) !== String(value)) {
      onChange(String(localValue));
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (String(localValue) !== String(value)) {
        onChange(String(localValue));
      }
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
