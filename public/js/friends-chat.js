// File: public/js/friends-chat.js

document.addEventListener('DOMContentLoaded', () => {
    // === KHAI BÁO BIẾN ===
    let currentUserId = null;       // ID của người dùng hiện tại (lấy từ server)
    let currentReceiverId = null;   // ID của người đang chat cùng
    let currentReceiverUsername = null; // Username của người đang chat cùng
    const socket = io();          // Kết nối Socket.IO

    // Lấy các element trên trang
    const messagesContainer = document.getElementById('messages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatHeader = document.getElementById('chatWithHeader');
    const friendsListContainer = document.querySelector('.friends-list-scrollable');
    const messageSubmitButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

    // === HÀM TRỢ GIÚP ===

    // Hàm cuộn xuống cuối khu vực tin nhắn
    function scrollToBottom() {
        if (messagesContainer) {
            // Đặt scroll behavior thành 'smooth' nếu muốn cuộn mượt
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Hàm hiển thị tin nhắn
    function displayMessage(msg, isOwnMessage) {
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isOwnMessage ? 'own' : 'other');

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');
        bubbleDiv.textContent = msg.content; // Chỉ hiển thị nội dung

        // Thêm thời gian gửi (định dạng nếu cần)
        const timeSpan = document.createElement('span');
        timeSpan.classList.add('message-time');
        timeSpan.textContent = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        bubbleDiv.appendChild(timeSpan);

        messageDiv.appendChild(bubbleDiv);

        // Chèn tin nhắn mới vào ĐẦU container (vì flex-direction: column-reverse)
        messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);

        // Xóa trạng thái rỗng nếu có
        const emptyState = messagesContainer.querySelector('.empty-chat-state');
        if (emptyState) {
            emptyState.remove();
        }
    }

    // Hàm cập nhật trạng thái online/offline cho bạn bè
    function updateUserStatus(userId, isOnline) {
        if (!friendsListContainer) return;
        const statusIndicator = friendsListContainer.querySelector(`.status-indicator[data-user-id="${userId}"]`);
        if (statusIndicator) {
            statusIndicator.classList.toggle('online', isOnline); // Thêm/xóa class 'online'
            statusIndicator.classList.toggle('offline', !isOnline); // Thêm/xóa class 'offline'
            console.log(`Status updated for ${userId}: ${isOnline ? 'Online' : 'Offline'}`);
        } else {
             console.log(`Status indicator not found for user ${userId}`);
        }
    }

    // === XỬ LÝ SOCKET.IO ===
    if (socket) {
        // --- Kết nối thành công ---
        socket.on('connect', () => {
            console.log('🔗 Connected to Socket.IO server');
        });

        // --- Xác thực thành công, nhận userId ---
        socket.on('authenticated', (data) => {
            if (data && data.userId) {
                currentUserId = data.userId;
                console.log(`✅ Authenticated with User ID: ${currentUserId}`);
            }
        });

        // --- Nhận lịch sử chat ---
        socket.on('chatHistory', (data) => {
            console.log(`📜 Received chat history with ${data.receiverId}`);
            if (messagesContainer && data.receiverId === currentReceiverId) { // Chỉ hiển thị nếu đúng người đang chọn
                // Xóa tin nhắn cũ và trạng thái rỗng
                messagesContainer.innerHTML = '';

                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        // Kiểm tra ID dạng string
                        const isOwn = msg.senderId.toString() === currentUserId.toString();
                        displayMessage(msg, isOwn);
                    });
                    scrollToBottom(); // Cuộn xuống cuối sau khi tải xong
                } else {
                    // Hiển thị lại trạng thái rỗng nếu không có tin nhắn
                    messagesContainer.innerHTML = `
                        <div class="empty-chat-state">
                          <i class="fas fa-comments fa-4x"></i>
                          <p>Chưa có tin nhắn nào. Bắt đầu trò chuyện!</p>
                        </div>`;
                }
            }
        });

        // --- Nhận tin nhắn mới ---
        socket.on('receiveMessage', (msg) => {
            console.log('📩 Received message:', msg);
            // Chỉ hiển thị nếu đang chat với người gửi
            if (msg && msg.senderId === currentReceiverId) {
                displayMessage(msg, false); // Tin nhắn từ người khác
                scrollToBottom();
            } else if (msg) {
                // (Tùy chọn: Hiển thị thông báo có tin nhắn mới từ người khác)
                console.log(`Tin nhắn mới từ ${msg.senderId}, nhưng không phải người đang chat.`);
                 // Có thể thêm hiệu ứng nhấp nháy hoặc badge cho người gửi trong danh sách bạn bè
                 const friendItem = friendsListContainer.querySelector(`.friend-item[data-user-id="${msg.senderId}"]`);
                 if (friendItem && !friendItem.classList.contains('active')) {
                     // Ví dụ: thêm class để nhấp nháy
                     friendItem.classList.add('new-message-indicator');
                     setTimeout(() => friendItem.classList.remove('new-message-indicator'), 2000); // Bỏ nháy sau 2s
                 }
            }
        });

        // --- Xác nhận tin nhắn đã gửi ---
        // (Hữu ích nếu bạn muốn cập nhật trạng thái 'đã gửi'/'đã xem')
        socket.on('messageSent', (msg) => {
            console.log('✅ Message sent confirmation:', msg);
            // Hiện tại chỉ log, bạn có thể thêm logic cập nhật UI nếu cần
        });

        // --- Nhận lỗi từ server ---
        socket.on('chatError', (errorMessage) => {
            console.error('❌ Chat Error:', errorMessage);
            // Hiển thị lỗi cho người dùng (ví dụ: dùng toast)
            if (typeof showToast === 'function') { // Kiểm tra hàm showToast tồn tại
                 showToast(errorMessage, 'Lỗi Chat', 'error');
            } else {
                 alert(`Lỗi Chat: ${errorMessage}`);
            }
        });

        // --- Nhận trạng thái typing ---
        socket.on('typing', (data) => {
            if (data && data.userId === currentReceiverId) {
                // (Tùy chọn: Hiển thị/ẩn indicator "...")
                console.log(`${currentReceiverUsername} is ${data.isTyping ? 'typing...' : 'stopped typing'}`);
                const typingIndicator = document.getElementById('typingIndicator'); // Cần tạo element này trong HTML
                if (typingIndicator) {
                    typingIndicator.style.display = data.isTyping ? 'block' : 'none';
                }
            }
        });

        // --- Nhận trạng thái bạn bè ban đầu ---
        socket.on('friends status', (data) => {
            console.log('Received initial friends status:', data);
            if (data?.onlineFriendIds && Array.isArray(data.onlineFriendIds) && friendsListContainer) {
                // 1. Reset tất cả về offline
                friendsListContainer.querySelectorAll('.status-indicator').forEach(el => {
                    el.classList.remove('online');
                    el.classList.add('offline');
                });
                // 2. Cập nhật online cho những người trong danh sách
                data.onlineFriendIds.forEach(userId => {
                    updateUserStatus(userId, true);
                });
            }
        });

        // --- Nhận thông báo bạn bè online ---
        socket.on('user online', (data) => {
            console.log('User came online:', data);
            if (data?.userId) {
                updateUserStatus(data.userId, true);
            }
        });

        // --- Nhận thông báo bạn bè offline ---
        socket.on('user offline', (data) => {
            console.log('User went offline:', data);
            if (data?.userId) {
                updateUserStatus(data.userId, false);
            }
        });

        // --- Mất kết nối ---
        socket.on('disconnect', (reason) => {
            console.warn(`🔌 Disconnected from Socket.IO server. Reason: ${reason}`);
            // (Tùy chọn: Hiển thị thông báo mất kết nối, thử kết nối lại)
            if (chatHeader) chatHeader.textContent = "Mất kết nối...";
             if (messageInput) messageInput.disabled = true;
             if (messageSubmitButton) messageSubmitButton.disabled = true;
             // Reset trạng thái online của mọi người về offline trên UI
             if (friendsListContainer) {
                 friendsListContainer.querySelectorAll('.status-indicator.online').forEach(el => {
                    el.classList.remove('online');
                    el.classList.add('offline');
                 });
             }
        });

    } else {
        console.error("Socket.IO client not initialized!");
         if (chatHeader) chatHeader.textContent = "Không thể kết nối chat";
    }

    // === XỬ LÝ GỬI TIN NHẮN ===
    if (chatForm && messageInput && messageSubmitButton) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const content = messageInput.value.trim();

            if (content && currentReceiverId && socket && socket.connected) {
                console.log(`✉️ Sending message to ${currentReceiverId}: ${content}`);
                // Gửi tin nhắn lên server
                socket.emit('sendMessage', {
                    receiverId: currentReceiverId,
                    content: content
                });

                // Hiển thị tin nhắn của mình ngay lập tức (Optimistic UI)
                const tempMessage = {
                    content: content,
                    createdAt: new Date(), // Thời gian tạm thời
                    senderId: currentUserId // Đảm bảo đúng ID
                };
                displayMessage(tempMessage, true);
                scrollToBottom();

                messageInput.value = ''; // Xóa input
                messageInput.focus();
                // (Tùy chọn: Gửi sự kiện typingStop sau khi gửi)
                 socket.emit('typingStop', { receiverId: currentReceiverId });
            } else if (!socket || !socket.connected) {
                 console.error("Không thể gửi tin nhắn: Mất kết nối.");
                 if (typeof showToast === 'function') {
                    showToast("Mất kết nối, không thể gửi tin nhắn.", 'Lỗi', 'error');
                 }
            }
        });

        // === XỬ LÝ TYPING INDICATOR (GỬI LÊN SERVER) ===
         let typingTimer;
         const typingTimeout = 1500; // ms

         messageInput.addEventListener('input', () => {
             if (currentReceiverId && socket && socket.connected) {
                 // Gửi 'typingStart' ngay lập tức
                 socket.emit('typingStart', { receiverId: currentReceiverId });

                 // Đặt lại bộ đếm thời gian
                 clearTimeout(typingTimer);
                 typingTimer = setTimeout(() => {
                     // Gửi 'typingStop' sau khi ngừng gõ
                     socket.emit('typingStop', { receiverId: currentReceiverId });
                 }, typingTimeout);
             }
         });
    }

    // === HÀM GLOBAL ĐỂ CHỌN BẠN BÈ ===
    // (Đặt ở global scope để onclick trong Pug có thể gọi)
    window.selectFriend = (userId, username) => {
        console.log(`Selected friend: ${username} (${userId})`);

        // Bỏ active của người cũ (nếu có)
        const currentActive = friendsListContainer ? friendsListContainer.querySelector('.friend-item.active') : null;
        if (currentActive) {
            currentActive.classList.remove('active');
        }

        // Đặt active cho người mới chọn
        const newActive = friendsListContainer ? friendsListContainer.querySelector(`.friend-item[data-user-id="${userId}"]`) : null;
        if (newActive) {
            newActive.classList.add('active');
            // Bỏ hiệu ứng tin nhắn mới nếu có
             newActive.classList.remove('new-message-indicator');
        }

        // Cập nhật thông tin người đang chat
        currentReceiverId = userId;
        currentReceiverUsername = username;

        // Cập nhật header chat
        if (chatHeader) {
            chatHeader.textContent = `Trò chuyện với ${username}`;
        }

        // Kích hoạt input và nút gửi
         if (messageInput) messageInput.disabled = false;
         if (messageSubmitButton) messageSubmitButton.disabled = false;


        // Yêu cầu lịch sử chat từ server
        if (socket && socket.connected) {
            messagesContainer.innerHTML = '<div>Đang tải lịch sử chat...</div>'; // Hiển thị loading tạm thời
            socket.emit('getChatHistory', { receiverId: userId });
        } else {
             messagesContainer.innerHTML = '<div class="empty-chat-state"><p>Mất kết nối...</p></div>';
        }
    };

}); // Kết thúc DOMContentLoaded


// (Tùy chọn) CSS cho hiệu ứng tin nhắn mới
const style = document.createElement('style');
style.textContent = `
    .friend-item.new-message-indicator {
        animation: blinkBackground 0.5s 3; /* Nháy 3 lần */
    }
    @keyframes blinkBackground {
        50% { background-color: rgba(13, 110, 253, 0.1); }
    }
`;
document.head.appendChild(style);