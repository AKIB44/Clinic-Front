export type FileKind = 'model3d' | 'dicom' | 'image' | 'pdf' | 'video' | 'other';

export interface PatientFile {
  id: string;
  filename: string;
  content_type: string;
  file_size: number | null;
  kind: FileKind;
  notes: string | null;
  created_at: string;
  url: string;           // presigned download/view URL
}

export const KIND_META: Record<FileKind, { label: string; icon: string; accent: string }> = {
  model3d: { label: '3D Model', icon: 'cube',         accent: '#6366f1' },
  dicom:   { label: 'DICOM',    icon: 'scan',         accent: '#0891b2' },
  image:   { label: 'Image',    icon: 'photo',        accent: '#0d9488' },
  pdf:     { label: 'PDF',      icon: 'file-text',    accent: '#dc2626' },
  video:   { label: 'Video',    icon: 'video',        accent: '#d97706' },
  other:   { label: 'File',     icon: 'file',         accent: '#64748b' },
};

export function humanSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
