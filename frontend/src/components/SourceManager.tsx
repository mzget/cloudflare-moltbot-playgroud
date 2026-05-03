import React, { useState, useEffect } from 'react';
import { Box, Typography, Sheet, Table, IconButton, Button, Input, Chip, Stack, Switch, FormControl, FormLabel, Modal, ModalDialog, DialogTitle, DialogContent } from '@mui/joy';
import { Globe, Plus, Trash2, Edit, Save, X, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface NewsSource {
  id: number;
  name: string;
  url_pattern: string;
  selector: string;
  type: 'RSS' | 'WEB';
  enabled: boolean;
}

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
};

export default function SourceManager() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);

  const fetchSources = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sources`);
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (e) {
      console.error("Failed to fetch sources", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSave = async (source: any) => {
    try {
      const method = source.id ? 'PUT' : 'POST';
      await fetch(`${API_BASE_URL}/api/sources`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      });
      setShowForm(false);
      setEditingSource(null);
      fetchSources();
    } catch (e) {
      console.error("Failed to save source", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this source?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/sources?id=${id}`, { method: 'DELETE' });
      fetchSources();
    } catch (e) {
      console.error("Failed to delete source", e);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography level="h3" sx={{ color: 'white' }}>Intelligence Sources</Typography>
        <Button 
          variant="soft" 
          startDecorator={<Plus size={18} />}
          onClick={() => setShowForm(true)}
          sx={{ bgcolor: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', '&:hover': { bgcolor: 'rgba(46, 204, 113, 0.3)' } }}
        >
          Add Source
        </Button>
      </Stack>

      <Sheet sx={{ ...glassStyle, overflow: 'hidden' }}>
        <Table sx={{ '& tr > *': { color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)' } }}>
          <thead>
            <tr>
              <th style={{ background: 'transparent' }}>Name</th>
              <th style={{ background: 'transparent' }}>Type</th>
              <th style={{ background: 'transparent' }}>Status</th>
              <th style={{ background: 'transparent', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <Typography level="title-sm" sx={{ color: 'white' }}>{source.name}</Typography>
                  <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>{source.url_pattern}</Typography>
                </td>
                <td>
                  <Chip size="sm" variant="soft" color={source.type === 'RSS' ? 'primary' : 'warning'}>
                    {source.type}
                  </Chip>
                </td>
                <td>
                  <Chip size="sm" variant="soft" color={source.enabled ? 'success' : 'neutral'}>
                    {source.enabled ? 'Enabled' : 'Disabled'}
                  </Chip>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <IconButton size="sm" variant="plain" onClick={() => setEditingSource(source)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    <Edit size={16} />
                  </IconButton>
                  <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDelete(source.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>

      <SourceModal 
        open={showForm || !!editingSource} 
        onClose={() => { setShowForm(false); setEditingSource(null); }} 
        source={editingSource} 
        onSave={handleSave} 
      />
    </Box>
  );
}

function SourceModal({ open, onClose, source, onSave }: any) {
  const [formData, setFormData] = useState<any>({ name: '', url_pattern: '', selector: '', type: 'RSS', enabled: true });

  useEffect(() => {
    if (source) setFormData(source);
    else setFormData({ name: '', url_pattern: '', selector: '', type: 'RSS', enabled: true });
  }, [source, open]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ ...glassStyle, minWidth: 400, bgcolor: '#1a1a2e' }}>
        <DialogTitle sx={{ color: 'white' }}>{source ? 'Edit Source' : 'Add Source'}</DialogTitle>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <FormControl>
            <FormLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Name</FormLabel>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
          </FormControl>
          <FormControl>
            <FormLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Type</FormLabel>
            <Stack direction="row" spacing={2}>
              <Button size="sm" variant={formData.type === 'RSS' ? 'solid' : 'soft'} onClick={() => setFormData({...formData, type: 'RSS'})}>RSS</Button>
              <Button size="sm" variant={formData.type === 'WEB' ? 'solid' : 'soft'} onClick={() => setFormData({...formData, type: 'WEB'})}>WEB (Puppeteer)</Button>
            </Stack>
          </FormControl>
          <FormControl>
            <FormLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>URL Pattern (use {'{symbol}'})</FormLabel>
            <Input value={formData.url_pattern} onChange={e => setFormData({...formData, url_pattern: e.target.value})} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }} />
          </FormControl>
          {formData.type === 'WEB' && (
            <FormControl>
              <FormLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>CSS Selector</FormLabel>
              <Input value={formData.selector} onChange={e => setFormData({...formData, selector: e.target.value})} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }} />
            </FormControl>
          )}
          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FormLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Enabled</FormLabel>
            <Switch checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
          </FormControl>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
            <Button variant="solid" color="success" onClick={() => onSave(formData)}>Save Source</Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
