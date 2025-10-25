import React from 'react';
import { useStore } from '../store/store';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

// Component này không cần file SCSS riêng
// vì chúng ta sẽ thêm style của nó vào App.scss

const DarkModeToggle = () => {
  // Lấy state và action từ store
  const { darkMode, toggleDarkMode } = useStore();

  return (
    <button 
      className="dark-mode-toggle" 
      onClick={toggleDarkMode}
      title={darkMode ? "Chuyển sang Chế độ Sáng" : "Chuyển sang Chế độ Tối"}
    >
      {/* Hiển thị icon mặt trời nếu đang ở dark mode và ngược lại */}
      {darkMode ? <SunOutlined /> : <MoonOutlined />}
    </button>
  );
};

export default DarkModeToggle;