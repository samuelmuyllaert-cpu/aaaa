const CHATBOTKIT_API_KEY = import.meta.env.VITE_CHATBOTKIT_API_KEY;
const CHATBOTKIT_BASE_URL = '/api/chatbotkit/v1';

if (!CHATBOTKIT_API_KEY) {
  throw new Error('ChatBotKit API Key ontbreekt!');
}

function getHeaders(subAccountId?: string, isJson = true) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${CHATBOTKIT_API_KEY}`,
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (subAccountId) {
    headers['X-RunAs-UserId'] = subAccountId;
  }
  return headers;
}

// === BOTS ===
export async function getBots(subAccountId: string): Promise<any[]> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/bot/list`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon bots niet ophalen');
  const data = await response.json();
  return data.items || [];
}

export async function getBot(subAccountId: string, botId: string): Promise<any> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/bot/${botId}/fetch`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon bot niet ophalen');
  return response.json();
}

export async function updateBot(subAccountId: string, botId: string, data: any): Promise<void> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/bot/${botId}/update`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Kon bot niet updaten');
}

export async function updateBotBackstory(subAccountId: string, botId: string, backstory: string): Promise<void> {
  return updateBot(subAccountId, botId, { backstory });
}

export async function createBot(subAccountId: string, name: string, backstory: string): Promise<string> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/bot/create`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
    body: JSON.stringify({ name, backstory, model: 'gpt-4o-mini' }),
  });
  if (!response.ok) throw new Error('Kon bot niet aanmaken');
  const data = await response.json();
  return data.id;
}

// === CONVERSATIONS ===
export async function getConversations(subAccountId: string, botId?: string): Promise<any[]> {
  let url = `${CHATBOTKIT_BASE_URL}/conversation/list`;
  if (botId) url += `?botId=${botId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon conversaties niet ophalen');
  const data = await response.json();
  return data.items || [];
}

export async function getConversationMessages(subAccountId: string, conversationId: string): Promise<any[]> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/conversation/${conversationId}/message/list`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon berichten niet ophalen');
  const data = await response.json();
  return data.items || [];
}

// === DATASETS ===
export async function getDatasets(subAccountId: string): Promise<any[]> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/list`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon datasets niet ophalen');
  const data = await response.json();
  return data.items || [];
}

export async function getDataset(subAccountId: string, datasetId: string): Promise<any> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/fetch`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon dataset niet ophalen');
  return response.json();
}

export async function createDataset(subAccountId: string, name: string, description?: string): Promise<string> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/create`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
    body: JSON.stringify({ name, description: description || '', store: 'ada-loom' }),
  });
  if (!response.ok) throw new Error('Kon dataset niet aanmaken');
  const data = await response.json();
  return data.id;
}

// === DATASET FILES ===
export async function getDatasetFiles(subAccountId: string, datasetId: string): Promise<any[]> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/file/list`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon files niet ophalen');
  const data = await response.json();
  return data.items || [];
}

export async function uploadDatasetFile(
  subAccountId: string, 
  datasetId: string, 
  file: File
): Promise<string> {
  // Check file size (max 900KB voor JSON body)
  if (file.size > 900 * 1024) {
    throw new Error(`Bestand is te groot (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is 900KB.`);
  }

  const text = await file.text();
  
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/file/create`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
    body: JSON.stringify({
      name: file.name,
      type: getFileType(file.name),
      text: text,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload mislukt: ${err}`);
  }
  const data = await response.json();
  return data.id;
}

export async function deleteDatasetFile(subAccountId: string, datasetId: string, fileId: string): Promise<void> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/file/${fileId}/delete`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon file niet verwijderen');
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'csv': 'text/csv',
    'json': 'application/json',
  };
  return types[ext || ''] || 'text/plain';
}

// === DATASET RECORDS (alternatief voor grote bestanden) ===
export async function createDatasetRecord(
  subAccountId: string, 
  datasetId: string, 
  text: string,
  name?: string
): Promise<string> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/record/create`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
    body: JSON.stringify({ text, meta: name ? { name } : undefined }),
  });
  
  if (!response.ok) {
    throw new Error('Kon record niet aanmaken');
  }
  const data = await response.json();
  return data.id;
}

export async function getDatasetRecords(subAccountId: string, datasetId: string): Promise<any[]> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/record/list`, {
    method: 'GET',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon records niet ophalen');
  const data = await response.json();
  return data.items || [];
}

export async function deleteDatasetRecord(subAccountId: string, datasetId: string, recordId: string): Promise<void> {
  const response = await fetch(`${CHATBOTKIT_BASE_URL}/dataset/${datasetId}/record/${recordId}/delete`, {
    method: 'POST',
    headers: getHeaders(subAccountId),
  });
  if (!response.ok) throw new Error('Kon record niet verwijderen');
}
