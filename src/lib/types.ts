export interface TemplateField {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
}

export interface PhotoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  templateImagePath: string;
  photoPlacement: PhotoPlacement;
  textFields: TemplateField[];
}

export interface School {
    id: string;
    name: string;
    loginId: string;
    templateConfig: TemplateConfig | null;
}

export interface PreviewData {
  [key: string]: string | File | null;
}
