import React, { useState, useEffect } from 'react';
import { Input } from '@mui/joy';

interface FastInlineInputProps {
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  slotProps?: any;
  sx?: any;
}

const FastInlineInput = React.memo(({
  value: initialValue,
  onChange,
  type,
  placeholder,
  size,
  slotProps,
  sx
}: FastInlineInputProps) => {
  const [localValue, setLocalValue] = useState(initialValue);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  const handleCommit = () => {
    if (localValue !== initialValue) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      size={size}
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
      slotProps={slotProps}
      sx={sx}
    />
  );
});

export default FastInlineInput;
