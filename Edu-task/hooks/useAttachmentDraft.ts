import { useCallback, useRef, useState } from 'react';
import { AttachmentFile } from '@/Edu-task/types/leave';
import { fileStorageService, UploadScope } from '@/Edu-task/services/fileStorageService';

interface Options {
  scope: UploadScope;
  /** Id of the record the files belong to. For a new record, generate it upfront. */
  recordId: string;
  uploader: { id: string; name: string };
  initialFiles?: AttachmentFile[];
}

/**
 * Manages attachments for a form that has not been saved yet.
 *
 * Bytes must reach the bucket before the form is submitted (so the saved
 * document only ever references real objects), but the form can still be
 * cancelled. This hook keeps storage and the user's intent in sync:
 *
 *  - files uploaded in this session are deleted if the form is abandoned
 *  - removing an *already saved* file only takes effect once the save succeeds,
 *    so cancelling an edit never strands the document with a dead link
 */
export function useAttachmentDraft({ scope, recordId, uploader, initialFiles = [] }: Options) {
  const [files, setFiles] = useState<AttachmentFile[]>(initialFiles);

  // Refs, not state: these are bookkeeping for cleanup and must be readable
  // from the discard/commit callbacks without forcing a re-render.
  const sessionUploads = useRef<AttachmentFile[]>([]);
  const pendingRemovals = useRef<AttachmentFile[]>([]);

  const upload = useCallback(
    async (file: File, onProgress: (percent: number) => void) => {
      const attachment = await fileStorageService.upload(file, scope, recordId, uploader, onProgress);
      sessionUploads.current.push(attachment);
      setFiles(prev => [...prev, attachment]);
      return attachment;
    },
    [scope, recordId, uploader]
  );

  const remove = useCallback(async (target: AttachmentFile) => {
    setFiles(prev => prev.filter(f => f.id !== target.id));

    const uploadedThisSession = sessionUploads.current.some(f => f.id === target.id);
    if (uploadedThisSession) {
      // Never persisted, so it can go immediately.
      sessionUploads.current = sessionUploads.current.filter(f => f.id !== target.id);
      await fileStorageService.remove(target).catch(err =>
        console.error('Failed to remove uploaded file:', err)
      );
      return;
    }

    pendingRemovals.current.push(target);
  }, []);

  /** Call after the record saved successfully: applies deferred deletions. */
  const commit = useCallback(async () => {
    const toDelete = pendingRemovals.current;
    pendingRemovals.current = [];
    sessionUploads.current = [];
    await Promise.all(
      toDelete.map(f =>
        fileStorageService.remove(f).catch(err => console.error('Failed to remove file:', err))
      )
    );
  }, []);

  /** Call when the form is abandoned: removes bytes nobody will reference. */
  const discard = useCallback(async () => {
    const toDelete = sessionUploads.current;
    sessionUploads.current = [];
    pendingRemovals.current = [];
    await Promise.all(
      toDelete.map(f =>
        fileStorageService.remove(f).catch(err => console.error('Failed to clean up file:', err))
      )
    );
  }, []);

  return { files, upload, remove, commit, discard };
}
