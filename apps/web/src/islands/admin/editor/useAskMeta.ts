import { useCallback } from 'react';
import { altFromFilename, cleanAlt, imageSize, type UploadMeta, validateImage } from '../lib/media';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';

/** Valide le fichier, mesure l'image puis demande alt (obligatoire) et légende. */
export function useAskMeta(): (file: File) => Promise<UploadMeta | null> {
  const dialogs = useDialogs();
  const toast = useToast();
  return useCallback(
    async (file: File) => {
      const err = validateImage(file);
      if (err) {
        toast(err, 'error');
        return null;
      }
      const dims = await imageSize(file);
      const preview = URL.createObjectURL(file);
      try {
        const r = await dialogs.form({
          title: 'Image — description',
          image: preview,
          intro: `${file.name} · ${dims.width || '?'}×${dims.height || '?'} px · ${Math.ceil(file.size / 1024)} Ko`,
          fields: [
            {
              name: 'alt',
              label: 'Texte alternatif',
              required: true,
              value: altFromFilename(file.name),
              hint: 'Décrit l’image pour les lecteurs d’écran et les moteurs.',
            },
            { name: 'caption', label: 'Légende (optionnelle)', value: '' },
          ],
          submitLabel: 'Envoyer >>>',
        });
        if (!r) return null;
        const alt = cleanAlt(r.alt ?? '');
        if (!alt) {
          toast('Le texte alternatif est obligatoire.', 'error');
          return null;
        }
        return { alt, caption: r.caption ?? '', width: dims.width, height: dims.height };
      } finally {
        URL.revokeObjectURL(preview);
      }
    },
    [dialogs, toast],
  );
}
