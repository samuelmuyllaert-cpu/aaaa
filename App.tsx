import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BotEditor from './pages/BotEditor';
import BotDataset from './pages/BotDataset';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bot/:id" element={<BotEditor />} />
        <Route path="/bot/:id/dataset" element={<BotDataset />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/conversations/:botId" element={<Conversations />} />
        <Route path="/conversation/:id" element={<ConversationDetail />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
