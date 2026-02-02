import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import AppWrapper from './AppWrapper'
import { useBranchMeta } from './hooks/useBranchMeta'

// Wrapper to apply branch-specific meta tags
function BranchMetaWrapper({ children }: { children: React.ReactNode }) {
  const branch = useBranchMeta();

  useEffect(() => {
    // Update manifest name dynamically
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest && branch.slug !== 'dev') {
      // Could dynamically generate manifest here if needed
    }
  }, [branch]);

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <BranchMetaWrapper>
            <AppWrapper />
          </BranchMetaWrapper>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
