'use client';

import React from 'react';
import { renderQrSvg } from '@/lib/qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 160, className }: QrCodeProps) {
  const svg = React.useMemo(() => renderQrSvg(value, size), [value, size]);

  return (
    <div
      className={className}
      style={{ display: 'inline-block', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
