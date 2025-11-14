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
      const response = await fetch(`/mindmaps/${id}/json`, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (response.status === 401 || (response.redirected && response.url.includes('/login'))) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Không thể tải mindmap');
      }
      
      let nodes, edges;
      
      // ✅ ƯU TIÊN: Nếu đã có nodes/edges đã lưu trong DB, dùng luôn
      if (result.data.nodes && result.data.nodes.length > 0) {
        nodes = result.data.nodes;
        edges = result.data.edges || [];
        console.log('✅ Load từ DB:', nodes.length, 'nodes đã lưu');
      } else {
        // ✅ FALLBACK: Nếu chưa có nodes/edges, chuyển đổi từ Markdown
        const converted = markdownToMindmap(result.data.content);
        nodes = converted.nodes;
        edges = converted.edges;
        console.log('✅ Chuyển đổi từ Markdown:', nodes.length, 'nodes');
      }
      
      // Load vào store với layout đã có sẵn (CHIỀU NGANG)
      loadState({ nodes, edges });
      
      setLoading(false);
      
      // Chuyển sang editor với ID để có thể lưu
      setTimeout(() => {
        navigate(`/editor/${id}`);
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