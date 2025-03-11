document.addEventListener('DOMContentLoaded', function() {
    // Aktif kural sayısını göster
    loadRules();
    
    // Dashboard butonuna tıklama olayı
    document.getElementById('openDashboard').addEventListener('click', function() {
        chrome.tabs.create({url: 'dashboard.html'});
        window.close(); // Popup'ı kapat
    });
});

function loadRules() {
    chrome.storage.local.get(['rules', 'ruleStatus'], function(result) {
        const rulesList = document.getElementById('rulesList');
        
        if (!result.rules || result.rules.length === 0) {
            rulesList.innerHTML = `
                <div class="no-rules fade-in">
                    <i class="fas fa-info-circle d-block"></i>
                    <p>Henüz kural eklenmemiş</p>
                </div>
            `;
            return;
        }
        
        // Kuralları temizle
        rulesList.innerHTML = '';
        
        // Aktif kuralları göster
        const activeRules = result.rules;
        
        activeRules.forEach(rule => {
            const ruleStatus = result.ruleStatus && result.ruleStatus[rule.id];
            const lastMatched = ruleStatus && ruleStatus.lastMatched;
            const lastChecked = ruleStatus && ruleStatus.lastChecked;
            
            // Kural tipine göre badge sınıfı
            let badgeClass = '';
            let badgeText = '';
            
            switch(rule.action.type) {
                case 'block':
                    badgeClass = 'bg-danger';
                    badgeText = 'Engelle';
                    break;
                case 'redirect':
                    if (rule.action.redirect && rule.action.redirect.url.startsWith('data:')) {
                        badgeClass = 'bg-info';
                        badgeText = 'Yanıt Değiştirme';
                    } else {
                        badgeClass = 'bg-warning';
                        badgeText = 'Yönlendirme';
                    }
                    break;
                default:
                    badgeClass = 'bg-secondary';
                    badgeText = 'Diğer';
            }
            
            // Endpoint URL'ini kısalt
            let endpoint = rule.condition.urlFilter;
            if (endpoint.startsWith('*') && endpoint.endsWith('*')) {
                endpoint = endpoint.substring(1, endpoint.length - 1);
            }
            
            // Kuralın çalışıp çalışmadığını kontrol et
            let isActive = lastMatched ? true : false;
            
            const ruleElement = document.createElement('div');
            ruleElement.className = 'rule-item fade-in';
            ruleElement.innerHTML = `
                <div class="rule-title">
                    <span><span class="badge ${badgeClass}">${badgeText}</span></span>
                    <div class="form-check form-switch">
                        <input class="form-check-input toggle-rule" type="checkbox" 
                               id="rule-${rule.id}" data-rule-id="${rule.id}" 
                               ${rule.active !== false ? 'checked' : ''}>
                    </div>
                </div>
                <div class="rule-endpoint">${endpoint}</div>
                <div class="rule-status">
                    <span class="status-indicator ${isActive ? 'status-active' : ''}"></span>
                    <span>${isActive ? 'Çalışıyor' : 'Bekleniyor'}</span>
                    ${lastMatched ? `<span class="ms-auto text-muted">${formatTimeAgo(new Date(lastMatched))}</span>` : ''}
                </div>
            `;
            
            rulesList.appendChild(ruleElement);
        });
        
        // Toggle butonlarına olay dinleyicileri ekle
        document.querySelectorAll('.toggle-rule').forEach(toggle => {
            toggle.addEventListener('change', function() {
                const ruleId = parseInt(this.dataset.ruleId);
                const isActive = this.checked;
                
                // Background'a mesaj gönder
                chrome.runtime.sendMessage({
                    type: 'TOGGLE_RULE',
                    ruleId: ruleId,
                    active: isActive
                }, function(response) {
                    if (response && response.status === 'success') {
                        // Başarılı olduğunda storage'ı güncelle
                        chrome.storage.local.get(['rules'], function(result) {
                            if (result.rules) {
                                const updatedRules = result.rules.map(r => {
                                    if (r.id === ruleId) {
                                        return { ...r, active: isActive };
                                    }
                                    return r;
                                });
                                
                                chrome.storage.local.set({ rules: updatedRules });
                            }
                        });
                    } else {
                        console.error('Kural durumu değiştirilemedi:', response);
                        // Başarısız olduğunda toggle'ı eski haline getir
                        toggle.checked = !isActive;
                    }
                });
            });
        });
    });
}

// Zaman farkını formatlama fonksiyonu
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec} sn önce`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa önce`;
    return `${Math.floor(diffSec / 86400)} gün önce`;
}

// Background'dan gelen mesajları dinle
chrome.runtime.onMessage.addListener(function(message) {
    if (message.type === 'RULE_MATCHED') {
        // Kuralları yeniden yükle
        loadRules();
    }
});