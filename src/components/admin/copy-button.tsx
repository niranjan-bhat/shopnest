'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function CopyButton({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy. Select the text instead.');
    }
  };
  return (
    <Button type="button" variant="outline" onClick={copy}>
      <Copy aria-hidden />
      Copy message
    </Button>
  );
}
