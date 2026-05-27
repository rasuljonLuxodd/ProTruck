import { useState } from 'react';
import { MapPin, Plus, Star, Archive } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { useLocations, useAddLocation, useUpdateLocation } from '@/hooks/useLocations';
import { cn } from '@/lib/utils';

/**
 * Settings → Locations. Foundation for multi-shop support.
 *
 * Today the owner can create multiple locations and pick a default;
 * every existing row is backfilled to the default at migration time.
 * Per-query filtering (so each location sees only its own inventory)
 * is a follow-up — for now this section sets up the data layer.
 */
export function LocationsSection() {
  const t = useT();
  const { toast } = useToast();
  const { data: locations = [] } = useLocations(true);
  const add = useAddLocation();
  const upd = useUpdateLocation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  function reset() {
    setName(''); setShortCode(''); setAddress(''); setPhone(''); setNote('');
    setMakeDefault(false);
  }

  function save() {
    if (!name.trim()) {
      toast(t('form.nameRequired'), 'error');
      return;
    }
    add.mutate(
      {
        name: name.trim(),
        shortCode: shortCode.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
        isDefault: makeDefault,
      },
      {
        onSuccess: () => { toast(t('toast.saved')); setOpen(false); reset(); },
        onError: (err) => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-[24px] leading-none flex items-center gap-2.5">
            <MapPin className="w-5 h-5" />
            {t('loc.title')}
          </h1>
          <p className="text-sm text-fg-muted mt-1.5 max-w-prose leading-relaxed">
            {t('loc.intro')}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('loc.addCta')}</span>
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {locations.map(l => (
          <div
            key={l.id}
            className={cn('card card-hover p-4', l.archived && 'opacity-60')}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{l.name}</span>
                  {l.isDefault && <Star className="w-3 h-3 text-amber-500" fill="currentColor" />}
                </div>
                {l.shortCode && (
                  <div className="kicker mt-0.5">{l.shortCode}</div>
                )}
              </div>
              {l.archived && <Badge tone="mute">{t('acc.archived')}</Badge>}
            </div>

            {l.address && <p className="text-xs text-fg-muted mt-2">{l.address}</p>}
            {l.phone && <p className="text-xs font-mono text-fg-muted mt-0.5">{l.phone}</p>}
            {l.note && <p className="text-xs text-fg-subtle mt-2 italic">{l.note}</p>}

            <div className="mt-3 flex justify-end gap-1">
              {!l.archived ? (
                <button
                  className="text-[10px] text-fg-muted hover:text-fg transition disabled:opacity-50"
                  onClick={() => upd.mutate({ id: l.id, patch: { archived: true } })}
                  disabled={l.isDefault}
                  title={l.isDefault ? t('loc.cantArchiveDefault') : t('acc.archive')}
                >
                  <Archive className="w-3 h-3 inline mr-1" />
                  {t('acc.archive')}
                </button>
              ) : (
                <button
                  className="text-[10px] text-fg-muted hover:text-fg transition"
                  onClick={() => upd.mutate({ id: l.id, patch: { archived: false } })}
                >
                  {t('acc.unarchive')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title={t('loc.addTitle')}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpen(false); reset(); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={save} disabled={add.isPending}>
              {add.isPending ? '…' : t('common.save')}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('loc.name')}>
            <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Bukhara filial" />
          </Field>
          <Field label={t('loc.shortCode')}>
            <input className="input" value={shortCode} onChange={e => setShortCode(e.target.value)} placeholder="BHR" />
          </Field>
        </div>
        <Field label={t('loc.address')}>
          <input className="input" value={address} onChange={e => setAddress(e.target.value)} />
        </Field>
        <Field label={t('common.phone')}>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
        </Field>
        <Field label={t('common.note')}>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />
          {t('loc.makeDefault')}
        </label>
      </Modal>
    </div>
  );
}
