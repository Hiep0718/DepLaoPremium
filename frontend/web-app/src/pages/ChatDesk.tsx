import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import ConversationInfoPanel from '../components/chat/ConversationInfoPanel';
import { useChatStore } from '../stores/chatStore';

const ChatDesk = () => {
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const activeConversation = useChatStore((state) => state.activeConversation);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <ChatHeader />
        <MessageList />
        <MessageInput />
      </div>

      {/* Right Info Panel — slides in */}
      {isInfoPanelOpen && activeConversation && (
        <ConversationInfoPanel />
      )}
    </div>
  );
};

export default ChatDesk;
