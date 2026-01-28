import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBot, updateBotBackstory } from '../lib/chatbotkit';
import { CHATBOTKIT_USER_ID } from '../lib/config';

export default function BotEditor() {
  const { id: botId } = useParams<{ id: string }>();
  
  const [bot, setBot] = useState<any>(null);
  const [backstory, setBackstory] = useState('');
  const [originalBackstory, setOriginalBackstory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadBot();
  }, [botId]);

  async function loadBot() {
    if (!CHATBOTKIT_USER_ID) return;
    try {
      const botData = await getBot(CHATBOTKIT_USER_ID, botId!);
      setBot(botData);
      setBackstory(botData.backstory || '');
      setOriginalBackstory(botData.backstory || '');
    } catch (err) {
      console.error('Kon bot niet laden:', err);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!CHATBOTKIT_USER_ID || !botId) return;
    
    setSaving(true);
    setSaved(false);
    
    try {
      await updateBotBackstory(CHATBOTKIT_USER_ID, botId, backstory);
      setOriginalBackstory(backstory);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Kon niet opslaan:', err);
      alert('Er ging iets mis bij het opslaan');
    }
    
    setSaving(false);
  }

  const hasChanges = backstory !== originalBackstory;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-gray-700">← Terug</Link>
            <h1 className="text-xl font-bold text-gray-900">{bot?.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-green-600 text-sm">✓ Opgeslagen!</span>}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Backstory / Prompt
          </label>
          <textarea
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Beschrijf de persoonlijkheid van je chatbot..."
          />
          <div className="mt-2 flex justify-between text-sm text-gray-500">
            <span>{backstory.length} tekens</span>
            {hasChanges && <span className="text-orange-500">Niet-opgeslagen wijzigingen</span>}
          </div>
        </div>
      </main>
    </div>
  );
}
