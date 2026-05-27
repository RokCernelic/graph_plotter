import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Grafikograf',
  description: 'Interaktivni pripomoček za ustvarjanje grafov za domače naloge iz fizike',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
