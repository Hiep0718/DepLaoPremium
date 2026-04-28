import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { joinGroupByInviteCode, getConversationsList } from '../services/message.service';
import { Loader2, Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

const JoinGroup = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [message, setMessage] = useState('');
  const [groupData, setGroupData] = useState<any>(null);

  useEffect(() => {
    if (!user?.id || !inviteCode) return;

    const performJoin = async () => {
      try {
        const res = await joinGroupByInviteCode(inviteCode, String(user.id));
        if (res.data.approvalRequired) {
          setStatus('pending');
          setMessage('Yêu cầu tham gia của bạn đã được gửi. Vui lòng chờ Admin duyệt.');
        } else {
          setStatus('success');
          setMessage('Tham gia nhóm thành công!');
          setGroupData(res.data.data);

          // Reload conversations and set the joined group as active
          try {
            const convRes = await getConversationsList(String(user.id));
            const list = convRes.data?.data || convRes.data;
            if (Array.isArray(list)) {
              useChatStore.getState().setConversations(list);
              const joinedConv = list.find((c: any) => c.conversationId === res.data.data?.conversationId);
              if (joinedConv) {
                useChatStore.getState().setActiveConversation(joinedConv);
              }
            }
          } catch { /* ignore reload error */ }

          // Redirect after a short delay
          setTimeout(() => {
            navigate('/chat');
          }, 2000);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Không thể tham gia nhóm. Link có thể đã hết hạn hoặc không tồn tại.');
      }
    };

    performJoin();
  }, [inviteCode, user?.id, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Yêu cầu đăng nhập</h2>
          <p className="text-gray-600 mb-6">Bạn cần đăng nhập để tham gia nhóm qua link này.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-gray-800">Đang xử lý tham gia nhóm...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thành công!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl w-full mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                {groupData?.groupAvatar ? (
                  <img src={groupData.groupAvatar} className="w-full h-full rounded-full object-cover" alt="Group Avatar" />
                ) : (
                  <Users size={24} />
                )}
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-gray-800">{groupData?.groupName || 'Nhóm mới'}</p>
                <p className="text-xs text-gray-500">{groupData?.participants?.length} thành viên</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/chat')}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Vào trò chuyện
            </button>
          </div>
        )}

        {status === 'pending' && (
          <div className="flex flex-col items-center">
            <Clock className="w-16 h-16 text-orange-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chờ duyệt</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/chat')}
              className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Về trang chủ
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thất bại</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/chat')}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Quay lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinGroup;