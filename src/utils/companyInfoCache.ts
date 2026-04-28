import { getBranchCompanyInfoPublic, type BranchCompanyInfo } from '../services/api';

let cached: BranchCompanyInfo | null = null;
let fetchPromise: Promise<BranchCompanyInfo | null> | null = null;

export const getCompanyInfoForPdf = async (): Promise<BranchCompanyInfo | null> => {
  if (cached) return cached;
  if (!fetchPromise) {
    fetchPromise = getBranchCompanyInfoPublic()
      .then((data) => {
        cached = data;
        return data;
      })
      .catch((err) => {
        console.warn('Could not fetch branch company info for PDF:', err);
        return null;
      });
  }
  return fetchPromise;
};

export const invalidateCompanyInfoCache = () => {
  cached = null;
  fetchPromise = null;
};
