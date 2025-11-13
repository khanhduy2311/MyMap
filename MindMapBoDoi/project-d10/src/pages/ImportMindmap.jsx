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
      
      // Load vào store với layout đã có sẵn (CHIỀU NGANG)
      loadState({ nodes, edges });
      
      console.log('✅ Đã load', nodes.length, 'nodes với layout NGANG');
      
      setLoading(false);
      
      // Chuyển sang editor ngay lập tức
      setTimeout(() => {
        navigate('/mindmap-editor');
      }, 100);
      
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