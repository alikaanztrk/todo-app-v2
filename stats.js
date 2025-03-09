const { ipcRenderer } = require('electron');

let statusChart = null;
let completedChart = null;

async function loadStatusChart() {
    try {
        const data = await ipcRenderer.invoke('stats:getTasksByStatus');
        
        const ctx = document.getElementById('statusChart').getContext('2d');
        if (statusChart) statusChart.destroy();
        
        statusChart = new Chart(ctx, {
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
        if (completedChart) completedChart.destroy();
        
        completedChart = new Chart(ctx, {
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
                    },
                    title: {
                        display: true,
                        text: 'Tamamlanan Görevler Grafiği'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Tamamlanan görev istatistikleri yüklenirken hata:', error);
    }
}

// Sayfa yüklendiğinde grafikleri göster
document.addEventListener('DOMContentLoaded', () => {
    loadStatusChart();
    loadCompletedTasks('daily');
});
