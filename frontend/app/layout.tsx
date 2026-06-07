import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { LangProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Sustindex — Sustainability Performance Assessment',
  description:
    'A comprehensive ESG measurement platform — score your performance, benchmark against peers, and generate board-ready reports aligned with ISO 26000, GRI, and SASB.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Fix C-01: JSX comment nodes are siblings in the return — two roots crash
  // compilation.  Moved to a JS-style // comment here (outside JSX).
  // Fix H-07 / L-10: suppressHydrationWarning prevents the React hydration
  // mismatch warning caused by LangProvider's useEffect updating lang="en"
  // to "tr" on the client side after SSR.  The attribute is intentionally
  // different between server render and first paint.
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LangProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
