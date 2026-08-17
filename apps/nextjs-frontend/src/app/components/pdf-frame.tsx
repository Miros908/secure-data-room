'use client';

import { useLayoutEffect, useRef } from 'react';

type PdfFrameProps = {
  src: string;
  title: string;
  className?: string;
};

export function pdfViewerSrc(src: string): string {
  const hashIndex = src.indexOf('#');
  if (hashIndex === -1) {
    return `${src}#toolbar=0`;
  }

  const hash = src.slice(hashIndex + 1);
  if (/(?:^|&)toolbar=/.test(hash)) {
    return src;
  }

  return hash.length === 0 ? `${src}toolbar=0` : `${src}&toolbar=0`;
}

export function PdfFrame({ src, title, className }: PdfFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const viewerSrc = pdfViewerSrc(src);

  useLayoutEffect(() => {
    const iframe = ref.current;
    if (!iframe) {
      return;
    }

    try {
      iframe.contentWindow?.location.replace(viewerSrc);
    } catch {
      iframe.src = viewerSrc;
    }
  }, [viewerSrc]);

  return (
    <iframe
      ref={ref}
      title={title}
      data-pdf-src={src}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
