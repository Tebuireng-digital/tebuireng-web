import { useEffect } from 'react';

interface PageMetaOptions {
  title?: string;
  description?: string;
  ogImage?: string;
}

export function usePageMeta({ title, description, ogImage = '/simanteb-logo-transparent.png' }: PageMetaOptions) {
  useEffect(() => {
    if (!title) return;

    // 1. Update Document Title
    const fullTitle = title.endsWith('SIMANTEB') ? title : `${title} · SIMANTEB`;
    document.title = fullTitle;

    // 2. Update Meta Description
    const metaDesc = description || 'Sistem Manajemen Tebuireng (SIMANTEB) - Kelola kegiatan absensi, perizinan, dan pendataan santri Pondok Pesantren Tebuireng.';
    let descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descTag) {
      descTag = document.createElement('meta');
      descTag.name = 'description';
      document.head.appendChild(descTag);
    }
    descTag.content = metaDesc;

    // Helper for OG and Twitter meta tags
    const updateMetaProperty = (property: string, content: string, isName = false) => {
      const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
      let tag = document.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement('meta');
        if (isName) {
          tag.name = property;
        } else {
          tag.setAttribute('property', property);
        }
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    // 3. Open Graph Tags
    updateMetaProperty('og:title', fullTitle);
    updateMetaProperty('og:description', metaDesc);
    updateMetaProperty('og:image', ogImage);

    // 4. Twitter Card Tags
    updateMetaProperty('twitter:title', fullTitle, true);
    updateMetaProperty('twitter:description', metaDesc, true);
    updateMetaProperty('twitter:image', ogImage, true);
  }, [title, description, ogImage]);
}
