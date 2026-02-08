import { HelmetProvider, Helmet } from 'react-helmet-async';
import { OpenSheet } from '@/pages/OpenSheet';
import { GoogleOAuthCallback } from '@/pages/GoogleOAuthCallback';
import { PrivacyPolicy } from '@/pages/PrivacyPolicy';
import { TermsOfService } from '@/pages/TermsOfService';

const APP_NAME = 'OpenSheet';
const APP_DESCRIPTION = 'A modern spreadsheet and data exploration tool. Analyze and transform your data with ease.';
const APP_URL = 'https://opensheet.app';
const APP_AUTHOR = 'Amin Khorrami';
const APP_AUTHOR_URL = 'https://amin.contact';

function App() {
  // Handle standalone routes
  if (window.location.pathname === '/oauth/google/callback') {
    return <GoogleOAuthCallback />;
  }
  const hash = window.location.hash;
  if (hash === '#/privacy') {
    return <PrivacyPolicy />;
  }
  if (hash === '#/terms') {
    return <TermsOfService />;
  }

  return (
    <HelmetProvider>
      <Helmet>
        <title>{APP_NAME}</title>
        <meta name="description" content={APP_DESCRIPTION} />
        <meta name="application-name" content={APP_NAME} />
        <meta name="author" content={APP_AUTHOR} />
        <link rel="author" href={APP_AUTHOR_URL} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={APP_URL} />
        <meta property="og:title" content={APP_NAME} />
        <meta property="og:description" content={APP_DESCRIPTION} />
        <meta property="og:image" content={`${APP_URL}/og-image.png`} />
        <meta property="og:site_name" content={APP_NAME} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={APP_URL} />
        <meta name="twitter:title" content={APP_NAME} />
        <meta name="twitter:description" content={APP_DESCRIPTION} />
        <meta name="twitter:image" content={`${APP_URL}/og-image.png`} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={APP_URL} />
      </Helmet>
      <OpenSheet />
    </HelmetProvider>
  );
}

export default App;
