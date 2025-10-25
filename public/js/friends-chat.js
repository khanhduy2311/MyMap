// Biến toàn cục để theo dõi trạng thái
let currentUserId = null;
let currentReceiverId = null; // Lưu ID của người đang chat
let currentReceiverUsername = null; // Lưu username của người đang chat
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  // === 1. KHỞI TẠO KẾT NỐI SOCKET ===
  if (!socket) {
    socket = io({ autoConnect: true });
    console.log('Đang khởi tạo kết nối Socket.IO...');
  } else {
    console.log('Socket.IO đã được khởi tạo.');
  }

  // Lấy các element quan trọng
  const messagesContainer = document.getElementById('messages');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const chatHeader = document.getElementById('chatWithHeader');
  const friendsListContainer = document.querySelector('.friends-list-scrollable');
  const sendButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

  // === 2. CÁC HÀM TRỢ GIÚP ===

  // Hàm để render tin nhắn
  function renderMessage(message, isOwn) {
    const emptyState = messagesContainer.querySelector('.empty-chat-state');
    if (emptyState) {
      emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isOwn ? 'own' : 'other');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    // Chỉ thêm nội dung text vào bubble trước
    bubble.appendChild(document.createTextNode(message.content || '')); // Xử lý null content

    // === THÊM THỜI GIAN VÀO BÊN TRONG BUBBLE ===
    const timeDiv = document.createElement('div');
    timeDiv.classList.add('message-time');
    // Thêm class riêng để căn chỉnh
    timeDiv.classList.add(isOwn ? 'time-own' : 'time-other');
    timeDiv.textContent = message.createdAt ? new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

    // Thêm timeDiv vào cuối bubble
    bubble.appendChild(timeDiv);
    // ===========================================

    // Thêm bubble (đã chứa cả text và time) vào messageDiv
    messageDiv.appendChild(bubble);

    messagesContainer.prepend(messageDiv);
  }

  // --- Các hàm activateChatWindow, deactivateChatWindow giữ nguyên ---
  function activateChatWindow(username) {
    if (chatHeader) chatHeader.textContent = `Trò chuyện với ${username}`;
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    if (messagesContainer) messagesContainer.innerHTML = ''; // Xóa tin nhắn cũ
    if (messageInput) messageInput.focus();
  }

  function deactivateChatWindow() {
    if (chatHeader) chatHeader.textContent = 'Chọn bạn bè để trò chuyện';
    if (messageInput) messageInput.disabled = true;
    if (sendButton) sendButton.disabled = true;
    currentReceiverId = null;
    currentReceiverUsername = null;
    if (messagesContainer) {
        messagesContainer.innerHTML = `
          <div class="empty-chat-state">
            <i class="fas fa-comments fa-4x"></i>
            <p>Chọn một người bạn để bắt đầu trò chuyện</p>
          </div>`;
    }
    if (friendsListContainer) {
        friendsListContainer.querySelectorAll('.friend-item.active').forEach(el => el.classList.remove('active'));
    }
  }


  // === 3. LẮNG NGHE SỰ KIỆN TỪ SERVER ===
  if (socket) {
      socket.on('connect', () => {
        console.log('Socket.IO đã kết nối. ID:', socket.id);
      });

      socket.on('authenticated', (data) => {
        console.log('Socket đã xác thực:', data.userId);
        currentUserId = data.userId;
      });

      socket.on('chatHistory', (data) => {
        console.log("Nhận lịch sử chat:", data);
        if (!data || data.receiverId !== currentReceiverId) {
          console.log(`Lịch sử chat cho ${data?.receiverId}, nhưng đang xem ${currentReceiverId}. Bỏ qua.`);
          return;
        }

        if (messagesContainer) messagesContainer.innerHTML = '';

        if (!data.messages || data.messages.length === 0) {
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                  <div class="empty-chat-state">
                    <i class="fas fa-history fa-4x"></i>
                    <p>Chưa có tin nhắn nào. Hãy bắt đầu!</p>
                  </div>`;
            }
          return;
        }

        data.messages.forEach(msg => {
          renderMessage(msg, msg.senderId === data.currentUserId);
        });
      });

      socket.on('receiveMessage', (message) => {
        console.log("Nhận tin nhắn mới:", message);
        if (!message) return;

        if (message.senderId === currentReceiverId) {
          renderMessage(message, false);
        } else {
          if (friendsListContainer) {
              const friendItem = friendsListContainer.querySelector(`.friend-item[data-user-id="${message.senderId}"]`);
              if (friendItem) {
                friendItem.classList.add('has-unread');
                console.log(`Tin nhắn mới từ ${friendItem.dataset.username}`);
                // (Nâng cao) Cập nhật trạng thái chưa đọc ở đây
              }
          }
        }
      });

      socket.on('messageSent', (message) => {
        console.log("Tin nhắn của bạn đã được gửi:", message);
        if (!message) return;
        renderMessage(message, true);
      });

      socket.on('chatError', (errorMessage) => {
        console.error('Lỗi từ server:', errorMessage);
        if (typeof showToast === 'function') {
          showToast(errorMessage, 'Lỗi Chat', 'error');
        }
      });

      socket.on('disconnect', (reason) => {
        console.warn('Socket.IO đã ngắt kết nối:', reason);
        deactivateChatWindow();
        if (typeof showToast === 'function') {
          showToast('Mất kết nối với máy chủ chat.', 'Cảnh báo', 'warning');
        }
      });
  }

  // === 4. GỬI SỰ KIỆN LÊN SERVER ===
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = messageInput ? messageInput.value.trim() : '';

      if (content && currentReceiverId && socket && socket.connected) {
        console.log(`Đang gửi tin nhắn tới ${currentReceiverId}: ${content}`);
        socket.emit('sendMessage', {
          receiverId: currentReceiverId,
          content: content,
        });
        if (messageInput) messageInput.value = '';
      } else if (socket && !socket.connected) {
        if (typeof showToast === 'function') {
          showToast('Không thể gửi tin nhắn. Đang mất kết nối.', 'Lỗi', 'error');
        }
      }
    });
  }

  // --- Logic typing indicator giữ nguyên ---
    let typingTimer;
    const TYPING_TIMER_LENGTH = 500; // ms
    if (messageInput) {
        messageInput.addEventListener('input', () => {
          if (currentReceiverId && socket && socket.connected) {
            socket.emit('typingStart', { receiverId: currentReceiverId });
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
              if (socket && socket.connected) {
                  socket.emit('typingStop', { receiverId: currentReceiverId });
              }
            }, TYPING_TIMER_LENGTH);
          }
        });
        messageInput.addEventListener('blur', () => {
            clearTimeout(typingTimer);
            if (currentReceiverId && socket && socket.connected) {
                socket.emit('typingStop', { receiverId: currentReceiverId });
            }
        });
    }

}); // Hết DOMContentLoaded

// === 5. HÀM GLOBAL (ĐỂ PUG CÓ THỂ GỌI) ===
function selectFriend(friendId, friendUsername) {
  console.log(`Chọn bạn: ${friendUsername} (${friendId})`);
  if (!socket) {
    console.error('Socket chưa được khởi tạo!');
    if (typeof showToast === 'function') {
      showToast('Lỗi kết nối chat.', 'Lỗi', 'error');
    }
    return;
  }

  if (friendId === currentReceiverId) {
    console.log('Đã chọn người này rồi.');
    return;
  }

  currentReceiverId = friendId;
  currentReceiverUsername = friendUsername;

  // Cập nhật UI
  const friendsListContainer = document.querySelector('.friends-list-scrollable');
  const chatHeader = document.getElementById('chatWithHeader');
  const messageInput = document.getElementById('messageInput');
  const chatForm = document.getElementById('chatForm');
  const sendButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

  if (friendsListContainer) {
    const oldActive = friendsListContainer.querySelector('.friend-item.active');
    if (oldActive) {
      oldActive.classList.remove('active');
    }
    const newActive = friendsListContainer.querySelector(`.friend-item[data-user-id="${friendId}"]`);
    if (newActive) {
      newActive.classList.add('active');
      newActive.classList.remove('has-unread');
    }
  }

  // Kích hoạt cửa sổ chat
  if (chatHeader) chatHeader.textContent = `Trò chuyện với ${friendUsername}`;
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  if (messageInput) messageInput.focus();

  // Yêu cầu lịch sử chat
  console.log(`Yêu cầu lịch sử chat với ${friendId}`);
  if (socket.connected) {
    socket.emit('getChatHistory', { receiverId: friendId });
  } else {
    console.warn('Không thể yêu cầu lịch sử chat vì socket không kết nối.');
    if (typeof showToast === 'function') {
      showToast('Mất kết nối, không thể tải tin nhắn.', 'Lỗi', 'error');
    }
  }
}