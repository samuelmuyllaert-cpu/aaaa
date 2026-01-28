import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getConversationMessages } from '../lib/chatbotkit';
import { CHATBOTKIT_USER_ID } from '../lib/config';

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  createdAt: number;
}

export default function ConversationDetail() {
  const { id: conversationId } = useParams<{ id: string }>();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  async function loadMessages() {
    if (!CHATBOTKIT_USER_ID || !conversationId) return;
    try {
      const msgs = await getConversationMessages(CHATBOTKIT_USER_ID, conversationId);
      setMessages(msgs);
    } catch (err) {
      console.error('Kon berichten niet laden:', err);
    }
    setLoading(false);
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('nl-BE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
          <Link to="/conversations" className="text-gray-500 hover:text-gray-700">← Terug</Link>
          <h1 className="text-xl font-bold text-gray-900">Conversatie</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center">Geen berichten</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-xs mt-1 ${
                    msg.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
