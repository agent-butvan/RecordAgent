import React, { useState } from 'react';
import { ModelProviderContext } from './context/ModelContext';
import { Sidebar } from './components/layout/Sidebar';
import { ChatWorkspace } from './components/chat/ChatWorkspace';
import { ModelConfigModal } from './components/model/ModelConfigModal';

export const App: React.FC = () => {
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <ModelProviderContext>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Sidebar
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewChat={() => setActiveSessionId(String(Date.now()))}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <ChatWorkspace onOpenSettings={() => setIsSettingsOpen(true)} />
        <ModelConfigModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </ModelProviderContext>
  );
};

export default App;
