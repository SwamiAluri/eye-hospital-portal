/** Shared retinoscopy segment shapes (wet / dry / subjective). */

export interface RetinoscopyReading {
  id: string;
  sphere: number;
  cylinder?: number;
  axis?: number;
  workingDistance: number;
}

export interface WetRetinoscopyData {
  drug?: string;
  duration?: number;
  timeAdministered?: string;
  odReadings: RetinoscopyReading[];
  osReadings: RetinoscopyReading[];
}

export interface DryRetinoscopyData {
  odReadings: RetinoscopyReading[];
  osReadings: RetinoscopyReading[];
}

export interface SubjectiveRefractionReading {
  id: string;
  entryNumber: number;
  odSphere: number;
  odCylinder?: number;
  odAxis?: number;
  osSphere: number;
  osCylinder?: number;
  osAxis?: number;
  vaAchievedOD: string;
  vaAchievedOS: string;
  isFinal: boolean;
}

export interface SubjectiveRefractionData {
  readings: SubjectiveRefractionReading[];
}
