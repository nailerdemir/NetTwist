let rules = [];
let ruleId = 1;
let lastRuleStatus = {}; // Son kural durumlarını takip etmek için

// Uygulama başlangıcında kuralları yükle
function initializeRules() {
    chrome.storage.local.get(['rules', 'ruleId'], function(result) {
        if (result.rules) {
            rules = result.rules;
            ruleId = Math.max(...rules.map(r => r.id || 0), 1) + 1;
            
            // Sadece aktif kuralları uygula
            const activeRules = rules
                .filter(rule => rule.active !== false)
                .map(rule => {
                    // API'ye gönderilecek kural kopyası
                    const apiRule = {...rule};
                    delete apiRule.active; // active özelliğini kaldır
                    return apiRule;
                });
            
            if (activeRules.length > 0) {
                // Önce tüm kuralları temizle
                chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
                }).then(() => {
                    // Sonra aktif kuralları ekle
                    return chrome.declarativeNetRequest.updateDynamicRules({
                        addRules: activeRules
                    });
                }).then(() => {
                    console.log('Kurallar başarıyla uygulandı:', activeRules);
                    // Kural durumlarını güncelle
                    activeRules.forEach(rule => {
                        lastRuleStatus[rule.id] = {
                            active: true,
                            lastChecked: new Date().toISOString(),
                            success: true
                        };
                    });
                    // Durumları kaydet
                    chrome.storage.local.set({ ruleStatus: lastRuleStatus });
                }).catch(error => {
                    console.error('Kurallar uygulanırken hata oluştu:', error);
                });
            }
        }
        
    });
}

// Uygulama başlangıcında çalıştır
initializeRules();

// Kural eşleşmelerini dinle
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
    function(info) {
        console.log('Kural eşleşti:', info);
        // Eşleşen kuralın durumunu güncelle
        if (info.rule && info.rule.ruleId) {
            lastRuleStatus[info.rule.ruleId] = {
                active: true,
                lastChecked: new Date().toISOString(),
                lastMatched: new Date().toISOString(),
                success: true,
                request: {
                    url: info.request.url,
                    method: info.request.method
                }
            };
            // Durumları kaydet
            chrome.storage.local.set({ ruleStatus: lastRuleStatus });
            
            // Popup'a mesaj göndermeyi dene, ama hata kontrolü yap
            chrome.runtime.sendMessage({
                type: 'RULE_MATCHED',
                ruleId: info.rule.ruleId
            }).catch(() => {
                // Popup açık değilse hata oluşacak, bu normal
                // Sessizce devam et
            });
        }
    }
);

// Sayfa yüklenme olaylarını dinle
chrome.webNavigation.onCompleted.addListener(function(details) {
    // Ana çerçeve yüklendiğinde
    if (details.frameId === 0) {
        // Tüm kuralları kontrol et ve son kontrol zamanını güncelle
        chrome.storage.local.get(['rules'], function(result) {
            if (result.rules && result.rules.length > 0) {
                const now = new Date().toISOString();
                
                // Her kural için son kontrol zamanını güncelle
                result.rules.forEach(rule => {
                    if (!lastRuleStatus[rule.id]) {
                        lastRuleStatus[rule.id] = {
                            active: rule.active !== false,
                            lastChecked: now
                        };
                    } else {
                        lastRuleStatus[rule.id].lastChecked = now;
                    }
                });
                
                // Durumları kaydet
                chrome.storage.local.set({ ruleStatus: lastRuleStatus });
                
                // Popup'a durum güncellemesi gönder
                chrome.runtime.sendMessage({
                    type: 'PAGE_LOADED',
                    url: details.url,
                    timestamp: now
                }).catch(err => console.log('Popup açık değil, mesaj gönderilemedi'));
            }
        });
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'TOGGLE_RULE') {
        toggleRule(request.ruleId, request.active, sendResponse);
        return true;
    }
    
    if (request.type === 'DELETE_RULE') {
        deleteRule(request.ruleId, sendResponse);
        return true;
    }
    
    if (request.type === 'UPDATE_SETTINGS') {
        updateSettings(request, sendResponse);
        return true;
    }
    
    if (request.type === 'CLEAR_ALL_RULES') {
        clearAllRules(sendResponse);
        return true;
    }
    
    // CHECK_LICENSE mesaj işleyicisini kaldıralım
    /*
    if (request.type === 'CHECK_LICENSE') {
        checkLicense().then(() => {
            sendResponse({ status: 'success' });
        }).catch(error => {
            sendResponse({ status: 'error', message: error.message });
        });
        return true;
    }
    */
});

function toggleRule(ruleId, isActive, sendResponse) {
    chrome.storage.local.get(['rules'], function(result) {
        if (!result.rules) return;
        
        const targetRule = result.rules.find(r => r.id === ruleId);
        if (!targetRule) return;
        
        // Kuralı güncelle
        if (isActive) {
            // API'ye göndermeden önce active özelliğini kaldır
            const apiRule = {...targetRule};
            delete apiRule.active;
            
            // Kuralı etkinleştir
            chrome.declarativeNetRequest.updateDynamicRules({
                addRules: [apiRule]
            }).then(() => {
                sendResponse({ status: 'success' });
            }).catch(error => {
                console.error('Kural etkinleştirilemedi:', error);
                sendResponse({ status: 'error', message: error.message });
            });
        } else {
            // Kuralı devre dışı bırak
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [ruleId]
            }).then(() => {
                sendResponse({ status: 'success' });
            }).catch(error => {
                console.error('Kural devre dışı bırakılamadı:', error);
                sendResponse({ status: 'error', message: error.message });
            });
        }
    });
}

// Kural silme fonksiyonu
function deleteRule(ruleId, sendResponse) {
    // Önce dinamik kuralı kaldır
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId]
    }).then(() => {
        // Sonra storage'dan kuralı ve durum bilgisini al
        return chrome.storage.local.get(['rules', 'ruleStatus']);
    }).then((result) => {
        // Kuralı filtrele
        const updatedRules = (result.rules || []).filter(r => r.id !== ruleId);
        
        // Durum bilgisini de güncelle
        const ruleStatus = result.ruleStatus || {};
        if (ruleStatus[ruleId]) {
            delete ruleStatus[ruleId];
        }
        
        // Global rules değişkenini de güncelle
        rules = updatedRules;
        
        // Storage'ı güncelle
        return chrome.storage.local.set({ 
            rules: updatedRules,
            ruleStatus: ruleStatus
        });
    }).then(() => {
        console.log(`Kural #${ruleId} başarıyla silindi.`);
        sendResponse({ status: 'success' });
    }).catch(error => {
        console.error('Kural silme hatası:', error);
        sendResponse({ status: 'error', message: error.message });
    });
}

// Ayarları güncelleme fonksiyonu
function updateSettings(request, sendResponse) {
    // Önce tüm kuralları temizle
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
    }).then(() => {
        const newRule = {
            id: ruleId,
            priority: 1,
            condition: {
                // Eşleşme tipine göre urlFilter'ı ayarla
                urlFilter: request.matchType === 'exact' ? 
                    request.endpoint : // Tam eşleşme için
                    '*' + request.endpoint + '*', // İçeren eşleşme için
                resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
            }
            // 'active' özelliğini kaldırdık - API bunu kabul etmiyor
        };

        switch(request.requestType) {
            case 'block':
                newRule.action = { type: 'block' };
                break;
                
            case 'redirect':
                // URL formatını düzelt
                let redirectUrl = request.redirectUrl;
                if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
                    redirectUrl = 'https://' + redirectUrl;
                }
                newRule.action = {
                    type: 'redirect',
                    redirect: { url: redirectUrl }
                };
                break;
                
            case 'modify':
                const jsonResponse = request.customResponse || '{}';
                const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonResponse);
                newRule.action = {
                    type: 'redirect',
                    redirect: { url: dataUrl }
                };
                break;
        }

        ruleId++;
        
        // Kuralı rules listesine eklerken active özelliğini ekleyebiliriz
        // (storage için kullanılacak, API'ye gönderilmeyecek)
        const ruleForStorage = {...newRule, active: true};
        rules.push(ruleForStorage);
        
        // Sadece aktif kuralları uygula, API'ye göndermeden önce active özelliğini kaldır
        const activeRules = rules
            .filter(rule => rule.active !== false)
            .map(rule => {
                // API'ye gönderilecek kural kopyası
                const apiRule = {...rule};
                delete apiRule.active; // active özelliğini kaldır
                return apiRule;
            });

        return chrome.declarativeNetRequest.updateDynamicRules({
            addRules: activeRules
        }).then(() => {
            console.log('Yeni kural eklendi:', newRule);
            // Kural durumunu başlat
            lastRuleStatus[newRule.id] = {
                active: true,
                created: new Date().toISOString(),
                success: null // Henüz test edilmedi
            };
            return chrome.storage.local.set({ 
                rules: rules,
                ruleId: ruleId,
                ruleStatus: lastRuleStatus
            });
        });
    }).then(() => {
        sendResponse({ status: 'success', rule: rules[rules.length - 1] });
    }).catch(error => {
        console.error('Rule update failed:', error);
        sendResponse({ status: 'error', message: error.message });
    });
}

// Tüm kuralları temizleme fonksiyonu
function clearAllRules(sendResponse) {
    // Tüm olası rule ID'lerini içeren daha geniş bir aralık kullan
    const allPossibleRuleIds = Array.from({length: 1000}, (_, i) => i + 1);
    
    // Önce tüm dinamik kuralları temizle
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: allPossibleRuleIds
    }).then(() => {
        // Sonra storage'daki kuralları ve durum bilgilerini temizle
        return chrome.storage.local.clear(); // Tüm storage'ı temizle
    }).then(() => {
        // Temel değerleri yeniden ayarla
        return chrome.storage.local.set({ 
            rules: [],
            ruleStatus: {},
            ruleId: 1
        });
    }).then(() => {
        // Global değişkenleri sıfırla
        rules = [];
        ruleId = 1;
        lastRuleStatus = {};
        
        // Eklentiyi yeniden yüklemek için bir mesaj gönder
        chrome.runtime.reload();
        
        sendResponse({ status: 'success' });
    }).catch(error => {
        console.error('Kurallar temizlenirken hata oluştu:', error);
        sendResponse({ status: 'error', message: error.message });
    });
}

// Kısıtlı mod ayarlarını uygula
function applyLimitedMode() {
    // Örneğin, maksimum kural sayısını 3 ile sınırla
    chrome.storage.local.get(['rules'], function(result) {
        if (result.rules && result.rules.length > 3) {
            // Sadece ilk 3 kuralı etkinleştir
            const limitedRules = result.rules.slice(0, 3);
            chrome.storage.local.set({ rules: limitedRules });
            
            // Dinamik kuralları güncelle
            const activeRules = limitedRules
                .filter(rule => rule.active !== false)
                .map(rule => {
                    const apiRule = {...rule};
                    delete apiRule.active;
                    return apiRule;
                });
                
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
            }).then(() => {
                return chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: activeRules
                });
            }).then(() => {
                console.log('Kısıtlı mod kuralları uygulandı:', activeRules);
                // Global rules değişkenini güncelle
                rules = limitedRules;
            }).catch(error => {
                console.error('Kısıtlı mod kuralları uygulanırken hata oluştu:', error);
            });
        }
    });
}

// Tam sürüm ayarlarını uygula
function applyFullVersion() {
    // Tam sürüm için ek ayarlar (gerekirse)
    console.log('Tam sürüm etkinleştirildi. Tüm özellikler kullanılabilir.');
}