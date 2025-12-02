export type FieldType = 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'boolean' | 'textarea' | 'fundament' | 'bauform' | 'conditional' | 'modelColorSelect' | 'markise_trigger';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  required: boolean;
  placeholder?: string;
}

export interface ProductTypeConfig {
  models: string[];
  fields: FieldConfig[];
}

export interface CategoryConfig {
  [productType: string]: ProductTypeConfig;
}

export interface ProductConfig {
  [category: string]: CategoryConfig;
}

export interface ProductSelection {
  category: string;
  productType: string;
  model: string;
}

export interface DynamicFormData {
  [fieldName: string]: string | number | boolean | string[];
}
