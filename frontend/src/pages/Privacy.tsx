import { SEO } from "@/components/common/SEO";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <>
      <SEO 
        title="Privacy Policy - DataKit"
        description="DataKit's privacy policy - Learn how we protect your data and what analytics we collect"
      />
      
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back button */}
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to DataKit
          </Link>
          
          <h1 className="text-2xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Your Data Stays Local</h2>
              <p className="mb-4">
                DataKit processes all your files locally in your browser. Your data never leaves your device. 
                We don't upload, store, or have access to any of your files or their contents.
              </p>
              
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">DataKit AI Models - Column Schema Only</h3>
                <p className="text-sm text-foreground">
                  <strong>Important exception:</strong> When you use DataKit's built-in AI models (powered by Anthropic's Claude), 
                  only your column names and data types are shared with our AI service to generate accurate SQL queries. 
                  Your actual data rows remain completely private and local to your browser.
                </p>
                <p className="text-sm text-foreground mt-2">
                  For example, if you have a CSV with columns like "customer_name", "order_date", "amount" - 
                  only these column names and their types (text, date, number) are sent to help the AI understand 
                  your data structure. The actual customer names, dates, and amounts stay in your browser.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Our Two-Tiered Analytics System</h2>
              <p className="mb-3">We use a privacy-first approach with two levels of analytics:</p>
              
              <div className="bg-accent/5 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-foreground mb-2">Basic Analytics (Always Active, No Consent Required):</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Page views and basic navigation</li>
                  <li>• Performance metrics (query execution times, file load speeds)</li>
                  <li>• Error reports (JavaScript errors to help us fix bugs)</li>
                  <li>• Feature access patterns (anonymous)</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  These metrics help us understand app stability and performance without any personal data.
                </p>
              </div>

              <div className="bg-accent/5 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-foreground mb-2">Advanced Analytics (With Your Consent):</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Detailed feature usage (which tabs you visit, chart types you create)</li>
                  <li>• Session recordings (with sensitive data masked)</li>
                  <li>• User journey tracking</li>
                  <li>• File metadata (file types and sizes, not content)</li>
                </ul>
              </div>

              <div className="bg-accent/5 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">What We Never Collect:</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Your uploaded files or their content (actual data rows)</li>
                  <li>• SQL queries or code you write</li>
                  <li>• Personal information or identifying data</li>
                  <li>• Unmasked sensitive form inputs</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  <em>Note: When using DataKit AI models, only column schemas (names and types) are processed by our AI service - never your actual data.</em>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Third-Party Services</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Analytics Provider</h3>
                  <p className="text-sm">
                    We use PostHog for analytics, a product analytics platform. 
                    PostHog helps us understand how you use DataKit while respecting your privacy through 
                    our two-tiered consent system. Basic anonymous metrics are collected to improve app 
                    stability, while advanced tracking requires your explicit consent.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground mb-2">AI Service Provider</h3>
                  <p className="text-sm mb-2">
                    DataKit's built-in AI models are powered by Anthropic's Claude API. When you use these models:
                  </p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Only your table column names and data types are sent to Anthropic</li>
                    <li>• Your prompts and questions are processed to generate SQL queries</li>
                    <li>• No actual data content is ever transmitted</li>
                    <li>• Anthropic processes this information according to their privacy policy</li>
                    <li>• You can always use your own API keys (OpenAI, Anthropic, etc.) for full control</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Your Choices</h2>
              <p className="mb-2">
                You can accept or decline analytics at any time. DataKit works fully without analytics enabled.
              </p>
              <p>
                To change your preferences, click the privacy icon in the app or clear your browser data.
              </p>
            </section>


            <div className="text-sm text-muted-foreground mt-12 pt-8 border-t border-border">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Privacy;