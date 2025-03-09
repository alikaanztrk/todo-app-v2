const { ipcRenderer } = require('electron');
let tasks = [];

// Theme handling
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Aktif tema butonunu güncelle
    document.querySelectorAll('.theme-selector button').forEach(btn => {
        btn.classList.remove('active');
        if ((theme === 'light' && btn.classList.contains('btn-light')) ||
            (theme === 'dark' && btn.classList.contains('btn-dark')) ||
            (theme === 'colorful' && btn.classList.contains('btn-info'))) {
            btn.classList.add('active');
        }
    });
}

let altGorevModal;
let subtaskEditModal;
let aboutModal;

// Sürükle bırak için global değişkenler
let draggedTask = null;
let originalColumn = null;
let debounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Bootstrap modallarını başlat
    altGorevModal = new bootstrap.Modal(document.getElementById('altGorevModal'), {
        backdrop: 'static',  // Modal dışına tıklayınca kapanmaz
        keyboard: false      // ESC tuşu ile kapanmaz
    });
    
    subtaskEditModal = new bootstrap.Modal(document.getElementById('subtaskEditModal'), {
        backdrop: 'static',
        keyboard: false
    });

    // Hakkında modalını başlat
    aboutModal = new bootstrap.Modal(document.getElementById('aboutModal'), {
        keyboard: true
    });
    
    loadKanbanTasks();

    // Enter tuşu ile alt görev ekleme
    document.getElementById('altGorevBaslik').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            altGorevKaydet();
        }
    });
});

// Context menu olayları
document.addEventListener('contextmenu', (e) => {
    const subtaskElement = e.target.closest('.subtask-item');
    if (subtaskElement) {
        e.preventDefault();
        const subtaskId = subtaskElement.querySelector('input').id.replace('subtask-', '');
        showSubtaskContextMenu(subtaskId, e.pageX, e.pageY);
    }
});

function showSubtaskContextMenu(subtaskId, x, y) {
    // Varsa eski menüyü kaldır
    const oldMenu = document.querySelector('.context-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.innerHTML = `
        <div class="menu-item" onclick="handleSubtaskAction('edit', ${subtaskId})">
            <i class="bi bi-pencil"></i> Düzenle
        </div>
        <div class="menu-item" onclick="handleSubtaskAction('delete', ${subtaskId})">
            <i class="bi bi-trash"></i> Sil
        </div>
    `;
    document.body.appendChild(menu);

    // Menü dışına tıklandığında kapat
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Alt görev işlemleri için yeni fonksiyon
async function handleSubtaskAction(action, subtaskId) {
    // Önce context menu'yü kaldır
    const menu = document.querySelector('.context-menu');
    if (menu) menu.remove();

    // Seçilen işlemi gerçekleştir
    if (action === 'edit') {
        await duzenleSubtask(subtaskId);
    } else if (action === 'delete') {
        await silSubtask(subtaskId);
    }
}

async function loadKanbanTasks() {
    try {
        tasks = await ipcRenderer.invoke('todo:list', 'all');
        const columns = document.querySelectorAll('.kanban-column');
        
        // Clear existing tasks
        columns.forEach(column => {
            const tasksContainer = column.querySelector('.tasks-container');
            tasksContainer.innerHTML = '';
        });

        // Distribute tasks to columns
        tasks.forEach(task => {
            const column = document.querySelector(`.kanban-column[data-status="${task.status}"]`);
            if (column) {
                const tasksContainer = column.querySelector('.tasks-container');
                const taskCard = createTaskCard(task);
                tasksContainer.appendChild(taskCard);
            }
        });

        setupDragAndDrop();
    } catch (error) {
        console.error('Kanban tasks loading error:', error);
    }
}

// Tarih formatı için yardımcı fonksiyon
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('tr-TR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'todo-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    const priorityColor = {
        'yüksek': 'danger',
        'orta': 'warning',
        'düşük': 'success'
    }[task.priority] || 'secondary';

    card.innerHTML = `
        <div class="todo-title">${task.title}</div>
        ${task.due_date ? `
            <small class="due-date">
                <i class="bi bi-calendar"></i>
                ${formatDate(task.due_date)}
            </small>
        ` : ''}
        <div class="priority-info">
            <span class="badge bg-${priorityColor}">${task.priority}</span>
        </div>
        ${task.description ? `<div class="todo-description">${task.description}</div>` : ''}
        ${task.subtasks && task.subtasks.length > 0 ? `
            <div class="subtasks-section">
                <small><i class="bi bi-list-check"></i> Alt Görevler (${task.subtasks.length})</small>
                <div class="subtasks-list">
                    ${task.subtasks.map(subtask => `
                        <div class="subtask-item">
                            <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                                onclick="toggleSubtask(${subtask.id}, this.checked)"
                                id="subtask-${subtask.id}">
                            <span class="subtask-title ${subtask.completed ? 'text-decoration-line-through' : ''}">${subtask.title}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        <div class="card-actions">
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" onclick="editTask(${task.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="addSubtask(${task.id})">
                    <i class="bi bi-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${task.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;

    return card;
}

// Yeni fonksiyonlar ekliyoruz
async function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        
        // Tarih ve saat formatını ayarla
        if (task.due_date) {
            const date = new Date(task.due_date);
            // Saat farkını düzelt ve ISO string formatına çevir
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            const formattedDate = date.toISOString().slice(0, 16);
            document.getElementById('editTaskDueDate').value = formattedDate;
            console.log('Düzenleme için tarih ayarlandı:', formattedDate); // Debug log
        } else {
            document.getElementById('editTaskDueDate').value = '';
        }
        
        document.getElementById('editTaskPriority').value = task.priority || 'orta';
        
        const modal = new bootstrap.Modal(document.getElementById('taskEditModal'));
        modal.show();
    }
}

async function deleteTask(id) {
    if (confirm('Görevi silmek istediğinizden emin misiniz?')) {
        await ipcRenderer.invoke('todo:delete', id);
        await loadKanbanTasks();
    }
}

async function addSubtask(parentId) {
    document.getElementById('parentTaskId').value = parentId;
    document.getElementById('altGorevBaslik').value = ''; // Input'u temizle
    altGorevModal.show();
}

async function toggleSubtask(id, completed) {
    await ipcRenderer.invoke('subtask:toggleComplete', { id, completed });
    await loadKanbanTasks();
}

async function altGorevKaydet() {
    const parentId = document.getElementById('parentTaskId').value;
    const title = document.getElementById('altGorevBaslik').value;

    if (!title) {
        alert('Alt görev başlığı boş olamaz!');
        return;
    }

    try {
        await ipcRenderer.invoke('subtask:add', { 
            parentId: parseInt(parentId), 
            title: title 
        });
        
        // Modal'ı kapat ve formu temizle
        document.getElementById('altGorevBaslik').value = '';
        altGorevModal.hide();
        
        // Görünümü yenile
        await loadKanbanTasks();
        
    } catch (error) {
        console.error('Alt görev ekleme hatası:', error);
        alert('Alt görev eklenirken bir hata oluştu');
    }
}

async function duzenleSubtask(subtaskId) {
    const subtaskElement = document.querySelector(`#subtask-${subtaskId}`);
    const subtaskTitle = subtaskElement.nextElementSibling.textContent.trim();
    
    document.getElementById('editSubtaskId').value = subtaskId;
    document.getElementById('editSubtaskTitle').value = subtaskTitle;
    
    subtaskEditModal.show();
}

async function subtaskDuzenlemeyiKaydet() {
    const id = document.getElementById('editSubtaskId').value;
    const title = document.getElementById('editSubtaskTitle').value;

    if (!title) {
        alert('Alt görev başlığı boş olamaz!');
        return;
    }

    try {
        await ipcRenderer.invoke('subtask:update', { 
            id: parseInt(id), 
            title: title 
        });
        subtaskEditModal.hide();
        await loadKanbanTasks();
    } catch (error) {
        console.error('Alt görev güncelleme hatası:', error);
        alert('Alt görev güncellenirken bir hata oluştu');
    }
}

async function silSubtask(subtaskId) {
    if (confirm('Alt görevi silmek istediğinizden emin misiniz?')) {
        try {
            await ipcRenderer.invoke('subtask:delete', subtaskId);
            await loadKanbanTasks();
        } catch (error) {
            console.error('Alt görev silme hatası:', error);
            alert('Alt görev silinirken bir hata oluştu');
        }
    }
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.todo-card');
    const columns = document.querySelectorAll('.kanban-column');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedTask = card;
            originalColumn = card.closest('.kanban-column');
            card.classList.add('dragging');
            
            // Sürükleme efekti için
            e.dataTransfer.effectAllowed = 'move';
            requestAnimationFrame(() => {
                card.style.opacity = '0.5';
            });
        });

        card.addEventListener('dragend', (e) => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
            draggedTask = null;
            originalColumn = null;
            
            // Debounce ile yenileme
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadKanbanTasks();
            }, 300);
        });
    });

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!draggedTask) return;

            const newStatus = column.dataset.status;
            const taskId = parseInt(draggedTask.dataset.taskId);
            const tasksContainer = column.querySelector('.tasks-container');
            
            // Eğer aynı sütundaysa ve pozisyon değişmediyse işlem yapma
            if (column === originalColumn && 
                draggedTask.nextSibling === getClosestTask(column, e.clientY)) {
                return;
            }

            // Sürüklenen kartın pozisyonunu güncelle
            const afterElement = getClosestTask(column, e.clientY);
            if (afterElement) {
                tasksContainer.insertBefore(draggedTask, afterElement);
            } else {
                tasksContainer.appendChild(draggedTask);
            }

            // Status güncelleme
            if (column !== originalColumn) {
                updateTaskStatus(taskId, newStatus);
            }
        });
    });
}

// Sürüklenen kartın bırakılacağı pozisyonu hesapla
function getClosestTask(column, y) {
    const tasks = [...column.querySelectorAll('.todo-card:not(.dragging)')];
    
    return tasks.reduce((closest, task) => {
        const box = task.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: task };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Status güncelleme fonksiyonu
async function updateTaskStatus(taskId, newStatus) {
    try {
        await ipcRenderer.invoke('todo:updateStatus', { 
            id: taskId, 
            status: newStatus 
        });
    } catch (error) {
        console.error('Status güncelleme hatası:', error);
    }
}

// İstatistikler için fonksiyonu güncelle
async function openStats() {
    // Kanban header'ı gizle
    document.querySelector('.kanban-header').style.display = 'none';

    // Ana içerik alanını temizle
    document.querySelector('.main-content').innerHTML = `
        <div class="container mt-4">
            <h2>Görev İstatistikleri</h2>
            <div class="row mt-3">
                <div class="col-md-6">
                    <div class="chart-container" style="height: 400px; margin-bottom: 20px;">
                        <h4>Durum Dağılımı</h4>
                        <canvas id="statusChart"></canvas>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="chart-container" style="height: 400px; margin-bottom: 20px;">
                        <h4>Tamamlanan Görevler</h4>
                        <div class="btn-group mb-3">
                            <button class="btn btn-outline-primary" onclick="loadCompletedTasks('daily')">Günlük</button>
                            <button class="btn btn-outline-primary" onclick="loadCompletedTasks('weekly')">Haftalık</button>
                            <button class="btn btn-outline-primary" onclick="loadCompletedTasks('monthly')">Aylık</button>
                        </div>
                        <canvas id="completedChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Chart.js script'ini dinamik olarak yükle
    if (!window.Chart) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
            loadStatusChart();
            loadCompletedTasks('daily');
        };
        document.head.appendChild(script);
    } else {
        loadStatusChart();
        loadCompletedTasks('daily');
    }
}

// Durum dağılımı grafiği
async function loadStatusChart() {
    try {
        const data = await ipcRenderer.invoke('stats:getTasksByStatus');
        
        const ctx = document.getElementById('statusChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(d => d.status),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: [
                        '#ffc107', // bekliyor
                        '#17a2b8', // başladı
                        '#28a745', // yapılıyor
                        '#fd7e14', // bitmeye_yakın
                        '#dc3545'  // bitti
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Durum istatistikleri yüklenirken hata:', error);
    }
}

// Tamamlanan görevler grafiği
async function loadCompletedTasks(period = 'daily') {
    try {
        const data = await ipcRenderer.invoke('stats:getCompletedTasksByDate', period);
        
        const ctx = document.getElementById('completedChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Tamamlanan Görevler',
                    data: data.map(d => d.count),
                    borderColor: '#4f46e5',
                    tension: 0.1,
                    fill: true,
                    backgroundColor: 'rgba(79, 70, 229, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Tamamlanan görev istatistikleri yüklenirken hata:', error);
    }
}

async function gorevDuzenlemeyiKaydet() {
    const id = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value;
    const description = document.getElementById('editTaskDescription').value;
    const dueDate = document.getElementById('editTaskDueDate').value;
    const priority = document.getElementById('editTaskPriority').value;

    if (!title.trim()) {
        alert('Başlık boş olamaz!');
        return;
    }

    // Mevcut görevi bul ve status bilgisini al
    const currentTask = tasks.find(t => t.id === parseInt(id));
    if (!currentTask) {
        alert('Görev bulunamadı!');
        return;
    }

    // Debug için tarih bilgisini logla
    console.log('Alınan tarih değeri:', dueDate);

    const updatedTask = {
        id: parseInt(id),
        title: title,
        description: description,
        due_date: dueDate, // Direkt datetime-local input değerini gönder
        priority: priority,
        status: currentTask.status
    };

    console.log('Güncellenecek görev:', updatedTask);

    try {
        await ipcRenderer.invoke('todo:update', updatedTask);
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskEditModal'));
        modal.hide();
        await loadKanbanTasks();
    } catch (error) {
        console.error('Görev güncellenirken hata:', error);
        alert('Görev güncellenirken bir hata oluştu!');
    }
}

// Hakkında modalını aç
function openAboutModal() {
    aboutModal.show();
}
