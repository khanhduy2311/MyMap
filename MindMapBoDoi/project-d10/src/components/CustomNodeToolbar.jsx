import React, { useState, useEffect, useRef } from 'react';
import { NodeToolbar } from '@xyflow/react';
import { Switch, Input } from 'antd';
import {
  BorderOutlined,
  LineOutlined,
  BgColorsOutlined,
  BlockOutlined,
  MessageOutlined,
  SmileOutlined,
  EditOutlined,
  FontColorsOutlined, 
  PlusOutlined,
  FontSizeOutlined, // ✨ 1. Import icon mới
} from '@ant-design/icons';
import {useStore} from '../store/store';
import { darkenColor } from '../utils/colorUtils'; 

// ID cho node giả
const FAKE_NODE_ID = 'multi-select-fake-node';

// Danh sách màu gốc
const PREDEFINED_COLORS = [
  '#ffffff', '#e9ecef', '#ced4da', '#adb5bd',
  '#f03e3e', '#d6336c', '#ae3ec9', '#7048e8',
  '#4263eb', '#1c7ed6', '#1098ad', '#0ca678',
  '#fab005', '#f59f00', '#f76707',
];

// ✨ 2. Định nghĩa danh sách font
const FONT_OPTIONS = [
  'Arial',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Comic Sans MS',
];


// --- (Helper functions and SVG Icons - Giữ nguyên) ---
const parseBorder = (borderStr = '3px solid #555') => {
  if (borderStr === 'none') return { width: 0, style: 'solid', color: '#000000' };
  const parts = borderStr.split(' ');
  const color = parts[2] || '#000000';
  return { width: parseInt(parts[0], 10), style: parts[1], color: color };
};
const getEdgeStyleName = (strokeDasharray) => {
  if (strokeDasharray === '5 5') return 'dashed';
  if (strokeDasharray === '1 3') return 'dotted';
  return 'solid';
};
const defaultEdgeStyle = { stroke: '#888', strokeWidth: 2 };
const OvalIcon = () => <svg width="24" height="24" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="22" height="14" rx="7" stroke="currentColor" strokeWidth="2" /></svg>;
const SquareIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" /></svg>;
const CircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" /></svg>;
const DefaultEdgeIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 18C2 18 10 2 18 2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
const StepEdgeIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 18H10V2H18" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
const defaultEdgeProps = { style: defaultEdgeStyle, type: 'default' };
// --- End Helpers ---


const CustomNodeToolbar = ({ nodeId, data, isVisible }) => {
  const {
    updateOutgoingEdges, updateIncomingEdge, updateEdgeLabel,
    updateNodesStyle, updateNodesData, toggleNodesStyle,
    updateEdgesStyleByNodeIds, updateEdgesTypeByNodeIds,
  } = useStore();

  const selectedNodeIds = useStore(s => s.selectedNodeIds);
  const isMultiSelect = selectedNodeIds.length > 1;
  const getTargetIds = () => (isMultiSelect ? selectedNodeIds : [nodeId]);
  const isFakeNode = nodeId === FAKE_NODE_ID;

  // --- (Panel states) ---
  const [isBorderSettingsVisible, setBorderSettingsVisible] = useState(false);
  const [isEdgeSettingsVisible, setEdgeSettingsVisible] = useState(false);
  const [isBgSettingsVisible, setBgSettingsVisible] = useState(false);
  const [isTextSettingsVisible, setTextSettingsVisible] = useState(false);
  const [isShapeSettingsVisible, setShapeSettingsVisible] = useState(false);
  const [isIconSettingsVisible, setIconSettingsVisible] = useState(false);
  const [isIncomingEdgeSettingsVisible, setIncomingEdgeSettingsVisible] = useState(false);
  const [isFontSettingsVisible, setFontSettingsVisible] = useState(false); // ✨ 3. Thêm state

  // State for custom colors (temporary)
  const [customColors, setCustomColors] = useState([]);
  const colorInputRef = useRef(null); 
  const [colorTarget, setColorTarget] = useState(null); 

  // --- (Style fetching - Giữ nguyên) ---
  const currentStyle = data.style || {};
  const borderProps = parseBorder(currentStyle.border);
  const [currentEdgeStyle, setCurrentEdgeStyle] = useState(defaultEdgeStyle);
  const [currentEdgeType, setCurrentEdgeType] = useState('default');
  const singleNodeEdgeProps = useStore(state => {
      if (isMultiSelect) return null;
      const incoming = state.edges.find(e => e.target === nodeId);
      if (incoming) return incoming;
      const outgoing = state.edges.find(e => e.source === nodeId);
      if (outgoing) return outgoing;
      return defaultEdgeProps;
  });
  useEffect(() => {
    if (singleNodeEdgeProps) {
      setCurrentEdgeStyle(singleNodeEdgeProps.style || defaultEdgeStyle);
      setCurrentEdgeType(singleNodeEdgeProps.type || 'default');
    } else {
      setCurrentEdgeStyle(defaultEdgeStyle);
      setCurrentEdgeType('default');
    }
  }, [singleNodeEdgeProps, isMultiSelect]);
  const incomingEdge = useStore((state) =>
    !isMultiSelect ? state.edges.find((edge) => edge.target === nodeId) : null
  );

  // --- (Node event handlers - Giữ nguyên) ---
  const handleBorderChange = (prop, value) => {
    const newBorderProps = { ...borderProps, [prop]: value };
    let newBorderStyle;
    const width = !isNaN(newBorderProps.width) ? newBorderProps.width : (parseInt(currentStyle.border?.split(' ')[0], 10) || 0);
    newBorderStyle = `${width}px ${newBorderProps.style} ${newBorderProps.color}`;
    updateNodesStyle(getTargetIds(), { border: newBorderStyle });
  };
  const toggleBorder = (checked) => {
    const currentBorder = currentStyle.border;
    const restoredBorder = currentStyle.previousBorder || '3px solid #555';
    const previousBorderToSave = (!checked && currentBorder && currentBorder !== 'none') ? currentBorder : currentStyle.previousBorder;
    updateNodesStyle(getTargetIds(), { border: checked ? restoredBorder : 'none', previousBorder: previousBorderToSave });
  };
  const handleShapeChange = (shape) => {
    const newStyle = { ...currentStyle };
    let previousBorder = currentStyle.previousBorder;
    if (shape === 'oval') { newStyle.borderRadius = '50px'; }
    else if (shape === 'square') { newStyle.borderRadius = '10px'; }
    else if (shape === 'circle') { newStyle.borderRadius = '50%'; }

    if (shape === 'text') {
      if (currentStyle.border !== 'none') { previousBorder = currentStyle.border; }
      newStyle.border = 'none';
      newStyle.backgroundOpacity = 0;
    } else {
      if (currentStyle.border === 'none' && previousBorder) {
        newStyle.border = previousBorder;
        previousBorder = undefined;
      } else if (currentStyle.border === 'none') {
         newStyle.border = '3px solid #555';
      }
      if (currentStyle.backgroundOpacity === 0) { newStyle.backgroundOpacity = 1; }
    }

    const styleChanges = {
        borderRadius: newStyle.borderRadius,
        border: newStyle.border,
        backgroundOpacity: newStyle.backgroundOpacity,
        previousBorder: previousBorder
    };
    updateNodesStyle(getTargetIds(), styleChanges);
  };
  const borderStyles = ['solid', 'dashed', 'dotted'];
  const edgeStyles = ['solid', 'dashed', 'dotted'];
  const handleIconChange = (e) => {
    updateNodesData(getTargetIds(), { icon: e.target.value });
    setIconSettingsVisible(false);
  };
  const handleIncomingEdgeLabelChange = (e) => {
    if (incomingEdge) {
      updateEdgeLabel(incomingEdge.id, e.target.value);
    }
    setIncomingEdgeSettingsVisible(false);
  };

  // --- (Edge event handlers - Giữ nguyên) ---
  const handleEdgeStyleChange = (style) => {
    if (isMultiSelect) {
      updateEdgesStyleByNodeIds(getTargetIds(), style);
    } else {
      const mergedStyle = { ...currentEdgeStyle, ...style };
      updateOutgoingEdges(nodeId, { style: mergedStyle });
      updateIncomingEdge(nodeId, { style: mergedStyle });
    }
    setCurrentEdgeStyle(prev => ({...prev, ...style}));
  };
  const handleEdgeTypeChange = (type) => {
    if (isMultiSelect) {
      updateEdgesTypeByNodeIds(getTargetIds(), type);
    } else {
      updateOutgoingEdges(nodeId, { type });
      updateIncomingEdge(nodeId, { type });
    }
    setCurrentEdgeType(type);
  };

  // --- (Custom color functions - Giữ nguyên) ---
  const handleAddColorClick = (targetStyleKey) => {
    setColorTarget(targetStyleKey);
    colorInputRef.current?.click();
  };

  const handleColorInputChange = (event) => {
    const newColor = event.target.value;
    if (newColor && !customColors.includes(newColor) && !PREDEFINED_COLORS.includes(newColor)) {
      setCustomColors(prev => [...prev, newColor]);
    }
    if (colorTarget) {
      if (colorTarget === 'borderColor') {
        handleBorderChange('color', newColor);
      } else if (colorTarget === 'edgeColor') {
        handleEdgeStyleChange({ stroke: newColor });
      } else {
        updateNodesStyle(getTargetIds(), { [colorTarget]: newColor });
      }
    }
    setColorTarget(null);
  };

  const renderColorButtons = (styleKey, closePanel, isMini = false) => {
    const allColors = [...PREDEFINED_COLORS, ...customColors];
    return (
      <div className={`color-palette ${isMini ? 'mini' : ''}`}>
        {allColors.map(color => (
          <button
            key={color}
            className="color-button"
            style={{
              backgroundColor: color,
              borderColor: darkenColor(color, 20)
            }}
            title={color}
            onClick={() => {
              if (styleKey === 'borderColor') handleBorderChange('color', color);
              else if (styleKey === 'edgeColor') handleEdgeStyleChange({ stroke: color });
              else updateNodesStyle(getTargetIds(), { [styleKey]: color });
              closePanel(); 
            }}
          />
        ))}
        <button
          className="color-button add-color-button"
          title="Thêm màu mới"
          onClick={() => handleAddColorClick(styleKey)}
        >
          <PlusOutlined />
        </button>
      </div>
    );
  };

  return (
    <NodeToolbar
      nodeId={nodeId}
      position="top"
      isVisible={isVisible}
    >
      <div
        className="main-toolbar"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* --- Text Styling (Font, Size) --- */}
        <button onClick={() => toggleNodesStyle(getTargetIds(), 'fontWeight')} className={currentStyle.fontWeight === 'bold' ? 'active' : ''} title="In đậm"> <b>B</b> </button>
        <button onClick={() => toggleNodesStyle(getTargetIds(), 'fontStyle')} className={currentStyle.fontStyle === 'italic' ? 'active' : ''} title="In nghiêng"> <i>I</i> </button>
        <input type="number" min="8" max="48" className="font-size-input" value={parseInt(currentStyle.fontSize, 10) || 14} onChange={(e) => updateNodesStyle(getTargetIds(), { fontSize: `${e.target.value}px` })} title="Cỡ chữ" />
        
        {/* ✨ 4. THÊM NÚT VÀ PANEL CHỌN FONT */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setFontSettingsVisible(true)} onMouseLeave={() => setFontSettingsVisible(false)}>
          <button className="icon-button" title="Đổi Font chữ"> <FontSizeOutlined /> </button>
          <div className={`border-settings ${isFontSettingsVisible ? 'visible' : ''}`} style={{ width: 200, padding: 12 }}>
            <div className="setting-row">
              <span>Font chữ</span>
              <select
                value={currentStyle.fontFamily || 'Arial'}
                onChange={(e) => updateNodesStyle(getTargetIds(), { fontFamily: e.target.value })}
                style={{ width: 120, border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {FONT_OPTIONS.map(font => (
                  <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="divider"></div>

        {/* --- Background Color Button & Panel --- */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setBgSettingsVisible(true)} onMouseLeave={() => setBgSettingsVisible(false)}>
          <button className="icon-button" title="Màu nền Node"> <BgColorsOutlined /> </button>
          <div className={`color-settings ${isBgSettingsVisible ? 'visible' : ''}`}>
            {renderColorButtons('backgroundColor', () => setBgSettingsVisible(false))}
            <div className="divider full-width"></div>
             <div className="setting-row"> <span>Độ mờ nền</span>
              <input type="range" min="0" max="1" step="0.1" value={currentStyle.backgroundOpacity ?? 1}
                onChange={(e) => updateNodesStyle(getTargetIds(), { backgroundOpacity: parseFloat(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* --- Text Color Button & Panel --- */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setTextSettingsVisible(true)} onMouseLeave={() => setTextSettingsVisible(false)}>
          <button className="icon-button" title="Màu chữ Node"> <FontColorsOutlined /> </button>
          <div className={`color-settings ${isTextSettingsVisible ? 'visible' : ''}`}>
            {renderColorButtons('color', () => setTextSettingsVisible(false))}
          </div>
        </div>

        <div className="divider"></div>

        {/* --- Icon, Shape --- */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setIconSettingsVisible(true)} onMouseLeave={() => setIconSettingsVisible(false)}>
          <button className="icon-button" title="Thêm Icon/Emoji"> <SmileOutlined /> </button>
          <div className={`border-settings ${isIconSettingsVisible ? 'visible' : ''}`}>
            <div className="setting-row"> <span>Icon (Emoji/URL)</span> </div>
            <Input placeholder="Dán emoji hoặc URL ảnh..." defaultValue={data.icon || ''} onPressEnter={handleIconChange} onBlur={() => setIconSettingsVisible(false)} autoFocus />
          </div>
        </div>
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setShapeSettingsVisible(true)} onMouseLeave={() => setShapeSettingsVisible(false)}>
          <button className="icon-button" title="Thay đổi hình dạng"><BlockOutlined /></button>
          <div className={`border-settings ${isShapeSettingsVisible ? 'visible' : ''}`}>
            <div className="setting-row"> <span>Hình dạng</span>
              <div className="shape-selector">
                <button title="Chữ nhật bo góc" onClick={() => handleShapeChange('square')}><SquareIcon /></button>
                <button title="Hình Oval" onClick={() => handleShapeChange('oval')}><OvalIcon /></button>
                <button title="Hình tròn" onClick={() => handleShapeChange('circle')}><CircleIcon /></button>
                <button title="Chỉ hiện chữ" onClick={() => handleShapeChange('text')}><MessageOutlined /></button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Border Panel --- */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setBorderSettingsVisible(true)} onMouseLeave={() => setBorderSettingsVisible(false)}>
          <button className="icon-button" title="Chỉnh sửa viền"><BorderOutlined /></button>
          <div className={`border-settings ${isBorderSettingsVisible ? 'visible' : ''}`}>
            <div className="setting-row"> <span>Hiển thị viền</span> <Switch size="small" checked={currentStyle.border !== 'none'} onChange={toggleBorder} /> </div>
            <div className="divider full-width"></div>
            <div className="setting-row"> <span>Kiểu viền</span>
              <div className="border-style-selector"> {borderStyles.map((style) => ( <button key={style} className={borderProps.style === style ? 'active' : ''} onClick={() => handleBorderChange('style', style)}> <div className={`line ${style}`}></div> </button>))} </div>
            </div>
            <div className="setting-row"> <span>Độ dày</span> <input type="range" min="1" max="20" value={borderProps.width} onChange={(e) => handleBorderChange('width', parseInt(e.target.value))} /> </div>
            <div className="setting-row"> <span>Độ mờ viền</span>
              <input type="range" min="0" max="1" step="0.1"
                value={currentStyle.borderOpacity ?? 1}
                onChange={(e) => updateNodesStyle(getTargetIds(), { borderOpacity: parseFloat(e.target.value) })} />
            </div>
             <div className="setting-row"> <span>Màu sắc</span> {/* Label only */} </div>
            {renderColorButtons('borderColor', () => setBorderSettingsVisible(false), true)}
          </div>
        </div>

        {/* --- Edge Panel --- */}
        <div className="toolbar-icon-wrapper" onMouseEnter={() => setEdgeSettingsVisible(true)} onMouseLeave={() => setEdgeSettingsVisible(false)}>
          <button className="icon-button" title="Chỉnh sửa đường nối"><LineOutlined /></button>
          <div className={`edge-settings ${isEdgeSettingsVisible ? 'visible' : ''}`}>
            <div className="setting-row"> <span>Độ dày</span> <input type="range" min="1" max="10" value={currentEdgeStyle.strokeWidth || 2} onChange={(e) => handleEdgeStyleChange({ strokeWidth: parseInt(e.target.value) })} /> </div>
             <div className="setting-row"> <span>Màu sắc</span> {/* Label only */} </div>
            {renderColorButtons('edgeColor', () => setEdgeSettingsVisible(false), true)}
            <div className="setting-row"> <span>Kiểu</span>
              <div className="border-style-selector">
                {edgeStyles.map((style) => (
                  <button key={style} className={getEdgeStyleName(currentEdgeStyle.strokeDasharray) === style ? 'active' : ''} onClick={() => handleEdgeStyleChange({ strokeDasharray: style === 'dashed' ? '5 5' : style === 'dotted' ? '1 3' : undefined })}>
                    <div className={`line ${style}`}></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="divider full-width"></div>
            <div className="setting-row"> <span>Loại đường</span>
              <div className="border-style-selector">
                <button key="default" className={currentEdgeType === 'default' ? 'active' : ''} onClick={() => handleEdgeTypeChange('default')} title="Đường cong"><DefaultEdgeIcon /></button>
                <button key="step" className={currentEdgeType === 'step' ? 'active' : ''} onClick={() => handleEdgeTypeChange('step')} title="Đường gấp khúc"><StepEdgeIcon /></button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Incoming Edge Label --- */}
        {!isFakeNode && incomingEdge && (
          <div className="toolbar-icon-wrapper" onMouseEnter={() => setIncomingEdgeSettingsVisible(true)} onMouseLeave={() => setIncomingEdgeSettingsVisible(false)}>
            <button className="icon-button" title="Chỉnh sửa nhãn (CẠNH VÀO)"> <EditOutlined /> </button>
            <div className={`border-settings ${isIncomingEdgeSettingsVisible ? 'visible' : ''}`}>
              <div className="setting-row"> <span>Nhãn (Cạnh đi vào)</span> </div>
              <Input placeholder="Nhập nhãn quan hệ..." defaultValue={incomingEdge.label || ''} onPressEnter={handleIncomingEdgeLabelChange} onBlur={() => setIncomingEdgeSettingsVisible(false)} autoFocus />
            </div>
          </div>
        )}

        {/* Hidden Color Input */}
        <input
          type="color"
          ref={colorInputRef}
          onChange={handleColorInputChange}
          style={{ visibility: 'hidden', width: 0, height: 0, position: 'absolute', top: '-100px', left: '-100px' }} 
        />
      </div>
    </NodeToolbar>
  );
};

export default CustomNodeToolbar;