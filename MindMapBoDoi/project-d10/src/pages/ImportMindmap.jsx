import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlow, Background, ReactFlowProvider } from '@xyflow/react';
import { useStore } from '../store/store';
import { markdownToMindmap } from '../utils/markdownToMindmap';
import CustomNode from '../components/CustomNode';

const nodeTypes = { custom: CustomNode };

const ImportMindmap = () => {
  const { id } = useParams(); // Lấy mindmap ID từ URL
  const navigate = useNavigate();
  const { loadState, runAutoLayout } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAndConvert();
  }, [id]);

  const fetchAndConvert = async () => {
    try {
      setLoading(true);
      
      // Gọi API backend
      const response = await fetch(`/mindmaps/${id}/json`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Không thể tải mindmap');
      }
      
      // Chuyển đổi Markdown → Mindmap
      const { nodes, edges } = markdownToMindmap(result.data.content);
      
      // Load vào store
      loadState({ nodes, edges });
      
      // Tự động layout (tùy chọn)
      setTimeout(() => {
        runAutoLayout();
      }, 100);
      
      setLoading(false);
      
      // Chuyển sang editor sau 500ms
      setTimeout(() => {
        navigate('/mindmap-editor');
      }, 500);
      
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>
          <h2>🔄 Đang chuyển đổi mindmap...</h2>
          <p>Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: 'red' }}>❌ Lỗi</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')}>Quay về Dashboard</button>
      </div>
    );
  }

  return null;
};

export default ImportMindmap;