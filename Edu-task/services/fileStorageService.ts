import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/Edu-task/lib/firebase';
import { genId } from '@/Edu-task/lib/utils';
import { formatFileSize, sanitizeFileName, validateUpload } from '@/Edu-task/lib/fileValidation';
import { AttachmentFile } from '@/Edu-task/types/leave';

export type UploadScope = 'leaves' | 'tasks';

export interface UploadProgress {
  fileName: string;
  percent: number;
}

/**
 * Uploads one file into the dedicated `edutask` bucket and returns the metadata
 * to store on the Firestore document.
 *
 * Paths are `{scope}/{recordId}/{unique}-{name}` so the storage rules can scope
 * access by record, and so deleting a record's files is a prefix operation.
 */
export const fileStorageService = {
  async upload(
    file: File,
    scope: UploadScope,
    recordId: string,
    uploader: { id: string; name: string },
    onProgress?: (percent: number) => void
  ): Promise<AttachmentFile> {
    const validationError = validateUpload(file);
    if (validationError) throw new Error(validationError);

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${scope}/${recordId}/${genId('F')}-${safeName}`;
    const objectRef = ref(storage, storagePath);

    const task = uploadBytesResumable(objectRef, file, {
      contentType: file.type,
      // Surfaced in the Storage console; makes an orphaned object traceable.
      customMetadata: { uploadedBy: uploader.id, originalName: file.name },
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        snapshot => {
          if (!onProgress || snapshot.totalBytes === 0) return;
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        reject,
        () => resolve()
      );
    });

    const url = await getDownloadURL(objectRef);

    return {
      id: genId('ATT'),
      name: file.name,
      size: formatFileSize(file.size),
      url,
      type: file.type,
      storagePath,
      uploadedById: uploader.id,
      uploadedByName: uploader.name,
      uploadedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
  },

  /**
   * Best-effort removal. A missing object is treated as success: the caller's
   * goal is "this file is gone", and failing on an already-deleted object would
   * strand the reference on the Firestore document forever.
   */
  async remove(attachment: AttachmentFile): Promise<void> {
    if (!attachment.storagePath) return;
    try {
      await deleteObject(ref(storage, attachment.storagePath));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'storage/object-not-found') return;
      throw err;
    }
  },
};
