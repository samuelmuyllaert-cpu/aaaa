import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  getBot, 
  updateBot,
  getDatasets, 
  createDataset, 
  getDatasetFiles, 
  uploadDatasetFile, 
  deleteDatasetFile,
  getDatasetRecords,
  createDatasetRecord,
  deleteDatasetRecord
} from '../lib/chatbotkit';
import { CHATBOTKIT_USER_ID } from '../lib/config';

export default function BotDataset() {
  const { id: botId } = useParams<{ id: string }>();
  
  const [bot, setBot] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAddText, setShowAddText] = useState(false);
  const [newText, setNewText] = useState('');
  const [newTextName, setNewTextName] = useState('');
  const [addingText, setAddingText] = useState(false);

  useEffect(() => {
    loadData();
  }, [botId]);

  async function loadData() {
    if (!CHATBOTKIT_USER_ID) return;
    try {
      const botData = await getBot(CHATBOTKIT_USER_ID, botId!);
      setBot(botData);
      
      const allDatasets = await getDatasets(CHATBOTKIT_USER_ID);
      setDatasets(allDatasets);
      
      if (botData.datasetId) {
        const [datasetFiles, datasetRecords] = await Promise.all([
          getDatasetFiles(CHATBOTKIT_USER_ID, botData.datasetId),
          getDatasetRecords(CHATBOTKIT_USER_ID, botData.datasetId)
        ]);
        setFiles(datasetFiles);
        setRecords(datasetRecords);
      }
    } catch (err) {
      console.error('Kon data niet laden:', err);
    }
    setLoading(false);
  }

  async function handleCreateDataset() {
    if (!CHATBOTKIT_USER_ID) return;
    setCreating(true);
    try {
      const datasetId = await createDataset(
        CHATBOTKIT_USER_ID, 
        `Dataset voor ${bot.name}`,
        `Kennisbank voor chatbot ${bot.name}`
      );
      await updateBot(CHATBOTKIT_USER_ID, botId!, { datasetId });
      await loadData();
    } catch (err) {
      console.error('Kon dataset niet aanmaken:', err);
      alert('Fout bij aanmaken dataset');
    }
    setCreating(false);
  }

  async function handleSelectDataset(datasetId: string) {
    if (!CHATBOTKIT_USER_ID) return;
    try {
      await updateBot(CHATBOTKIT_USER_ID, botId!, { datasetId: datasetId || null });
      await loadData();
    } catch (err) {
      console.error('Kon dataset niet koppelen:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bot.datasetId || !CHATBOTKIT_USER_ID) return;
    
    setUploading(true);
    try {
      await uploadDatasetFile(CHATBOTKIT_USER_ID, bot.datasetId, file);
      await loadData();
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.message || 'Fout bij uploaden');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm('Weet je zeker dat je dit bestand wilt verwijderen?') || !CHATBOTKIT_USER_ID) return;
    try {
      await deleteDatasetFile(CHATBOTKIT_USER_ID, bot.datasetId, fileId);
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      alert('Fout bij verwijderen');
    }
  }

  async function handleAddText() {
    if (!newText.trim() || !bot.datasetId || !CHATBOTKIT_USER_ID) return;
    setAddingText(true);
    try {
      await createDatasetRecord(CHATBOTKIT_USER_ID, bot.datasetId, newText, newTextName || undefined);
      setNewText('');
      setNewTextName('');
      setShowAddText(false);
      await loadData();
    } catch (err) {
      alert('Fout bij toevoegen tekst');
    }
    setAddingText(false);
  }

  async function handleDeleteRecord(recordId: string) {
    if (!confirm('Weet je zeker dat je dit record wilt verwijderen?') || !CHATBOTKIT_USER_ID) return;
    try {
      await deleteDatasetRecord(CHATBOTKIT_USER_ID, bot.datasetId, recordId);
      setRecords(records.filter(r => r.id !== recordId));
    } catch (err) {
      alert('Fout bij verwijderen');
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('nl-BE');
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
          <h1 className="text-xl font-bold text-gray-900">{bot?.name} - Dataset</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Dataset Koppeling</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Gekoppelde Dataset</label>
              <select
                value={bot?.datasetId || ''}
                onChange={(e) => handleSelectDataset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">-- Geen dataset --</option>
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateDataset}
              disabled={creating}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? 'Aanmaken...' : '+ Nieuwe Dataset'}
            </button>
          </div>
        </div>

        {bot?.datasetId && (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Bestanden</h2>
                <label className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                  {uploading ? 'Uploaden...' : '📁 Bestand (max 900KB)'}
                  <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                </label>
              </div>
              <p className="text-sm text-gray-500 mb-4">TXT, MD, CSV, JSON (max 900KB)</p>
              {files.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">Nog geen bestanden</div>
              ) : (
                <div className="border rounded-md divide-y">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatDate(file.createdAt)}</p>
                      </div>
                      <button onClick={() => handleDeleteFile(file.id)} className="text-red-600 hover:text-red-800 text-sm">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Tekst Records</h2>
                <button onClick={() => setShowAddText(true)} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                  ✏️ Tekst Toevoegen
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">FAQ's, productinfo of andere kennis</p>
              {records.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">Nog geen tekst records</div>
              ) : (
                <div className="border rounded-md divide-y">
                  {records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 truncate">{record.text?.substring(0, 100)}...</p>
                        <p className="text-xs text-gray-500">{formatDate(record.createdAt)}</p>
                      </div>
                      <button onClick={() => handleDeleteRecord(record.id)} className="text-red-600 hover:text-red-800 text-sm ml-2">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!bot?.datasetId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">⚠️ Koppel eerst een dataset aan deze bot.</p>
          </div>
        )}
      </main>

      {showAddText && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Tekst Toevoegen</h3>
            <input type="text" placeholder="Naam (optioneel)" value={newTextName} onChange={(e) => setNewTextName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3" />
            <textarea placeholder="Voer hier je tekst in..." value={newText} onChange={(e) => setNewText(e.target.value)} className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md mb-4 font-mono text-sm" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddText(false)} className="px-4 py-2 text-gray-600">Annuleren</button>
              <button onClick={handleAddText} disabled={addingText || !newText.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
                {addingText ? 'Toevoegen...' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
