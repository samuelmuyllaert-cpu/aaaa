import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getConversations, getBots } from '../lib/chatbotkit';
import { CHATBOTKIT_USER_ID } from '../lib/config';

interface Conversation {
  id: string;
  botId: string;
  createdAt: number;
  updatedAt: number;
}

export default function Conversations() {
  const { botId } = useParams<{ botId?: string }>();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [bots, setBots] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [botId]);

  async function loadData() {
    if (!CHATBOTKIT_USER_ID) return;
    try {
      const [convos, botList] = await Promise.all([
        getConversations(CHATBOTKIT_USER_ID, botId),
        getBots(CHATBOTKIT_USER_ID)
      ]);
      setConversations(convos);
      
      const botMap: Record<string, string> = {};
      botList.forEach((bot: any) => { botMap[bot.id] = bot.name; });
      setBots(botMap);
    } catch (err) {
      console.error('Kon data niet laden:', err);
    }
    setLoading(false);
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString('nl-BE');
  }

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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">← Terug</Link>
          <h1 className="text-xl font-bold text-gray-900">
            {botId ? `Conversaties - ${bots[botId] || 'Bot'}` : 'Alle Conversaties'}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {conversations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nog geen conversaties.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/conversation/${conv.id}`}
                className="block p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {bots[conv.botId] || 'Onbekende bot'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(conv.createdAt)}
                    </p>
                  </div>
                  <span className="text-gray-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
