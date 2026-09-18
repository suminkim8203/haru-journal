import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Haru', description: '계획, 보낸 시간, 단상과 회고' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>;}
