const { ipcRenderer } = require('electron');

let currentTodoId = null;

// Görev verilerini yükle
ipcRenderer.on('todo:edit', async (event, todoId) => {
    currentTodoId = todoId;
    const todo = await ipcRenderer.invoke('todo:get', todoId);
    
    document.getElementById('todoId').value = todo.id;
    document.getElementById('title').value = todo.title;
    document.getElementById('description').value = todo.description || '';
    document.getElementById('status').value = todo.status;
    document.getElementById('priority').value = todo.priority;
    document.getElementById('dueDate').value = todo.due_date || '';
});

// Form gönderimi
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updatedTodo = {
        id: currentTodoId,
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        status: document.getElementById('status').value,
        priority: document.getElementById('priority').value,
        dueDate: document.getElementById('dueDate').value
    };

    try {
        await ipcRenderer.invoke('todo:update', updatedTodo);
        window.close();
    } catch (error) {
        console.error('Güncelleme hatası:', error);
        alert('Güncelleme sırasında bir hata oluştu');
    }
});
