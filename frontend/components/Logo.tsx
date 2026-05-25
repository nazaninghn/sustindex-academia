'use client';
import Image from 'next/image';

interface LogoProps {
  size?: number;
  dark?: boolean;
}

export default function Logo({ size = 18, dark = false }: LogoProps) {
  const ink = dark ? '#F9EFE5' : '#1A1A14';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Image
        src="/assets/logo-leaf.png"
        alt="sustindex leaf"
        width={Math.round(size * 1.4)}
        height={Math.round(size * 1.4)}
        style={{ objectFit: 'contain', display: 'block' }}
      />
      <span style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 600, fontSize: size * 0.82,
        letterSpacing: '-0.02em', color: ink,
      }}>
        sustindex
      </span>
    </span>
  );
}
