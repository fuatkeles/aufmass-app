const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ============ TYPES ============
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Invitation {
  id: number;
  token: string;
  email: string;
  role: string;
  invited_by: number;
  invited_by_name?: string;
  expires_at: string;
  used_at?: string;
  created_at: string;
}

export interface WeiteresProdukt {
  id: string;
  category: string;
  productType: string;
  model: string;
  specifications: Record<string, string | number | boolean | string[]>;
}

export interface FormData {
  id?: number;
  datum: string;
  aufmasser: string;
  kundeVorname: string;
  kundeNachname: string;
  kundeEmail?: string;
  kundenlokation: string;
  category: string;
  productType: string;
  model: string;
  specifications: Record<string, unknown>;
  markiseData?: unknown;
  weitereProdukte?: WeiteresProdukt[];
  bemerkungen: string;
  status?: string;
  statusDate?: string;
  montageDatum?: string;
  created_at?: string;
  updated_at?: string;
  image_count?: number;
  pdf_count?: number;
  pdf_files?: { id: number; file_name: string; file_type: string }[];
}

export interface ApiForm {
  id: number;
  datum: string;
  aufmasser: string;
  kunde_vorname: string;
  kunde_nachname: string;
  kunde_email?: string;
  kundenlokation: string;
  category: string;
  product_type: string;
  model: string;
  specifications: string;
  markise_data: string | null;
  bemerkungen: string;
  status: string;
  status_date?: string;
  montage_datum?: string;
  created_at: string;
  updated_at: string;
  bilder?: { id: number; file_name: string; file_type: string }[];
  weitereProdukte?: WeiteresProdukt[];
  image_count?: number;
  pdf_count?: number;
  pdf_files?: { id: number; file_name: string; file_type: string }[];
}

export interface Stats {
  total: number;
  completed: number;
  draft: number;
}

// ============ AUTH HELPERS ============
const TOKEN_KEY = 'aylux_auth_token';
const USER_KEY = 'aylux_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function setAuthData(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthData(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper for authenticated fetch
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });

  // If unauthorized, clear auth data
  if (response.status === 401 || response.status === 403) {
    clearAuthData();
  }

  return response;
}

// ============ AUTH API ============

// Login
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  setAuthData(data.token, data.user);
  return data;
}

// Register with invitation token
export async function register(token: string, name: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  const data = await response.json();
  setAuthData(data.token, data.user);
  return data;
}

// Verify invitation token
export async function verifyInvitation(token: string): Promise<{ email: string; role: string; expires_at: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-invite/${token}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Invalid invitation');
  }

  return response.json();
}

// Get current user
export async function getCurrentUser(): Promise<User> {
  const response = await authFetch(`${API_BASE_URL}/auth/me`);

  if (!response.ok) {
    throw new Error('Failed to get user');
  }

  return response.json();
}

// Change password
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }

  return response.json();
}

// Logout
export function logout(): void {
  clearAuthData();
}

// ============ USER MANAGEMENT (Admin) ============

// Get all users
export async function getUsers(): Promise<User[]> {
  const response = await authFetch(`${API_BASE_URL}/users`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

// Update user
export async function updateUser(id: number, data: Partial<User>): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user');
  }
  return response.json();
}

// Delete user
export async function deleteUser(id: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete user');
  }
  return response.json();
}

// ============ INVITATIONS (Admin) ============

// Create invitation
export async function createInvitation(email: string, role: string = 'user'): Promise<{ inviteLink: string; token: string; expiresAt: string }> {
  const response = await authFetch(`${API_BASE_URL}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create invitation');
  }
  return response.json();
}

// Get all invitations
export async function getInvitations(): Promise<Invitation[]> {
  const response = await authFetch(`${API_BASE_URL}/invitations`);
  if (!response.ok) throw new Error('Failed to fetch invitations');
  return response.json();
}

// Delete invitation
export async function deleteInvitation(id: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/invitations/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete invitation');
  return response.json();
}

// ============ FORMS API ============

// Transform API response to frontend format
function transformApiToFrontend(apiForm: ApiForm): FormData {
  return {
    id: apiForm.id,
    datum: apiForm.datum?.split('T')[0] || '',
    aufmasser: apiForm.aufmasser,
    kundeVorname: apiForm.kunde_vorname,
    kundeNachname: apiForm.kunde_nachname,
    kundeEmail: apiForm.kunde_email || '',
    kundenlokation: apiForm.kundenlokation,
    category: apiForm.category,
    productType: apiForm.product_type,
    model: apiForm.model,
    specifications: apiForm.specifications ? JSON.parse(apiForm.specifications) : {},
    markiseData: apiForm.markise_data ? JSON.parse(apiForm.markise_data) : null,
    weitereProdukte: apiForm.weitereProdukte || [],
    bemerkungen: apiForm.bemerkungen || '',
    status: apiForm.status,
    statusDate: apiForm.status_date?.split('T')[0] || '',
    montageDatum: apiForm.montage_datum?.split('T')[0] || '',
    created_at: apiForm.created_at,
    updated_at: apiForm.updated_at,
    image_count: apiForm.image_count,
    pdf_count: apiForm.pdf_count,
    pdf_files: apiForm.pdf_files
  };
}

// Health check
export async function checkHealth(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

// Get all forms
export async function getForms(): Promise<FormData[]> {
  const response = await authFetch(`${API_BASE_URL}/forms`);
  if (!response.ok) throw new Error('Failed to fetch forms');
  const data: ApiForm[] = await response.json();
  return data.map(transformApiToFrontend);
}

// Get single form
export async function getForm(id: number): Promise<FormData & { bilder?: { id: number; file_name: string; file_type: string }[] }> {
  const response = await authFetch(`${API_BASE_URL}/forms/${id}`);
  if (!response.ok) throw new Error('Failed to fetch form');
  const data: ApiForm = await response.json();
  return {
    ...transformApiToFrontend(data),
    bilder: data.bilder
  };
}

// Create form
export async function createForm(formData: Omit<FormData, 'id'>): Promise<{ id: number; message: string }> {
  const response = await authFetch(`${API_BASE_URL}/forms`, {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  if (!response.ok) throw new Error('Failed to create form');
  return response.json();
}

// Update form
export async function updateForm(id: number, formData: Partial<FormData>): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/forms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(formData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update form');
  }
  return response.json();
}

// Delete form
export async function deleteForm(id: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/forms/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete form');
  return response.json();
}

// ============ STATUS HISTORY ============

export interface StatusHistoryEntry {
  id: number;
  form_id: number;
  status: string;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
  status_date: string | null;
  notes: string | null;
}

export async function getStatusHistory(formId: number): Promise<StatusHistoryEntry[]> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/status-history`);
  if (!response.ok) throw new Error('Failed to fetch status history');
  return response.json();
}

// ============ ABNAHME ============

export interface AbnahmeData {
  id?: number;
  formId: number;
  istFertig: boolean;
  hatProbleme: boolean;
  problemBeschreibung?: string;
  maengelListe?: string[]; // Numbered list of defects (1, 2, 3, ...)
  maengelBilder?: AbnahmeImage[]; // Mängel photos
  baustelleSauber?: 'ja' | 'nein' | null; // Baustelle wurde sauber und aufgeräumt gelassen
  monteurNote?: number | null; // Schulnote 1-6
  kundeName?: string;
  kundeUnterschrift: boolean;
  abnahmeDatum?: string;
  bemerkungen?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getAbnahme(formId: number): Promise<AbnahmeData | null> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/abnahme`);
  if (!response.ok) throw new Error('Failed to fetch abnahme');
  return response.json();
}

export async function saveAbnahme(formId: number, data: Partial<AbnahmeData>): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/abnahme`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to save abnahme');
  return response.json();
}

// Upload images
export async function uploadImages(formId: number, files: File[]): Promise<{ message: string }> {
  const formData = new window.FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/forms/${formId}/images`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
  });
  if (!response.ok) throw new Error('Failed to upload images');
  return response.json();
}

// Get image URL
export function getImageUrl(imageId: number): string {
  return `${API_BASE_URL}/images/${imageId}`;
}

// Upload temporary file (returns URL for PDF linking)
export async function uploadTempFile(file: File): Promise<{ id: number; url: string; fileName: string }> {
  const formData = new window.FormData();
  formData.append('file', file);

  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/upload-temp`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
  });

  if (!response.ok) throw new Error('Failed to upload file');
  return response.json();
}

// Delete image
export async function deleteImage(imageId: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/images/${imageId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete image');
  return response.json();
}

// ============ ABNAHME/MÄNGEL IMAGES ============

export interface AbnahmeImage {
  id: number;
  file_name: string;
  file_type: string;
  created_at: string;
}

// Upload Mängel/Abnahme images
export async function uploadAbnahmeImages(formId: number, files: File[]): Promise<{ message: string }> {
  const formData = new window.FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/forms/${formId}/abnahme-images`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
  });
  if (!response.ok) throw new Error('Failed to upload Mängel images');
  return response.json();
}

// Get Abnahme images list
export async function getAbnahmeImages(formId: number): Promise<AbnahmeImage[]> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/abnahme-images`);
  if (!response.ok) throw new Error('Failed to get Mängel images');
  return response.json();
}

// Get Abnahme image URL
export function getAbnahmeImageUrl(imageId: number): string {
  return `${API_BASE_URL}/abnahme-images/${imageId}`;
}

// Delete Abnahme image
export async function deleteAbnahmeImage(imageId: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/abnahme-images/${imageId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete Mängel image');
  return response.json();
}

// Get stats
export async function getStats(): Promise<Stats> {
  const response = await authFetch(`${API_BASE_URL}/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

// ============ MONTAGETEAM API ============

export interface Montageteam {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface MontageteamStats {
  id: number;
  montageteam: string;
  is_active: boolean;
  created_at: string;
  count: number;
  completed: number;
  draft: number;
}

// Get Montageteam stats (with project counts)
export async function getMontageteamStats(): Promise<MontageteamStats[]> {
  const response = await authFetch(`${API_BASE_URL}/stats/montageteam`);
  if (!response.ok) throw new Error('Failed to fetch montageteam stats');
  return response.json();
}

// Get all montageteams
export async function getMontageteams(): Promise<Montageteam[]> {
  const response = await authFetch(`${API_BASE_URL}/montageteams`);
  if (!response.ok) throw new Error('Failed to fetch montageteams');
  return response.json();
}

// Create montageteam
export async function createMontageteam(name: string): Promise<Montageteam> {
  const response = await authFetch(`${API_BASE_URL}/montageteams`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create montageteam');
  }
  return response.json();
}

// Update montageteam
export async function updateMontageteam(id: number, data: { name?: string; is_active?: boolean }): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/montageteams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update montageteam');
  }
  return response.json();
}

// Delete montageteam
export async function deleteMontageteam(id: number): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/montageteams/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete montageteam');
  return response.json();
}

// ============ PDF STORAGE ============

export interface PdfStatus {
  hasPdf: boolean;
  pdfGeneratedAt: string | null;
  isOutdated: boolean;
  needsRegeneration: boolean;
}

// Save generated PDF for a form
export async function savePdf(formId: number, pdfBlob: Blob): Promise<{ message: string }> {
  const formData = new window.FormData();
  formData.append('pdf', pdfBlob, `aufmass_${formId}.pdf`);

  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/forms/${formId}/pdf`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
  });
  if (!response.ok) throw new Error('Failed to save PDF');
  return response.json();
}

// Get PDF URL for a form (for iframe/embed)
export function getPdfUrl(formId: number): string {
  const token = getStoredToken();
  return `${API_BASE_URL}/forms/${formId}/pdf?token=${token}`;
}

// Get PDF blob for a form
export async function getPdfBlob(formId: number): Promise<Blob> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/pdf`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get PDF' }));
    throw new Error(error.error || 'Failed to get PDF');
  }
  return response.blob();
}

// Check PDF status for a form
export async function getPdfStatus(formId: number): Promise<PdfStatus> {
  const response = await authFetch(`${API_BASE_URL}/forms/${formId}/pdf/status`);
  if (!response.ok) throw new Error('Failed to check PDF status');
  return response.json();
}
