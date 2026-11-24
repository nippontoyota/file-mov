'use client';

import React from 'react';

interface PrintButtonProps {
  label?: string;
  className?: string;
}

export function PrintButton({ label = 'Print Document', className }: PrintButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
