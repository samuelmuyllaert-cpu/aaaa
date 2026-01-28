export const CHATBOTKIT_USER_ID = import.meta.env.VITE_CHATBOTKIT_USER_ID;
export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Mijn Bedrijf';

if (!CHATBOTKIT_USER_ID) {
  console.warn('VITE_CHATBOTKIT_USER_ID niet ingesteld in .env');
}
