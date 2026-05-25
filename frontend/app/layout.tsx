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
  return (
    <html lang="en">
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
