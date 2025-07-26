export interface TemplateField {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
}

export interface PhotoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  templateImagePath: string;
  templateDimensions: {
    width: number;
    height: number;
  };
  photoPlacement: PhotoPlacement;
  textFields: TemplateField[];
}

export interface School {
    id: string;
    name: string;
    adminEmail: string; // For backward compatibility
    loginEmail?: string; // New field name
    adminUid?: string;
    createdAt?: Date;
    status?: string;
    templateConfig: TemplateConfig | null;
}

export interface PreviewData {
  [key: string]: string | File | undefined;
}

// Template presets for common ID card dimensions
export const TEMPLATE_PRESETS = {
  STANDARD_ID: { width: 856, height: 540, name: "Standard ID Card (856x540)" },
  CREDIT_CARD: { width: 1056, height: 672, name: "Credit Card Style (1056x672)" },
  PASSPORT: { width: 1250, height: 884, name: "Passport Style (1250x884)" },
  BUSINESS_CARD: { width: 1050, height: 600, name: "Business Card (1050x600)" },
  CUSTOM: { width: 0, height: 0, name: "Custom Dimensions" }
} as const;

export type TemplatePreset = keyof typeof TEMPLATE_PRESETS;

// Professional fonts commonly used on ID cards
export const PROFESSIONAL_FONTS = {
  ARIAL: { value: "Arial, sans-serif", label: "Arial" },
  HELVETICA: { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  TIMES_NEW_ROMAN: { value: "Times New Roman, serif", label: "Times New Roman" },
  GEORGIA: { value: "Georgia, serif", label: "Georgia" },
  VERDANA: { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
} as const;

export type ProfessionalFont = keyof typeof PROFESSIONAL_FONTS;

// Professional color palette for ID cards
export const PROFESSIONAL_COLORS = {
  BLACK: { value: "#000000", label: "Black" },
  DARK_GRAY: { value: "#333333", label: "Dark Gray" },
  NAVY_BLUE: { value: "#1e3a8a", label: "Navy Blue" },
  DARK_GREEN: { value: "#166534", label: "Dark Green" },
  BURGUNDY: { value: "#7f1d1d", label: "Burgundy" },
  DARK_BROWN: { value: "#78350f", label: "Dark Brown" },
  CHARCOAL: { value: "#374151", label: "Charcoal" },
  DARK_SLATE: { value: "#475569", label: "Dark Slate" },
  WHITE: { value: "#FFFFFF", label: "White" }, // Added white
} as const;

export type ProfessionalColor = keyof typeof PROFESSIONAL_COLORS;
