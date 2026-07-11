import React, { useState, useEffect } from 'react';
import { Input, type InputProps } from '@mui/joy';

interface DebouncedInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceTimeout?: number;
}

export default function DebouncedInput({
  value,
  onChange,
  debounceTimeout = 250,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Synchronize when the parent value changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the change propagation
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceTimeout);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, onChange, debounceTimeout, value]);

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  );
}
