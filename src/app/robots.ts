import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://exam.sagaya.id';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/tentang', '/fitur', '/panduan', '/faq', '/kontak'],
        disallow: [
          '/login',
          '/ujian',
          '/ujian/*',
          '/exam',
          '/exam/*',
          '/admin',
          '/admin/*',
          '/guru',
          '/guru/*',
          '/pengawas',
          '/pengawas/*',
          '/superadmin',
          '/superadmin/*',
          '/status',
          '/api/*',
          '/kartu/*',
          '/account/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
