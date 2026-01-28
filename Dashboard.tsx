import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBots, createBot } from '../lib/chatbotkit';
import { CHATBOTKIT_USER_ID, COMPANY_NAME } from '../lib/config';

interface Bot {
  id: string;
  name: string;
  backstory: string;
  datasetId?: string;
}

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  async function loadBots() {
    if (!CHATBOTKIT_USER_ID) {
      setLoading(false);
      return;
    }
    try {
      const botList = await getBots(CHATBOTKIT_USER_ID);
      setBots(botList);
    } catch (err) {
      console.error('Kon bots niet laden:', err);
    }
    setLoading(false);
  }

  async function handleCreateBot() {
    if (!newBotName.trim() || !CHATBOTKIT_USER_ID) return;
    
    setCreating(true);
    try {
      const defaultBackstory = `Je bent een vriendelijke klantenservice medewerker voor ${COMPANY_NAME}.`;
      await createBot(CHATBOTKIT_USER_ID, newBotName, defaultBackstory);
      await loadBots();
      setNewBotName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Kon bot niet aanmaken:', err);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (!CHATBOTKIT_USER_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-500">VITE_CHATBOTKIT_USER_ID niet ingesteld</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">{COMPANY_NAME}</h1>
          <Link to="/conversations" className="text-blue-600 hover:text-blue-800 font-medium">
            📬 Alle Conversaties
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mijn Chatbots</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Nieuwe Chatbot
          </button>
        </div>

        {bots.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Je hebt nog geen chatbots.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Maak je eerste chatbot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{bot.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                  {bot.backstory || 'Geen backstory'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/bot/${bot.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    ✏️ Bewerken
                  </Link>
                  <Link to={`/bot/${bot.id}/dataset`} className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                    📁 Dataset {bot.datasetId ? '✓' : ''}
                  </Link>
                  <Link to={`/conversations/${bot.id}`} className="text-green-600 hover:text-green-800 text-sm font-medium">
                    💬 Conversaties
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Nieuwe Chatbot</h3>
            <input
              type="text"
              placeholder="Naam van je chatbot"
              value={newBotName}
              onChange={(e) => setNewBotName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600">
                Annuleren
              </button>
              <button
                onClick={handleCreateBot}
                disabled={creating || !newBotName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Aanmaken...' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
