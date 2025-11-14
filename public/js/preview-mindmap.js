// Mindmap Preview Function
function previewMindmap(mindmapId) {
  // Tạo modal preview
  const modal = document.createElement('div');
  modal.className = 'preview-modal';
  modal.innerHTML = `
    <div class="preview-modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="preview-modal-content">
      <div class="preview-modal-header">
        <h3><i class="fas fa-eye me-2"></i>Xem trước Mindmap</h3>
        <button class="preview-close-btn" onclick="this.closest('.preview-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="preview-modal-body">
        <iframe src="/import/${mindmapId}" frameborder="0"></iframe>
      </div>
      <div class="preview-modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
          <i class="fas fa-times me-1"></i>Đóng
        </button>
        <a href="/import/${mindmapId}" target="_blank" class="btn btn-primary">
          <i class="fas fa-external-link-alt me-1"></i>Mở toàn màn hình
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add animation
  setTimeout(() => modal.classList.add('show'), 10);
  
  // Close on ESC key
  const closeOnEsc = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', closeOnEsc);
    }
  };
  document.addEventListener('keydown', closeOnEsc);
}
