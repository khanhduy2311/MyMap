import React, { useState, useEffect, useRef } from 'react'; // Bỏ useRef
import { useStore } from '../store/store';
import { Input } from 'antd';
import { CloseOutlined } from '@ant-design/icons'; // Bỏ PlusOutlined
// import { darkenColor } from '../utils/colorUtils'; // ✨ 1. Xóa
import ColorPicker from './ColorPicker'; // ✨ 2. Import

// --- Icons ---
const DefaultEdgeIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 18C2 18 10 2 18 2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
const StepEdgeIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 18H10V2H18" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;

// --- Helper ---
const getEdgeStyleName = (strokeDasharray) => {
  if (strokeDasharray === '5 5') return 'dashed';
  if (strokeDasharray === '1 3') return 'dotted';
  return 'solid';
};
const edgeStyles = ['solid', 'dashed', 'dotted'];

// ✨ 3. Xóa PREDEFINED_COLORS
// const PREDEFINED_COLORS = [ ... ];


const CustomEdgeToolbar = ({ edgeId, style }) => {
  const { updateEdgeData } = useStore.getState();
  const setSelectedEdgeId = useStore(s => s.setSelectedEdgeId);

  const edge = useStore(s => s.edges.find(e => e.id === edgeId));
  const [label, setLabel] = useState(edge?.label || '');

  // ✨ 4. Xóa state màu
  // const [customColors, setCustomColors] = useState([]);
  // const colorInputRef = useRef(null); 

  useEffect(() => {
    setLabel(edge?.label || '');
  }, [edge?.label]);

  const currentEdgeType = edge?.type || 'default';
  const currentStyle = edge?.style || {};
  const currentDashStyle = getEdgeStyleName(currentStyle.strokeDasharray);


  // --- Event Handlers ---
  const handleLabelChange = (e) => setLabel(e.target.value);
  const handleLabelSubmit = () => updateEdgeData(edgeId, { label });
  const handleTypeChange = (type) => updateEdgeData(edgeId, { type });
  const handleStyleChange = (newStyle) => updateEdgeData(edgeId, { style: { ...currentStyle, ...newStyle } });
  const handleDashChange = (styleName) => {
    let strokeDasharray;
    if (styleName === 'dashed') strokeDasharray = '5 5';
    if (styleName === 'dotted') strokeDasharray = '1 3';
    handleStyleChange({ strokeDasharray });
  };
  const handleClose = () => setSelectedEdgeId(null);

  // ✨ 5. Xóa các hàm xử lý màu
  // const handleAddColorClick = () => { ... };
  // const handleColorInputChange = (event) => { ... };

  return (
    <div
      className="edge-toolbar"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
        {/* --- Label --- */}
        <div className="setting-row">
          <span>Nhãn</span>
          <Input
            placeholder="Nhập nhãn..."
            value={label}
            onChange={handleLabelChange}
            onPressEnter={handleLabelSubmit}
            onBlur={handleLabelSubmit}
            style={{ width: 120 }}
          />
        </div>
        <div className="divider full-width"></div>

        {/* --- Độ dày --- */}
        <div className="setting-row">
          <span>Độ dày</span>
          <input
            type="range"
            min="1" max="10"
            value={currentStyle.strokeWidth || 2}
            onChange={(e) => handleStyleChange({ strokeWidth: parseInt(e.target.value) })}
          />
        </div>

         {/* --- Màu sắc --- */}
         <div className="setting-row"> <span>Màu sắc</span> {/* Label only */} </div>
         
         {/* ✨ 6. Thay thế toàn bộ palette bằng ColorPicker */}
         <ColorPicker 
            paletteClass="mini"
            style={{ justifyContent: 'flex-end' }} // Căn phải
            onColorSelect={(color) => handleStyleChange({ stroke: color })}
         />
         {/* (Xóa toàn bộ div.color-palette.mini cũ) */}


        {/* --- Kiểu viền --- */}
        <div className="setting-row">
          <span>Kiểu viền</span>
          <div className="border-style-selector">
            {edgeStyles.map((style) => (
              <button
                key={style}
                className={currentDashStyle === style ? 'active' : ''}
                onClick={() => handleDashChange(style)}
              >
                <div className={`line ${style}`}></div>
              </button>
            ))}
          </div>
        </div>
        <div className="divider full-width"></div>

        {/* --- Edge Type --- */}
        <div className="setting-row">
          <span>Loại đường</span>
          <div className="border-style-selector">
            <button
              className={currentEdgeType === 'default' ? 'active' : ''}
              onClick={() => handleTypeChange('default')}
              title="Đường cong"><DefaultEdgeIcon />
            </button>
            <button
              className={currentEdgeType === 'step' ? 'active' : ''}
              onClick={() => handleTypeChange('step')}
              title="Đường gấp khúc"><StepEdgeIcon />
            </button>
          </div>
        </div>

        {/* --- Nút Đóng --- */}
        <button className="edge-toolbar-close" onClick={handleClose}>
          <CloseOutlined />
        </button>

        {/* ✨ 7. Xóa Input ẩn */}
    </div>
  );
};

export default CustomEdgeToolbar;