// welcome-animation.js
class WelcomeAnimation {
    constructor() {
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.usernameElement = document.getElementById('usernameDisplay');
        this.welcomeSubtitle = document.querySelector('.welcome-subtitle');
        this.loadingBar = document.querySelector('.loading-bar');
        this.userData = this.getUserData();
        
        this.init();
    }

    getUserData() {
        try {
            const userDataElement = document.getElementById('userData');
            if (userDataElement) {
                return JSON.parse(userDataElement.textContent);
            }
            
            return {
                username: 'Người dùng',
                displayName: 'Người dùng',
                isFirstLogin: false
            };
        } catch (error) {
            console.log('Không thể lấy thông tin user, sử dụng tên mặc định');
            return {
                username: 'Người dùng',
                displayName: 'Người dùng',
                isFirstLogin: false
            };
        }
    }

    init() {
        if (!this.welcomeScreen) {
            console.log('Không tìm thấy màn hình chào mừng');
            return;
        }

        console.log('Khởi tạo màn hình chào mừng...');

        // Hiển thị tên người dùng
        if (this.usernameElement && this.userData) {
            const displayName = this.userData.displayName || this.userData.username;
            this.usernameElement.textContent = displayName;
            
            // THAY ĐỔI: Kiểm tra nếu là lần đầu đăng nhập
            if (this.userData.isFirstLogin) {
                this.welcomeSubtitle.textContent = 'Chào mừng đến với';
            } else {
                this.welcomeSubtitle.textContent = 'Chào mừng trở lại';
            }
        }

        // Tự động chuyển sang dashboard sau khi animation kết thúc
        setTimeout(() => {
            this.transitionToDashboard();
        }, 4500);
    }

    transitionToDashboard() {
        console.log('Bắt đầu chuyển cảnh sang dashboard...');
        
        // Thêm class fade-out để kích hoạt hiệu ứng bừng sáng
        this.welcomeScreen.classList.add('fade-out');
        
        // Chờ hiệu ứng hoàn thành rồi ẩn màn hình chào
        setTimeout(() => {
            this.welcomeScreen.style.display = 'none';
            
            // Hiển thị dashboard (nếu đang bị ẩn)
            const dashboard = document.querySelector('.dashboard-layout');
            if (dashboard) {
                dashboard.style.opacity = '0';
                dashboard.style.display = 'block';
                
                // Fade in dashboard
                setTimeout(() => {
                    dashboard.style.transition = 'opacity 0.5s ease';
                    dashboard.style.opacity = '1';
                }, 100);
            }
            
            console.log('Chuyển cảnh hoàn tất');
        }, 1500);
    }
}

// Khởi tạo khi DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM đã loaded, khởi chạy welcome animation...');
    new WelcomeAnimation();
});