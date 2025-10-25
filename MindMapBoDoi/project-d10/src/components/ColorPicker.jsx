import React, { useState, useRef } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { darkenColor } from '../utils/colorUtils';

// Danh sách màu gốc (chuyển từ các file khác về đây)
const PREDEFINED_COLORS = [
  '#ffffff', '#e9ecef', '#ced4da', '#adb5bd',
  '#f03e3e', '#d6336c', '#ae3ec9', '#7048e8',
  '#4263eb', '#1c7ed6', '#1098ad', '#0ca678',
  '#fab005', '#f59f00', '#f76707',
];

/**
 * Component chọn màu có thể tái sử dụng
 * @param {object} props
 * @param {(color: string) => void} props.onColorSelect - Callback khi một màu được chọn
 * @param {string} [props.paletteClass] - Class CSS tùy chọn (ví dụ: 'mini')
 * @param {object} [props.style] - Style inline tùy chọn
 */
const ColorPicker = ({ onColorSelect, paletteClass = '', style }) => {
  const [customColors, setCustomColors] = useState([]);
  const colorInputRef = useRef(null);

  const handleAddColorClick = () => {
    colorInputRef.current?.click();
  };

  const handleColorInputChange = (event) => {
    const newColor = event.target.value;
    if (newColor && !customColors.includes(newColor) && !PREDEFINED_COLORS.includes(newColor)) {
      setCustomColors(prev => [...prev, newColor]);
    }
    // Gửi màu mới được chọn (dù là custom hay từ input)
    onColorSelect(newColor);
  };

  const allColors = [...PREDEFINED_COLORS, ...customColors];

  return (
    <>
      <div 
        className={`color-palette ${paletteClass}`}
        style={style}
      >
        {allColors.map(color => (
          <button
            key={color}
            className="color-button"
            style={{
              backgroundColor: color,
              borderColor: darkenColor(color, 20) // Border tối hơn
            }}
            title={color}
            onClick={() => onColorSelect(color)}
          />
        ))}
        {/* Nút thêm màu mới */}
        <button
          className="color-button add-color-button"
          title="Thêm màu mới"
          onClick={handleAddColorClick}
        >
          <PlusOutlined />
        </button>
      </div>

      {/* Input ẩn để chọn màu */}
      <input
        type="color"
        ref={colorInputRef}
        onChange={handleColorInputChange}
        style={{ 
          visibility: 'hidden', 
          width: 0, 
          height: 0, 
          position: 'absolute', 
          top: '-100px', 
          left: '-100px' 
        }}
      />
    </>
  );
};

export default ColorPicker;