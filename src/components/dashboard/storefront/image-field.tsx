'use client';

import { cn } from 'cn';
import { ImageIcon, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { StoreImage } from '@/components/storefront/store-image';
import { Button } from '@/components/ui/button';
import { prepareBrandingUpload } from '@/features/media/branding-actions';
import { ImageProblem, prepareImage } from '@/features/media/prepare-image';
import { BRANDING_SIZES, type BrandingKind } from '@/features/media/rules';

/**
 * Picks one store image (logo, favicon, banner): resizes it in the browser,
 * uploads it straight to storage and reports the new key. The caller saves
 * the key with the rest of its form.
 */
export function ImageField({
  kind,
  label,
  value,
  onChange,
  uploadsEnabled,
  previewClassName,
  error,
}: {
  kind: BrandingKind;
  label: string;
  value: string | null;
  onChange: (key: string | null) => void;
  uploadsEnabled: boolean;
  previewClassName?: string;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const upload = async (file: File) => {
    setBusy(true);
    setProblem('');
    try {
      const image = await prepareImage(file, BRANDING_SIZES[kind]);
      const target = await prepareBrandingUpload({
        kind,
        type: image.type,
        size: image.blob.size,
      });
      if (!target.ok) {
        setProblem(target.error);
        return;
      }
      const response = await fetch(target.uploadUrl, {
        method: 'PUT',
        body: image.blob,
        headers: { 'Content-Type': target.contentType },
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      onChange(target.key);
    } catch (e) {
      setProblem(
        e instanceof ImageProblem
          ? e.message
          : 'Upload failed. Check your connection.',
      );
    } finally {
      setBusy(false);
    }
  };

  const message = problem || error;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted',
            previewClassName ?? 'h-16 w-32',
          )}
        >
          {value ? (
            <StoreImage
              image={{ key: value, alt: label, width: 400, height: 200 }}
              sizes="160px"
              fill
              className="object-contain p-1"
            />
          ) : (
            <ImageIcon aria-hidden className="size-5 text-muted-foreground" />
          )}
        </span>
        {uploadsEnabled ? (
          <label
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <Upload aria-hidden className="size-4" />
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="sr-only"
              aria-label={`Upload ${label.toLowerCase()}`}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(file);
              }}
            />
          </label>
        ) : (
          <span className="text-sm text-muted-foreground">
            Uploads are not set up for this site yet.
          </span>
        )}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={busy}
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X aria-hidden />
            Remove
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
