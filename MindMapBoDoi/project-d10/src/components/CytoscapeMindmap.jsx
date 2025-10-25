import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { markdownToMindmap } from '../utils/markdownToMindmap';

const CytoscapeMindmap = ({ markdownContent }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!markdownContent || !containerRef.current) return;

    // 1️⃣ Chuyển markdown → dữ liệu nodes/edges
    const { nodes, edges } = markdownToMindmap(markdownContent);

    // Giới hạn 20k node để an toàn
    const limitedNodes = nodes.slice(0, 20000);
    const limitedEdges = edges.slice(0, 20000);

    // 2️⃣ Chuyển đổi sang dạng Cytoscape
    const elements = [
      ...limitedNodes.map(n => ({
        data: { id: n.id, label: n.data?.label || 'Node' },
      })),
      ...limitedEdges.map(e => ({
        data: { id: e.id, source: e.source, target: e.target },
      })),
    ];

    // 3️⃣ Khởi tạo Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.5 },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#6fb1fc',
            'label': 'data(label)',
            'color': '#222',
            'font-size': '12px',
            'text-wrap': 'wrap',
            'text-max-width': '180px',
            'width': 'label',
            'height': 'label',
            'padding': '6px',
            'border-width': 2,
            'border-color': '#1e88e5',
            'shape': 'roundrectangle',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#999',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#999',
          },
        },
      ],
      wheelSensitivity: 0.2,
    });

    // 4️⃣ Xử lý click highlight node
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      cy.elements().removeClass('highlight');
      node.addClass('highlight');
      node.neighborhood().addClass('highlight');
    });

    // Style highlight
    cy.style().selector('.highlight').style({
      'background-color': '#ffca28',
      'line-color': '#ffca28',
      'target-arrow-color': '#ffca28',
      'transition-property': 'background-color, line-color',
      'transition-duration': '0.3s',
    }).update();

    // Cleanup khi unmount
    return () => cy.destroy();
  }, [markdownContent]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100vh',
        background: '#f5f5f5',
        border: '1px solid #ccc',
      }}
    />
  );
};

export default CytoscapeMindmap;
