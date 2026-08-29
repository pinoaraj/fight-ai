import type { Metadata } from 'next';
import './globals.css';
import './upgrade.css';
import './design.css';
import './redesign.css';
import './mobile-fix.css';
import './upload-emphasis.css';
import './layout-density.css';
import './status-ui.css';
import './hero-priority.css';

export const metadata: Metadata = {
  title: 'Fight AI',
  description: 'Análisis técnico y táctico de sparring con evidencia por timestamp.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
