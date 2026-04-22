import type { AppLanguage } from './locale'
import { interpolateTemplate } from './appShellStrings'

/** Electron 原生文件/保存对话框（与菜单语言同步） */
export type IpcDialogStrings = {
  saveImageTitle: string
  loadImageTitle: string
  exportContainerTitle: string
  tarFilterName: string
  allFilesFilterName: string
  containerDownloadTitle: string
  containerDownloadMessage: string
  containerDownloadSaveLabel: string
  containerUploadTitle: string
  /** 含 {{destDir}}、{{maxBytes}} */
  containerUploadMessageTemplate: string
  containerUploadButtonLabel: string
  /** 含 {{fileName}}、{{maxBytes}} */
  uploadFileTooLargeTemplate: string
}

const ZH: IpcDialogStrings = {
  saveImageTitle: '保存镜像',
  loadImageTitle: '导入镜像',
  exportContainerTitle: '导出容器',
  tarFilterName: 'Tar 归档',
  allFilesFilterName: '所有文件',
  containerDownloadTitle: '从容器下载',
  containerDownloadMessage:
    '将把所选路径（文件或目录）打包为 .tar 保存到本地。',
  containerDownloadSaveLabel: '保存',
  containerUploadTitle: '上传到容器',
  containerUploadMessageTemplate:
    '目标目录：{{destDir}}\n可多选文件；单个文件不超过 {{maxBytes}} 字节。',
  containerUploadButtonLabel: '上传',
  uploadFileTooLargeTemplate: '「{{fileName}}」超过 {{maxBytes}} 字节',
}

const EN: IpcDialogStrings = {
  saveImageTitle: 'Save image',
  loadImageTitle: 'Load image',
  exportContainerTitle: 'Export container',
  tarFilterName: 'Tar archive',
  allFilesFilterName: 'All files',
  containerDownloadTitle: 'Download from container',
  containerDownloadMessage: 'The selected path will be packed into a .tar file on your computer.',
  containerDownloadSaveLabel: 'Save',
  containerUploadTitle: 'Upload to container',
  containerUploadMessageTemplate:
    'Target directory: {{destDir}}\nMultiple files allowed; each file up to {{maxBytes}} bytes.',
  containerUploadButtonLabel: 'Upload',
  uploadFileTooLargeTemplate: '"{{fileName}}" exceeds {{maxBytes}} bytes',
}

export function getIpcDialogStrings(lng: AppLanguage): IpcDialogStrings {
  return lng === 'en' ? EN : ZH
}

export function formatContainerUploadMessage(
  s: IpcDialogStrings,
  destDir: string,
  maxBytes: number,
): string {
  return interpolateTemplate(s.containerUploadMessageTemplate, {
    destDir,
    maxBytes: String(maxBytes),
  })
}

export function formatUploadFileTooLarge(s: IpcDialogStrings, fileName: string, maxBytes: number): string {
  return interpolateTemplate(s.uploadFileTooLargeTemplate, {
    fileName,
    maxBytes: String(maxBytes),
  })
}
