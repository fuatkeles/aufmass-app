import { ProductSelection, DynamicFormData } from './productConfig';

// Server image object type
export interface ServerImage {
  id: number;
  file_name: string;
  file_type: string;
}

export interface FormData {
  // Grunddaten (Common data for all products)
  id?: string; // For database
  datum: string;
  aufmasser: string;
  kundeVorname: string;
  kundeNachname: string;
  kundenlokation: string;

  // Product Selection
  productSelection: ProductSelection;

  // Dynamic product-specific fields
  specifications: DynamicFormData;

  // Additional data
  bilder: (File | ServerImage)[]; // Image files or server image objects
  bemerkungen: string; // Notes/remarks

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  status?: 'draft' | 'completed' | 'archived';
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
