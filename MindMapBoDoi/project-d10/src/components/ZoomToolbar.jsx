import React, { useEffect, useRef } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  GatewayOutlined, 
  AimOutlined,
  DashOutlined,      
  AppstoreOutlined,
  BorderOutlined,
  BgColorsOutlined,  
  FormatPainterOutlined, // ✨ 1. Import icon mới
} from '@ant-design/icons';
import {useStore} from '../store/store';

const ZoomToolbar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  
  const { 
    toggleMiniMap, 
    isMiniMapVisible, 
    needsFitView, 
    setNeedsFitView,
    backgroundVariant,    
    setBackgroundVariant, 
    setPatternColor, // ✨ 2. Lấy action cho màu hoa văn
  } = useStore();

  const colorInputRef = useRef(null);
  // ✨ 3. Thêm ref cho input màu hoa văn
  const patternColorInputRef = useRef(null); 

  // --- (Hook để tự động fitView) ---
  useEffect(() => {
    if (needsFitView) {
      fitView({ duration: 300 }); 
      setNeedsFitView(false); 
    }
  }, [needsFitView, fitView, setNeedsFitView]);

  // --- (Hàm xử lý đổi màu nền) ---
  const handleBgColorChange = (e) => {
    document.documentElement.style.setProperty('--bg-primary', e.target.value);
  };
  const handleBgColorClick = () => {
    colorInputRef.current?.click();
  };
  
  // ✨ 4. Thêm hàm xử lý cho màu hoa văn
  const handlePatternColorChange = (e) => {
    setPatternColor(e.target.value);
  };
  const handlePatternColorClick = () => {
    patternColorInputRef.current?.click();
  };


  return (
    <div className="zoom-toolbar">
      {/* --- (Nút chỉnh kiểu nền) --- */}
      <button 
        className={backgroundVariant === 'lines' ? 'active' : ''} 
        onClick={() => setBackgroundVariant('lines')}
        title="Nền kẻ ngang"
      >
        <DashOutlined />
      </button>
      <button 
        className={backgroundVariant === 'dots' ? 'active' : ''} 
        onClick={() => setBackgroundVariant('dots')}
        title="Nền chấm bi"
      >
        <AppstoreOutlined />
      </button>
      <button 
        className={backgroundVariant === 'cross' ? 'active' : ''} 
        onClick={() => setBackgroundVariant('cross')}
        title="Nền caro"
      >
        <BorderOutlined />
      </button>
      
      {/* --- (Nút chỉnh màu nền) --- */}
      <button onClick={handleBgColorClick} title="Đổi màu nền (Light Mode)">
        <BgColorsOutlined />
        <input
          type="color"
          ref={colorInputRef}
          onChange={handleBgColorChange}
          style={{ visibility: 'hidden', width: 0, height: 0, position: 'absolute' }}
        />
      </button>
      
      {/* ✨ 5. THÊM NÚT CHỈNH MÀU HOA VĂN */}
      <button onClick={handlePatternColorClick} title="Đổi màu hoa văn nền">
        <FormatPainterOutlined />
        <input
          type="color"
          ref={patternColorInputRef}
          onChange={handlePatternColorChange}
          style={{ visibility: 'hidden', width: 0, height: 0, position: 'absolute' }}
        />
      </button>

      {/* --- CÁC NÚT CŨ --- */}
      <button onClick={() => zoomOut()} title="Thu nhỏ"><ZoomOutOutlined /></button>
      <div className="zoom-level">{Math.round(zoom * 100)}%</div>
      <button onClick={() => zoomIn()} title="Phóng to"><ZoomInOutlined /></button>
      <button onClick={() => fitView()} title="Căn giữa sơ đồ"><AimOutlined /></button>
      <button 
        className={isMiniMapVisible ? 'active' : ''} 
        onClick={toggleMiniMap}
        title="Bật/Tắt MiniMap"
      >
        <GatewayOutlined />
      </button>
    </div>
  );
};

export default ZoomToolbar;