import { ProductSelection, DynamicFormData } from './productConfig';

export interface FormData {
  // Grunddaten (Common data for all products)
  datum: string;
  aufmasser: string;
  montageteam: string;
  kundeVorname: string;
  kundeNachname: string;
  kundenlokation: string;

  // Product Selection
  productSelection: ProductSelection;

  // Dynamic product-specific fields
  specifications: DynamicFormData;

  // Additional data
  bilder: string[]; // Image URLs or base64
  bemerkungen: string; // Notes/remarks
}

// Legacy interfaces (keeping for backward compatibility during migration)
export interface ExtrasData {
  statiktrager: string;
  freistehend: string;
  ledBeleuchtung: string;
  fundament: string;
  wasserablauf: string[];
  bauform: string;
  stutzen: string;
}

export interface BeschattungData {
  ancUnterglas: boolean;
  ancAufglas: boolean;
  capri: boolean;
  markise: string;
  breite: string;
  tiefe: string;
  volanTyp: string;
  antrieb: string;
  antriebsseite: string;
}
