const { ipcRenderer, contextBridge } = require('electron');

let altGorevModal;
let tasks = [];
let aboutModal;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Sayfa yüklendi');
    altGorevModal = new bootstrap.Modal(document.getElementById('altGorevModal'));
    listeyiYenile();

    // Hakkında modalını başlat
    aboutModal = new bootstrap.Modal(document.getElementById('aboutModal'), {
        keyboard: true
    });
});

// Alt görev context menu olaylarını dinle
document.addEventListener('contextmenu', (e) => {
    const subtaskElement = e.target.closest('.subtask');
    if (subtaskElement) {
        e.preventDefault();
        const subtaskId = subtaskElement.dataset.subtaskId;
        showSubtaskContextMenu(subtaskId, e.x, e.y);
    }
});

function showSubtaskContextMenu(subtaskId, x, y) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = `
        <div class="menu-item" onclick="duzenleSubtask(${subtaskId})">Düzenle</div>
        <div class="menu-item" onclick="silSubtask(${subtaskId})">Sil</div>
    `;
    document.body.appendChild(menu);

    // Menüyü kapat
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    
    // Bir tick bekleyip sonra click listener'ı ekle
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

// Sonraki duruma geçiş fonksiyonu
async function sonrakiDurum(id, mevcutDurum) {
    const durumlar = ['bekliyor', 'başladı', 'yapılıyor', 'bitmeye_yakın', 'bitti'];
    const mevcutIndex = durumlar.indexOf(mevcutDurum);
    if (mevcutIndex < durumlar.length - 1) {
        const yeniDurum = durumlar[mevcutIndex + 1];
        await durumGuncelle(id, yeniDurum);
    }
}

// Tarih kontrolü ve renk belirleme
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

function getTarihRengi(tarih) {
    if (!tarih) return '';
    
    const sonTarih = new Date(tarih);
    const bugun = new Date();
    const farkGun = Math.ceil((sonTarih - bugun) / (1000 * 60 * 60 * 24));
    
    if (farkGun <= 1) return 'text-danger';
    if (farkGun <= 2) return 'text-warning';
    return '';
}

async function duzenleSubtask(subtaskId) {
    const modal = new bootstrap.Modal(document.getElementById('subtaskEditModal'));
    document.getElementById('editSubtaskId').value = subtaskId;
    
    // Mevcut başlığı al
    const subtaskElement = document.querySelector(`[data-subtask-id="${subtaskId}"]`);
    const subtaskLabel = subtaskElement.querySelector('label');
    document.getElementById('editSubtaskTitle').value = subtaskLabel.textContent.trim();
    
    modal.show();
}

async function subtaskDuzenlemeyiKaydet() {
    const id = document.getElementById('editSubtaskId').value;
    const yeniBaslik = document.getElementById('editSubtaskTitle').value;

    if (yeniBaslik) {
        try {
            await ipcRenderer.invoke('subtask:update', { 
                id: parseInt(id), 
                title: yeniBaslik 
            });
            bootstrap.Modal.getInstance(document.getElementById('subtaskEditModal')).hide();
            await listeyiYenile();
        } catch (error) {
            console.error('Alt görev güncelleme hatası:', error);
        }
    }
}

async function silSubtask(subtaskId) {
    if (confirm('Alt görevi silmek istediğinize emin misiniz?')) {
        try {
            await ipcRenderer.invoke('subtask:delete', subtaskId);
            await listeyiYenile();
        } catch (error) {
            console.error('Alt görev silme hatası:', error);
        }
    }
}

// Ana penceredeki güncelleme olayını dinle
ipcRenderer.on('todo:updated', () => {
    listeyiYenile();
});

async function ekle() {
    try {
        const todo = {
            title: document.getElementById('todoInput').value,
            description: document.getElementById('todoDescription').value,
            status: document.getElementById('todoStatus').value,
            priority: document.getElementById('todoPriority').value,
            dueDate: document.getElementById('todoDueDate').value
        };

        if (!todo.title) {
            alert('Görev başlığı boş olamaz!');
            return;
        }

        await ipcRenderer.invoke('todo:add', todo);
        console.log('Görev eklendi');
        
        // Form temizleme
        document.getElementById('todoInput').value = '';
        document.getElementById('todoDescription').value = '';
        document.getElementById('todoDueDate').value = '';
        
        await listeyiYenile();
    } catch (error) {
        console.error('Hata:', error);
        alert('Bir hata oluştu: ' + error.message);
    }
}

async function duzenle(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        
        // Tarih ve saat formatını ayarla
        if (task.due_date) {
            const date = new Date(task.due_date);
            // Saat farkını düzelt
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            document.getElementById('editTaskDueDate').value = date.toISOString().slice(0, 16);
        } else {
            document.getElementById('editTaskDueDate').value = '';
        }
        
        document.getElementById('editTaskPriority').value = task.priority || 'orta';
        
        const modal = new bootstrap.Modal(document.getElementById('taskEditModal'));
        modal.show();
    }
}

async function listeyiYenile(filter = 'all') {
    try {
        tasks = await ipcRenderer.invoke('todo:list', filter);
        const liste = document.getElementById('todoList');
        if (!liste) return; // Liste elementi yoksa çık
        
        const container = liste.querySelector('.todo-container') || liste;
        container.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = createTaskRow(task);
            container.appendChild(taskElement);
        });
    } catch (error) {
        console.error('Liste yenileme hatası:', error);
    }
}

function createTaskRow(task) {
    const div = document.createElement('div');
    div.className = `todo-item priority-${task.priority} animate__animated animate__fadeIn`;
    
    // Alt görevleri hazırla
    const subtasksList = task.subtasks && task.subtasks.length > 0 
        ? `
            <div class="subtasks mt-3">
                <h6 class="subtasks-title">
                    <i class="bi bi-list-task"></i> Alt Görevler
                </h6>
                ${task.subtasks.map(subtask => `
                    <div class="subtask form-check" data-subtask-id="${subtask.id}">
                        <input class="form-check-input" type="checkbox" 
                            id="subtask-${subtask.id}"
                            ${subtask.completed ? 'checked' : ''} 
                            onchange="toggleSubtask(${subtask.id}, this.checked)">
                        <label class="form-check-label ${subtask.completed ? 'text-decoration-line-through' : ''}" 
                            for="subtask-${subtask.id}">
                            ${subtask.title}
                        </label>
                    </div>
                `).join('')}
            </div>
        ` : '';

    const tarihRengi = getTarihRengi(task.due_date);
    div.innerHTML = `
        <div class="card">
            <div class="card-body position-relative">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title">${task.title}</h5>
                    <div class="badge-group">
                        <span class="badge ${getStatusBadgeClass(task.status)}">${task.status}</span>
                        <span class="badge bg-${getPriorityColor(task.priority)}">${task.priority}</span>
                    </div>
                </div>
                <p class="card-text">${task.description || ''}</p>
                
                <!-- Tarih bilgileri -->
                <div class="dates-container">
                    ${task.due_date ? `
                        <div class="due-date ${tarihRengi}">
                            <i class="bi bi-calendar"></i>
                            <small>Son Tarih: ${formatDate(task.due_date)}</small>
                        </div>
                    ` : ''}
                    ${task.completed_at ? `
                        <div class="completed-date">
                            <i class="bi bi-check-circle"></i>
                            <small>Tamamlanma: ${formatDate(task.completed_at)}</small>
                        </div>
                    ` : ''}
                </div>
                
                ${subtasksList}
                <div class="mt-3">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger" onclick="sil(${task.id})">
                            <i class="bi bi-trash"></i> Sil
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="altGorevEkle(${task.id})">
                            <i class="bi bi-plus"></i> Alt Görev
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="duzenle(${task.id})">
                            <i class="bi bi-pencil"></i> Düzenle
                        </button>
                    </div>
                </div>
                ${task.status !== 'bitti' ? `
                    <button class="next-status-btn" onclick="sonrakiDurum(${task.id}, '${task.status}')">
                        <i class="bi bi-arrow-right"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    return div;
}

function getPriorityColor(priority) {
    switch(priority) {
        case 'yüksek': return 'danger';
        case 'orta': return 'warning';
        case 'düşük': return 'success';
        default: return 'secondary';
    }
}

// Alt görev işaretleme fonksiyonu
async function toggleSubtask(id, completed) {
    try {
        console.log('Alt görev durumu güncelleniyor:', { id, completed });
        
        await ipcRenderer.invoke('subtask:toggleComplete', { 
            id: id, 
            completed: completed 
        });
        
        console.log('Alt görev durumu güncellendi');
        await listeyiYenile();

    } catch (error) {
        console.error('Alt görev güncelleme hatası:', error);
        alert('Alt görev güncellenirken bir hata oluştu');
    }
}

async function sil(id) {
    try {
        await ipcRenderer.invoke('todo:delete', id);
        await listeyiYenile();
    } catch (error) {
        console.error('Silme hatası:', error);
    }
}

async function altGorevEkle(parentId) {
    document.getElementById('parentTaskId').value = parentId;
    altGorevModal.show();
}

async function altGorevKaydet() {
    try {
        const parentId = document.getElementById('parentTaskId').value;
        const title = document.getElementById('altGorevBaslik').value;

        if (!title) {
            alert('Alt görev başlığı boş olamaz!');
            return;
        }

        console.log('Alt görev ekleniyor:', { parentId, title });
        
        await ipcRenderer.invoke('subtask:add', { 
            parentId: parseInt(parentId), 
            title: title 
        });
        
        console.log('Alt görev eklendi');
        document.getElementById('altGorevBaslik').value = '';
        altGorevModal.hide();
        await listeyiYenile();

    } catch (error) {
        console.error('Alt görev ekleme hatası:', error);
        alert('Alt görev eklenirken bir hata oluştu: ' + error.message);
    }
}

async function durumGuncelle(id, yeniDurum) {
    try {
        await ipcRenderer.invoke('todo:updateStatus', { id, status: yeniDurum });
        await listeyiYenile();
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
    }
}

async function oncelikGuncelle(id, yeniOncelik) {
    try {
        await ipcRenderer.invoke('todo:updatePriority', { id, priority: yeniOncelik });
        await listeyiYenile();
    } catch (error) {
        console.error('Öncelik güncelleme hatası:', error);
    }
}

function temizleForm() {
    document.getElementById('todoForm').reset();
}

function filterByStatus(status) {
    listeyiYenile(status);
}

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

// Tema başlatma
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    // ...existing DOMContentLoaded code...
});

// İstatistikler için fonksiyonu güncelle
async function openStats() {
    // Ana içerik alanını temizle
    document.querySelector('.main-content').innerHTML = `
        <div class="header-actions">
            <div class="theme-selector">
                <button class="btn btn-light" onclick="setTheme('light')" title="Açık Tema">
                    <i class="bi bi-sun-fill"></i>
                </button>
                <button class="btn btn-dark" onclick="setTheme('dark')" title="Koyu Tema">
                    <i class="bi bi-moon-fill"></i>
                </button>
                <button class="btn btn-info" onclick="setTheme('colorful')" title="Renkli Tema">
                    <i class="bi bi-palette-fill"></i>
                </button>
            </div>
        </div>
        <h2 class="mb-4">Görev İstatistikleri</h2>
        <div class="row">
            <div class="col-md-6">
                <div class="chart-container">
                    <h4>Durum Dağılımı</h4>
                    <canvas id="statusChart"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-container">
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

// İstatistik fonksiyonlarını ekle
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

    const updatedTask = {
        id: parseInt(id),
        title: title,
        description: description,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority,
        status: currentTask.status
    };

    console.log('Güncellenecek görev:', updatedTask); // Debug için

    try {
        await ipcRenderer.invoke('todo:update', updatedTask);
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskEditModal'));
        modal.hide();
        await listeyiYenile();
    } catch (error) {
        console.error('Görev güncellenirken hata:', error);
        alert('Görev güncellenirken bir hata oluştu!');
    }
}

// Status badge renk sınıflarını belirle
const getStatusBadgeClass = (status) => {
    switch(status) {
        case 'bekliyor':
            return 'bg-secondary';
        case 'başladı':
            return 'bg-primary';
        case 'yapılıyor':
            return 'bg-warning text-dark';
        case 'bitmeye_yakın':
            return 'bg-orange text-white';
        case 'bitti':
            return 'bg-success';
        default:
            return 'bg-secondary';
    }
};

// CSS renk tanımı ekle
const style = document.createElement('style');
style.textContent = `
    .bg-orange {
        background-color: #fd7e14 !important;
    }
`;
document.head.appendChild(style);

// Hakkında modalını aç
function openAboutModal() {
    aboutModal.show();
}
