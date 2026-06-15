import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
});

export const metadata = {
  title: 'Panel PR',
  description: 'Sistem Management · Relații Publice',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('pr_theme');
              if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
