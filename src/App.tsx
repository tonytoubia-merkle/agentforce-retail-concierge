import { SceneProvider } from '@/contexts/SceneContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { CustomerProvider } from '@/contexts/CustomerContext';
import { ActivityToastProvider } from '@/components/ActivityToast';
import { AdvisorPage } from '@/components/AdvisorPage';

function App() {
  return (
    <CustomerProvider>
      <SceneProvider>
        <ActivityToastProvider>
          <ConversationProvider>
            <AdvisorPage />
          </ConversationProvider>
        </ActivityToastProvider>
      </SceneProvider>
    </CustomerProvider>
  );
}

export default App;
