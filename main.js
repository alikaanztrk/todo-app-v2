const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let mainWindow;

// Veritabanı bağlantısını güncelle
const db = new sqlite3.Database(path.join(__dirname, 'todo.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası:', err);
    } else {
        console.log('Veritabanına bağlanıldı');
        // Tabloları oluştur ve kontrol et
        initDB();
    }
});

// IPC olaylarını dinle
ipcMain.handle('todo:add', async (event, todo) => {
    return new Promise((resolve, reject) => {
        console.log('Eklenecek görev:', todo); // Debug için log
        
        const sql = 'INSERT INTO todos (title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?)';
        const params = [
            todo.title, 
            todo.description, 
            todo.status, 
            todo.priority, 
            todo.dueDate // datetime-local input değerini direkt kullan
        ];
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Görev ekleme hatası:', err);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
});

// Alt görev ekleme handler'ını güncelle
ipcMain.handle('subtask:add', async (event, { parentId, title }) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO subtasks (parent_id, title, completed) VALUES (?, ?, 0)';
        db.run(sql, [parentId, title], function(err) {
            if (err) {
                console.error('Alt görev ekleme hatası:', err);
                reject(err);
            } else {
                console.log('Alt görev eklendi, ID:', this.lastID);
                resolve(this.lastID);
            }
        });
    });
});

// Durum güncelleme handler'ı
ipcMain.handle('todo:updateStatus', async (event, { id, status }) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE todos 
            SET status = ?, 
            completed_at = CASE 
                WHEN ? = 'bitti' THEN DATETIME('now', 'localtime')
                ELSE NULL 
            END
            WHERE id = ?`;
        
        db.run(sql, [status, status, id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Öncelik güncelleme handler'ı
ipcMain.handle('todo:updatePriority', async (event, { id, priority }) => {
    return new Promise((resolve, reject) => {
        db.run('UPDATE todos SET priority = ? WHERE id = ?', 
            [priority, id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Liste sorgusunu güncelle
ipcMain.handle('todo:list', async (event, filter = 'all') => {
    return new Promise((resolve, reject) => {
        let whereClause = '';
        
        switch(filter) {
            case 'bekleyenler':
                whereClause = "WHERE t.status = 'bekliyor'";
                break;
            case 'yapilanlar':
                whereClause = "WHERE t.status IN ('başladı', 'yapılıyor', 'bitmeye_yakın')";
                break;
            case 'bitenler':
                whereClause = "WHERE t.status = 'bitti'";
                break;
            default:
                whereClause = '';
        }

        const query = `
            SELECT 
                t.*,
                GROUP_CONCAT(DISTINCT s.id || '::' || s.title || '::' || s.completed) as subtasks
            FROM todos t
            LEFT JOIN subtasks s ON t.id = s.parent_id
            ${whereClause}
            GROUP BY t.id
            ORDER BY t.created_at DESC`;

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Liste sorgulama hatası:', err);
                reject(err);
            } else {
                rows = rows.map(row => {
                    if (row.subtasks) {
                        row.subtasks = row.subtasks.split(',').map(subtask => {
                            const [id, title, completed] = subtask.split('::');
                            return {
                                id: parseInt(id),
                                title: title,
                                completed: completed === '1'
                            };
                        });
                    } else {
                        row.subtasks = [];
                    }
                    return row;
                });
                resolve(rows);
            }
        });
    });
});

ipcMain.handle('todo:delete', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM todos WHERE id = ?', [id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Alt görev durumu güncelleme handler'ını güncelle
ipcMain.handle('subtask:toggleComplete', async (event, { id, completed }) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE subtasks SET completed = ? WHERE id = ?';
        db.run(sql, [completed ? 1 : 0, id], function(err) {
            if (err) {
                console.error('Alt görev güncelleme hatası:', err);
                reject(err);
            } else {
                console.log('Alt görev güncellendi, ID:', id);
                resolve();
            }
        });
    });
});

// Düzenleme penceresi için yeni fonksiyon
function createEditWindow(todoId) {
    const editWindow = new BrowserWindow({
        width: 600,
        height: 400,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    editWindow.loadFile('edit.html');
    editWindow.webContents.on('did-finish-load', () => {
        editWindow.webContents.send('todo:edit', todoId);
    });
}

// Görev getirme handler'ı
ipcMain.handle('todo:get', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
});

// Görev güncelleme handler'ı
ipcMain.handle('todo:update', async (event, todo) => {
    return new Promise((resolve, reject) => {
        console.log('Güncellenecek görev:', todo); // Debug için log
        
        const sql = `UPDATE todos 
                    SET title = ?, description = ?, status = ?, 
                        priority = ?, due_date = ?
                    WHERE id = ?`;
        
        const params = [
            todo.title, 
            todo.description, 
            todo.status, 
            todo.priority, 
            todo.due_date, // datetime-local input değerini direkt kullan
            todo.id
        ];
        
        console.log('SQL parametreleri:', params); // Debug için log
        
        db.run(sql, params, (err) => {
            if (err) {
                console.error('Güncelleme hatası:', err);
                reject(err);
            } else {
                // Ana pencereye güncelleme bildirimi gönder
                mainWindow.webContents.send('todo:updated');
                resolve();
            }
        });
    });
});

// Alt görev silme handler'ı
ipcMain.handle('subtask:delete', async (event, id) => {
    return new Promise((resolve, reject) => {                               
        db.run('DELETE FROM subtasks WHERE id = ?', [id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Alt görev güncelleme handler'ı
ipcMain.handle('subtask:update', async (event, { id, title }) => {
    return new Promise((resolve, reject) => {
        db.run('UPDATE subtasks SET title = ? WHERE id = ?', [title, id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Edit penceresi açma handler'ı
ipcMain.handle('window:openEdit', (event, todoId) => {
    createEditWindow(todoId);
});

// İstatistik penceresi handler'ını güncelle
ipcMain.handle('window:openStats', () => {
    const statsWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    statsWindow.loadFile('stats.html');
});

// initDB fonksiyonunu güncelle
function initDB() {
    db.serialize(() => {
        // Todos tablosunu oluştur
        db.run(`CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'bekliyor',
            priority TEXT DEFAULT 'orta',
            due_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        )`, (err) => {
            if (err) {
                console.error('Todos tablo hatası:', err);
            } else {
                // Tablo yapısını kontrol et
                db.get("PRAGMA table_info(todos)", [], (err, row) => {
                    if (err) {
                        console.error('Tablo kontrol hatası:', err);
                    } else {
                        console.log('Todos tablosu hazır');
                    }
                });
            }
        });

        // Subtasks tablosunu oluştur
        db.run(`CREATE TABLE IF NOT EXISTS subtasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error('Subtasks tablo hatası:', err);
            } else {
                console.log('Subtasks tablosu hazır');
            }
        });

        // İndeksleri oluştur
        db.run(`CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_subtasks_parent ON subtasks(parent_id)`);
    });
}

// Menü şablonunu oluştur
const menuTemplate = [
    {
        label: 'Dosya',
        submenu: [
            { label: 'Yeni Görev', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:newTask') },
            { type: 'separator' },
            { label: 'Çıkış', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
        ]
    },
    {
        label: 'Düzenle',
        submenu: [
            { label: 'Geri Al', role: 'undo' },
            { label: 'İleri Al', role: 'redo' },
            { type: 'separator' },
            { label: 'Kes', role: 'cut' },
            { label: 'Kopyala', role: 'copy' },
            { label: 'Yapıştır', role: 'paste' },
            { label: 'Tümünü Seç', role: 'selectAll' },
            { type: 'separator' },
            { 
                label: 'Geliştirici Araçları',
                accelerator: 'F12', 
                click: () => {
                    if (mainWindow.webContents.isDevToolsOpened()) {
                        mainWindow.webContents.closeDevTools();
                    } else {
                        mainWindow.webContents.openDevTools();
                    }
                }
            },
            { type: 'separator' },
            { 
                label: 'İstatistikler',
                accelerator: 'CmdOrCtrl+I',
                click: () => {
                    const statsWindow = new BrowserWindow({
                        width: 800,
                        height: 600,
                        parent: mainWindow,
                        webPreferences: {
                            nodeIntegration: true,
                            contextIsolation: false
                        }
                    });
                    statsWindow.loadFile('stats.html');
                }
            },
            { type: 'separator' },
        ]
    },
    {
        label: 'Görünüm',
        submenu: [
            { label: 'Liste Görünümü', click: () => mainWindow.loadFile('index.html') },
            { label: 'Kanban Görünümü', click: () => mainWindow.loadFile('kanban.html') },
            { type: 'separator' },
            { label: 'Yakınlaştır', role: 'zoomIn' },
            { label: 'Uzaklaştır', role: 'zoomOut' },
            { label: 'Varsayılan Boyut', role: 'resetZoom' },
            { label: 'Yenile', role: 'reload', accelerator: 'CmdOrCtrl+R' },
            { type: 'separator' },
            { label: 'Tam Ekran', role: 'togglefullscreen' }
        ]
    },
    {
        label: 'Yardım',
        submenu: [
            { 
                label: 'Hakkında',
                click: () => {
                    const aboutWindow = new BrowserWindow({
                        width: 300,
                        height: 200,
                        parent: mainWindow,
                        modal: true,
                        show: false
                    });
                    aboutWindow.loadFile('about.html');
                    aboutWindow.once('ready-to-show', () => aboutWindow.show());
                }
            }
        ]
    }
];

// İstatistik verileri için yeni IPC handler'ları
ipcMain.handle('stats:getTasksByStatus', async () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT status, COUNT(*) as count
            FROM todos
            GROUP BY status
        `;
        db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('stats:getCompletedTasksByDate', async (event, period) => {
    return new Promise((resolve, reject) => {
        let dateFilter;
        switch(period) {
            case 'daily':
                dateFilter = "datetime(completed_at) >= datetime('now', '-7 days', 'localtime')";
                break;
            case 'weekly':
                dateFilter = "datetime(completed_at) >= datetime('now', '-4 weeks', 'localtime')";
                break;
            case 'monthly':
                dateFilter = "datetime(completed_at) >= datetime('now', '-12 months', 'localtime')";
                break;
            default:
                dateFilter = "completed_at IS NOT NULL";
        }

        const query = `
            SELECT 
                date(completed_at, 'localtime') as date,
                COUNT(*) as count
            FROM todos
            WHERE status = 'bitti' AND ${dateFilter}
            GROUP BY date(completed_at, 'localtime')
            ORDER BY date(completed_at, 'localtime') DESC
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

function createWindow () {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "To-do App",
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Menüyü oluştur ve uygula
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.loadFile('index.html');
    // Otomatik DevTools açılmasını kaldırdık
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
