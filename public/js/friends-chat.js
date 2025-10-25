// File: public/js/friends-chat.js
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo kết nối socket
    const socket = io();

    // Lấy các element DOM - SỬA SELECTOR CHO ĐÚNG VỚI TRANG BẠN BÈ
    const userList = document.getElementById('userList');
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatWithHeader = document.getElementById('chatWithHeader');
    const sendButton = chatForm.querySelector('button');

    let currentReceiver = null; // { id, username }

    // 1. Kết nối thành công
    socket.on('connect', () => {
        console.log('Đã kết nối tới server Socket.IO. ID:', socket.id);
    });

    // 2. Xử lý khi chọn người dùng - SỬA CHO PHÙ HỢP VỚI HTML BẠN BÈ
    if (userList) {
        userList.addEventListener('click', (e) => {
            const userItem = e.target.closest('.chat-user-item');
            if (!userItem) return;

            // Bỏ active cũ
            document.querySelectorAll('.chat-user-item.active').forEach(el => el.classList.remove('active'));
            // Active mới
            userItem.classList.add('active');

            // Lưu lại người đang chat
            currentReceiver = {
                id: userItem.dataset.userId,
                username: userItem.dataset.username
            };

            // Cập nhật giao diện
            chatWithHeader.textContent = `Đang chat với: ${currentReceiver.username}`;
            messages.innerHTML = ''; // Xóa tin nhắn cũ
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();

            // Gửi yêu cầu lấy lịch sử tin nhắn
            socket.emit('getChatHistory', { receiverId: currentReceiver.id });
        });
    }

    // 3. Xử lý khi gửi tin nhắn
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();

        if (content && currentReceiver) {
            // Gửi tin nhắn lên server
            socket.emit('sendMessage', {
                receiverId: currentReceiver.id,
                content: content
            });

            // Hiển thị ngay tin nhắn của chính mình
            addMessageToUI(content, 'own', new Date());

            messageInput.value = '';
        }
    });

    // 4. Lắng nghe khi nhận được tin nhắn
    socket.on('receiveMessage', (data) => {
        // Chỉ hiển thị nếu đang chat đúng người gửi
        if (currentReceiver && data.senderId === currentReceiver.id) {
            addMessageToUI(data.content, 'other', new Date(data.createdAt));
        } else {
            // Nếu không, thông báo có tin nhắn mới
            console.log(`Có tin nhắn mới từ ${data.senderId}`);
            const userItem = userList.querySelector(`.chat-user-item[data-user-id="${data.senderId}"]`);
            if (userItem && !userItem.classList.contains('active')) {
                // Thêm chấm thông báo
                if (!userItem.querySelector('.notification-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge badge bg-danger rounded-pill ms-2';
                    badge.textContent = '!';
                    userItem.appendChild(badge);
                }
            }
        }
    });

    // 5. Lắng nghe khi tin nhắn của mình được gửi (xác nhận)
    socket.on('messageSent', (sentMessage) => {
        console.log('Tin nhắn đã được gửi và lưu:', sentMessage);
    });

    // 6. Lắng nghe lỗi chat
    socket.on('chatError', (errorMessage) => {
        console.error('Lỗi chat:', errorMessage);
        showToast(errorMessage, 'Lỗi', 'error');
    });

    // 7. Lắng nghe khi nhận được lịch sử chat
    socket.on('chatHistory', (data) => {
        if (currentReceiver && data.receiverId === currentReceiver.id) {
            messages.innerHTML = ''; // Xóa tin nhắn cũ
            
            // Hiển thị tất cả tin nhắn trong lịch sử
            data.messages.forEach(message => {
                const messageType = message.senderId === data.currentUserId ? 'own' : 'other';
                addMessageToUI(message.content, messageType, new Date(message.createdAt));
            });
        }
    });

    // --- HÀM HELPER ---
    function addMessageToUI(content, type, timestamp) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;

        // Tạo nội dung tin nhắn với thời gian
        const timeString = timestamp.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        msgDiv.innerHTML = `
            <div class="message-content">${escapeHtml(content)}</div>
            <div class="message-time">${timeString}</div>
        `;

        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight; // Tự động cuộn xuống dưới
    }

    // Hàm escape HTML để chống XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Hàm hiển thị toast thông báo
    function showToast(message, title = 'Thông báo', type = 'info') {
        // Sử dụng toast từ Bootstrap hoặc tạo custom
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            // Tạo toast động nếu cần
            const toast = new bootstrap.Toast(document.createElement('div'));
            // ... toast logic
        } else {
            console.log(`${title}: ${message}`);
        }
    }
});

// Hàm global để có thể gọi từ HTML
function selectFriend(friendId, username) {
    const userItem = document.querySelector(`.chat-user-item[data-user-id="${friendId}"]`);
    if (userItem) {
        userItem.click();
    }
}

function startChat(friendId) {
    const friendItem = document.querySelector(`.friend-item input[value="${friendId}"]`)?.closest('.friend-item');
    if (friendItem) {
        const username = friendItem.querySelector('.friend-details strong').textContent;
        selectFriend(friendId, username);
        
        // Scroll to chat section
        document.querySelector('.chat-layout').scrollIntoView({ behavior: 'smooth' });
    }
}