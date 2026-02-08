export function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 40 }}>
          Last updated: February 2025
        </p>

        <Section title="Overview">
          <p>
            OpenSheet is a browser-based data exploration tool. Your privacy is fundamental to how
            we built it: <strong>all data processing happens locally in your browser</strong>. We do not
            operate servers that store, process, or have access to your data.
          </p>
        </Section>

        <Section title="Data We Collect">
          <p>
            <strong>We do not collect any personal data.</strong> OpenSheet runs entirely in your
            browser using technologies like DuckDB WASM for data processing. There are no analytics,
            no tracking pixels, no cookies, and no server-side logging.
          </p>
          <p>
            Files you open in OpenSheet are processed locally and never leave your device.
          </p>
        </Section>

        <Section title="Local Storage">
          <p>
            OpenSheet stores the following data locally on your device using browser storage
            (localStorage and IndexedDB):
          </p>
          <ul>
            <li><strong>Application settings</strong> — theme preference, accent color, AI API key (if provided)</li>
            <li><strong>Google account tokens</strong> — OAuth access tokens for Google Sheets integration (encrypted by your browser)</li>
            <li><strong>Sheet metadata</strong> — names, IDs, and sync timestamps of imported Google Sheets</li>
            <li><strong>File handles</strong> — references to local files for session restoration</li>
          </ul>
          <p>
            This data never leaves your device. You can clear it at any time through your browser
            settings or by disconnecting your Google account within the app.
          </p>
        </Section>

        <Section title="Google Sheets Integration">
          <p>
            When you connect your Google account, OpenSheet requests the following permissions (OAuth scopes):
          </p>
          <ul>
            <li>
              <strong>Google Sheets</strong> (<code>spreadsheets</code>) — To read spreadsheet data
              into your browser and write back changes you make (two-way sync).
            </li>
            <li>
              <strong>Google Drive</strong> (<code>drive</code>) — To list your spreadsheets, display
              file names, and detect when files have been modified externally.
            </li>
            <li>
              <strong>Email &amp; Profile</strong> (<code>userinfo.email</code>, <code>userinfo.profile</code>) —
              To display your name and profile photo in the app so you know which account is connected.
            </li>
          </ul>
          <p>
            All communication with Google APIs happens <strong>directly from your browser</strong> to
            Google's servers. OpenSheet does not relay, intercept, or store your Google data on any
            intermediary server. Your Google access token is stored only in your browser's IndexedDB.
          </p>
          <p>
            You can disconnect your Google account at any time from the app, which revokes the access
            token and removes all stored Google data from your browser.
          </p>
        </Section>

        <Section title="AI Features (Optional)">
          <p>
            OpenSheet offers optional AI-powered features using the Anthropic API. To use these features,
            you provide your own API key, which is stored locally in your browser. API requests are sent
            directly from your browser to Anthropic's servers. OpenSheet does not proxy or log these requests.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            When you use integrations, your browser communicates directly with these services:
          </p>
          <ul>
            <li><strong>Google APIs</strong> (Sheets, Drive, OAuth) — governed by{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>
            </li>
            <li><strong>Anthropic API</strong> (optional) — governed by{' '}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">Anthropic's Privacy Policy</a>
            </li>
          </ul>
        </Section>

        <Section title="Children's Privacy">
          <p>
            OpenSheet is not directed at children under 13. We do not knowingly collect information
            from children.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy from time to time. Changes will be reflected on this page with
            an updated date.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            If you have questions about this privacy policy, you can reach us at{' '}
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
          section code {
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 4px;
            background: var(--surface-secondary);
            color: var(--text-primary);
          }
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

export default PrivacyPolicy;
