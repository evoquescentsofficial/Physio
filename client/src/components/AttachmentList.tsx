import { useRef, useState } from 'react';
import { api, IS_DEMO } from '../api/client';
import { Attachment } from '../types';
import { ConfirmDialog, IconButton } from './ui';

const MAX_MB = 10;

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

/**
 * X-rays, MRI reports and lab PDFs kept with the assessment they belong to.
 *
 * Uploads go to the clinic computer next to the database; in the browser demo there is no
 * computer to put them on, so the file is held in the browser and opened from there.
 */
export default function AttachmentList({
  patientId,
  diagnosisId,
  attachments,
  onChange,
}: {
  patientId: string;
  diagnosisId: string;
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<Attachment | null>(null);

  async function upload(file: File) {
    setError('');
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_MB} MB. Please upload a smaller scan.`);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('patientId', patientId);
      body.append('diagnosisId', diagnosisId);
      const res = await api.post('/attachments', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange([...attachments, res.data]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That file could not be attached.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(attachment: Attachment) {
    await api.delete(`/attachments/${attachment.id}`);
    onChange(attachments.filter((a) => a.id !== attachment.id));
    setConfirming(null);
  }

  /** In the demo the bytes are already in the browser; otherwise the API serves the file. */
  function open(attachment: Attachment) {
    const href = attachment.dataUrl || `${api.defaults.baseURL}/attachments/${attachment.id}/file`;
    window.open(href, '_blank', 'noopener');
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      {attachments.length > 0 && (
        <ul className="mb-3 divide-y divide-ink-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              {isImage(a.mimeType) && a.dataUrl ? (
                <img
                  src={a.dataUrl}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-ink-100 text-[10px] font-bold uppercase text-ink-500">
                  {a.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => open(a)}
                  className="block truncate text-sm font-medium text-brand-700 hover:underline"
                >
                  {a.filename}
                </button>
                <span className="block text-xs text-ink-400">{sizeLabel(a.size)}</span>
              </span>
              <IconButton
                icon="trash"
                label={`Remove ${a.filename}`}
                tone="danger"
                onClick={() => setConfirming(a)}
              />
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : '+ Attach report'}
        </button>
        <span className="text-xs text-ink-400">
          PDF or image, up to {MAX_MB} MB{IS_DEMO ? ' — demo files stay in this browser' : ''}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ConfirmDialog
        open={!!confirming}
        title="Remove this report?"
        message={
          <>
            {confirming?.filename} will be deleted from the patient's file. This cannot be undone.
          </>
        }
        confirmLabel="Remove file"
        onCancel={() => setConfirming(null)}
        onConfirm={() => remove(confirming!)}
      />
    </div>
  );
}
