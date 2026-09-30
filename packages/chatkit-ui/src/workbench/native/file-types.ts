export type FileKind =
  | 'text'
  | 'markdown'
  | 'html'
  | 'docx'
  | 'spreadsheet'
  | 'pptx'
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'unsupported';
const extensions: Record<string, FileKind> = {
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  docx: 'docx',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
  tsv: 'spreadsheet',
  pptx: 'pptx',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  svg: 'image',
  avif: 'image',
  bmp: 'image',
  ico: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  flac: 'audio',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
};
const textExtensions = new Set([
  'txt',
  'log',
  'json',
  'jsonc',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'env',
  'sh',
  'bash',
  'zsh',
  'py',
  'sql',
  'rs',
  'go',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'rb',
  'php',
  'vue',
  'svelte',
  'graphql',
  'gitignore',
  'dockerignore',
  'lock',
  'properties',
]);
export function fileKind(path: string, mime = ''): FileKind {
  const name = path.split('/').pop()?.toLowerCase() ?? '';
  const extension = name.split('.').pop() ?? '';
  if (extensions[extension]) return extensions[extension];
  if (
    textExtensions.has(extension) ||
    name === 'dockerfile' ||
    name === 'makefile'
  )
    return 'text';
  if (mime.startsWith('text/')) return 'text';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'unsupported';
}
export const editableKinds: FileKind[] = [
  'text',
  'markdown',
  'html',
  'docx',
  'spreadsheet',
  'pptx',
];
export async function sameFileBytes(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const bytes = new Uint8Array(right);
  return new Uint8Array(left).every((byte, index) => byte === bytes[index]);
}
export type BinaryEditorHandle = { exportFile: () => Promise<Blob> };
export type BinaryEditorProps = {
  blob: Blob;
  name: string;
  onDirty: () => void;
};
