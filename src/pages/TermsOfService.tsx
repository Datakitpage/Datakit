export function TermsOfService() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        {/* Back link */}
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
            marginBottom: 32,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to OpenSheet
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 40 }}>
          Last updated: February 2025
        </p>

        <Section title="1. Service Description">
          <p>
            OpenSheet is a browser-based data exploration and spreadsheet tool. It runs entirely
            in your web browser — there are no user accounts, no server-side processing, and no
            cloud storage managed by OpenSheet.
          </p>
        </Section>

        <Section title="2. Acceptance of Terms">
          <p>
            By accessing or using OpenSheet, you agree to be bound by these Terms of Service. If you
            do not agree to these terms, please do not use the service.
          </p>
        </Section>

        <Section title="3. Your Data">
          <p>
            <strong>You retain all rights to your data.</strong> OpenSheet does not access, store,
            or transmit your data to any server we operate. All files and data you work with are
            processed locally in your browser.
          </p>
          <p>
            When you use the Google Sheets integration, data flows directly between your browser and
            Google's servers. OpenSheet acts as a client-side interface and does not intercept or
            store this data on any intermediary infrastructure.
          </p>
        </Section>

        <Section title="4. Google Sheets Integration">
          <p>
            OpenSheet's Google Sheets integration allows you to import, edit, and sync data with
            your Google Sheets. By using this feature:
          </p>
          <ul>
            <li>You authorize OpenSheet to access your Google Sheets and Drive data as described in our <a href="/#/privacy">Privacy Policy</a>.</li>
            <li>You are responsible for the data you access and any changes you push back to Google Sheets.</li>
            <li>You agree to comply with <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google's Terms of Service</a>.</li>
          </ul>
        </Section>

        <Section title="5. AI Features">
          <p>
            OpenSheet provides optional AI-powered features through the Anthropic API. To use them,
            you supply your own API key. You are responsible for:
          </p>
          <ul>
            <li>Keeping your API key secure.</li>
            <li>Any costs incurred through API usage.</li>
            <li>Complying with <a href="https://www.anthropic.com/terms" target="_blank" rel="noopener noreferrer">Anthropic's Terms of Service</a>.</li>
          </ul>
        </Section>

        <Section title="6. Acceptable Use">
          <p>
            You agree not to use OpenSheet to:
          </p>
          <ul>
            <li>Violate any applicable laws or regulations.</li>
            <li>Access Google Sheets or Drive data that you are not authorized to access.</li>
            <li>Interfere with or disrupt third-party services accessed through the app.</li>
            <li>Attempt to reverse engineer, decompile, or extract source code in violation of applicable licenses.</li>
          </ul>
        </Section>

        <Section title="7. Disclaimer of Warranties">
          <p>
            OpenSheet is provided <strong>"as is" and "as available"</strong> without warranties of
            any kind, either express or implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, or non-infringement.
          </p>
          <p>
            We do not warrant that the service will be uninterrupted, error-free, or that data
            processed through OpenSheet will be accurate or complete.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, OpenSheet and its creators shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages, including but
            not limited to loss of data, loss of profits, or business interruption, arising out of
            or in connection with your use of the service.
          </p>
          <p>
            Since OpenSheet processes data locally in your browser, you are responsible for
            maintaining your own backups.
          </p>
        </Section>

        <Section title="9. Changes to These Terms">
          <p>
            We may update these terms from time to time. Changes will be reflected on this page with
            an updated date. Continued use of OpenSheet after changes constitutes acceptance of the
            updated terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have questions about these terms, you can reach us at{' '}
            <a href="https://amin.contact" target="_blank" rel="noopener noreferrer">amin.contact</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
        }}
      >
        {children}
        <style>{`
          section p { margin: 0 0 12px; }
          section ul { margin: 0 0 12px; padding-left: 20px; }
          section li { margin-bottom: 8px; }
          section a {
            color: var(--primary, #3b82f6);
            text-decoration: none;
          }
          section a:hover { text-decoration: underline; }
        `}</style>
      </div>
    </section>
  );
}

export default TermsOfService;
