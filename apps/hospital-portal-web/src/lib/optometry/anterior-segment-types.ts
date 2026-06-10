/** Anterior segment examination payloads (visit segments). */

export interface PupilExamData {
  sizeLightOD?: number;
  sizeDarkOD?: number;
  shapeOD?: string;
  directReactionOD?: string;
  consensualReactionOD?: string;
  sizeLightOS?: number;
  sizeDarkOS?: number;
  shapeOS?: string;
  directReactionOS?: string;
  consensualReactionOS?: string;
  rapdPresent?: boolean;
  rapdEye?: 'OD' | 'OS' | null;
}

export interface AnteriorSegmentExamData {
  lidsOD?: string;
  conjunctivaOD?: string;
  scleraOD?: string;
  lacrimalOD?: string;
  lidsOS?: string;
  conjunctivaOS?: string;
  scleraOS?: string;
  lacrimalOS?: string;
  corneaOD?: string;
  acOD?: string;
  acDepthOD?: string;
  corneaOS?: string;
  acOS?: string;
  acDepthOS?: string;
  irisOD?: string;
  lensOD?: string;
  lensOpacityGradeOD?: string;
  irisOS?: string;
  lensOS?: string;
  lensOpacityGradeOS?: string;
}

export interface AnteriorTabSavePayload {
  pupil: PupilExamData;
  segment: AnteriorSegmentExamData;
}
