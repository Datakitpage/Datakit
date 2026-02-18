/**
 * Google Picker API integration
 *
 * Uses the Google Picker to let users select spreadsheets from their Drive.
 * This works with the drive.file scope — only files the user explicitly
 * picks are accessible to the app.
 *
 * Requires:
 * - VITE_GOOGLE_API_KEY (API key with Picker API enabled)
 * - VITE_GOOGLE_CLIENT_ID (OAuth client ID, already used by oauth.ts)
 */

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

export interface PickerResult {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export function isPickerConfigured(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}

// Track whether the gapi picker library is loaded
let pickerApiLoaded = false;
let gapiLoadPromise: Promise<void> | null = null;

/**
 * Load the Google API client and Picker library
 */
function loadPickerApi(): Promise<void> {
  if (pickerApiLoaded) return Promise.resolve();
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if gapi script is already on the page
    if (window.gapi) {
      window.gapi.load('picker', {
        callback: () => {
          pickerApiLoaded = true;
          resolve();
        },
        onerror: () => reject(new Error('Failed to load Google Picker API')),
      });
      return;
    }

    // Load the gapi script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      window.gapi.load('picker', {
        callback: () => {
          pickerApiLoaded = true;
          resolve();
        },
        onerror: () => reject(new Error('Failed to load Google Picker API')),
      });
    };

    script.onerror = () => {
      gapiLoadPromise = null;
      reject(new Error('Failed to load Google API script'));
    };

    document.head.appendChild(script);
  });

  return gapiLoadPromise;
}

/**
 * Open the Google Picker to select a spreadsheet
 *
 * Returns the selected file info, or null if the user cancelled.
 */
export async function openSpreadsheetPicker(accessToken: string): Promise<PickerResult | null> {
  if (!API_KEY) {
    throw new Error('Google API key not configured. Set VITE_GOOGLE_API_KEY.');
  }

  await loadPickerApi();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            url: doc.url,
          });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
