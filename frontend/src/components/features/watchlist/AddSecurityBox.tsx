import React, { useState, useCallback } from 'react';
import { Typography, Sheet, Button, Input, Stack, Select, Option } from '@mui/joy';
import { Plus } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

interface AddSecurityBoxProps {
  onAdd: (symbol: string, name: string, type: string) => Promise<Response>;
  onSuccess: () => void;
  onError: (errMsg: string) => void;
}

function AddSecurityBox({ onAdd, onSuccess, onError }: AddSecurityBoxProps) {
  const [form, setForm] = useState({
    symbol: '',
    name: '',
    type: 'stock'
  });

  const handleAdd = useCallback(async () => {
    if (!form.symbol) return;
    try {
      const res = await onAdd(form.symbol, form.name, form.type);
      if (res.ok) {
        setForm({ symbol: '', name: '', type: 'stock' });
        onSuccess();
      }
    } catch (err: any) {
      let errMsg = "Failed to add to watchlist";
      if (err instanceof Response) {
        try {
          const data = await err.json() as any;
          if (data && data.error) errMsg = data.error;
        } catch {
          try {
            const txt = await err.text();
            if (txt) errMsg = txt;
          } catch {}
        }
      } else if (err && err.message) {
        errMsg = err.message;
      }
      onError(errMsg);
    }
  }, [form, onAdd, onSuccess, onError]);

  return (
    <Sheet sx={{ ...glassStyle, p: 2, mb: 4 }}>
      <Stack spacing={2}>
        <Typography level="title-sm" sx={{ opacity: 0.6 }}>Add New Security</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Input 
            placeholder="Symbol (e.g. AAPL)" 
            value={form.symbol} 
            onChange={e => setForm(prev => ({ ...prev, symbol: e.target.value }))}
            sx={{ flex: 1 }}
          />
          <Input 
            placeholder="Company Name" 
            value={form.name} 
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ flex: 2 }}
          />
          <Select
            value={form.type}
            onChange={(_, val) => setForm(prev => ({ ...prev, type: val || 'stock' }))}
            sx={{ 
              minWidth: 120,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.15)'
              }
            }}
          >
            <Option value="stock">Stock</Option>
            <Option value="etf">ETF</Option>
          </Select>
          <Button 
            variant="solid" 
            color="success" 
            onClick={handleAdd}
            startDecorator={<Plus size={18} />}
          >
            Add
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
}

export default React.memo(AddSecurityBox);
