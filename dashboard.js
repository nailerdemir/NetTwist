document.addEventListener('DOMContentLoaded', function() {
    const requestType = document.getElementById('requestType');
    const responseSettings = document.getElementById('responseSettings');
    const redirectSettings = document.getElementById('redirectSettings');
    const activeRules = document.getElementById('activeRules');
    const customResponse = document.getElementById('customResponse');
    const endpoint = document.getElementById('endpoint');
    
    activeRules.innerHTML = '';
    loadActiveRules();
    
    function setupEndpointMatchingOptions() {
        const endpointValue = endpoint.value;
        const endpointParent = endpoint.parentNode;
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const matchTypeSelect = document.createElement('select');
        matchTypeSelect.className = 'form-select flex-shrink-1';
        matchTypeSelect.id = 'matchType';
        matchTypeSelect.style.maxWidth = '150px';
        
        const exactOption = document.createElement('option');
        exactOption.value = 'exact';
        exactOption.textContent = 'Tam Eşleşme';
        
        const containsOption = document.createElement('option');
        containsOption.value = 'contains';
        containsOption.textContent = 'İçeren';
        
        matchTypeSelect.appendChild(exactOption);
        matchTypeSelect.appendChild(containsOption);
        
        endpoint.parentNode.removeChild(endpoint);
        inputGroup.appendChild(matchTypeSelect);
        inputGroup.appendChild(endpoint);
        
        endpointParent.appendChild(inputGroup);
        
        endpoint.value = endpointValue;
    }
    
    setupEndpointMatchingOptions();

    function isValidJSON(str) {
        if (!str || str.trim() === '') return true;
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    function isValidEndpoint(str) {
        if (!str || str.trim() === '') return false;
        
        const simplePattern = /^[\w-]+$/i;
        
        const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+|localhost)(:\d+)?(\/[\w-\/\._~:?#\[\]@!\$&'\(\)\*\+,;=]*)?$/i;
        const endpointPattern = /^(\/)?[\w-\/\._~:?#\[\]@!\$&'\(\)\*\+,;=]+$/i;
        
        return simplePattern.test(str.trim()) || urlPattern.test(str.trim()) || endpointPattern.test(str.trim());
    }

    function validateEndpoint() {
        const endpointValue = endpoint.value;
        const feedbackElement = document.getElementById('endpointFeedback') || 
                               createFeedbackElement('endpointFeedback', endpoint);
        
        if (endpointValue.trim() === '') {
            endpoint.classList.remove('is-valid');
            endpoint.classList.add('is-invalid');
            feedbackElement.classList.remove('valid-feedback');
            feedbackElement.classList.add('invalid-feedback');
            feedbackElement.textContent = 'Endpoint boş olamaz';
            return false;
        } else if (!isValidEndpoint(endpointValue)) {
            endpoint.classList.remove('is-valid');
            endpoint.classList.add('is-invalid');
            feedbackElement.classList.remove('valid-feedback');
            feedbackElement.classList.add('invalid-feedback');
            feedbackElement.textContent = 'Geçersiz endpoint formatı';
            return false;
        } else {
            endpoint.classList.remove('is-invalid');
            endpoint.classList.add('is-valid');
            feedbackElement.classList.remove('invalid-feedback');
            feedbackElement.classList.add('valid-feedback');
            feedbackElement.textContent = 'Geçerli endpoint';
            return true;
        }
    }

    customResponse.addEventListener('input', function() {
        validateJSON();
    });

    function validateJSON() {
        const jsonValue = customResponse.value;
        const feedbackElement = document.getElementById('jsonFeedback') || 
                               createFeedbackElement('jsonFeedback', customResponse);
        
        if (isValidJSON(jsonValue)) {
            customResponse.classList.remove('is-invalid');
            customResponse.classList.add('is-valid');
            feedbackElement.classList.remove('invalid-feedback');
            feedbackElement.classList.add('valid-feedback');
            feedbackElement.textContent = 'Geçerli JSON formatı';
        } else {
            customResponse.classList.remove('is-valid');
            customResponse.classList.add('is-invalid');
            feedbackElement.classList.remove('valid-feedback');
            feedbackElement.classList.add('invalid-feedback');
            feedbackElement.textContent = 'Geçersiz JSON formatı';
        }
    }

    endpoint.addEventListener('input', function() {
        validateEndpoint();
    });

    function createFeedbackElement(id, targetElement) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = id;
        feedbackDiv.className = 'invalid-feedback';
        targetElement.parentNode.appendChild(feedbackDiv);
        return feedbackDiv;
    }

    function loadActiveRules() {
        chrome.storage.local.get(['rules'], function(result) {
            if (result.rules && result.rules.length > 0) {
                result.rules.forEach(rule => {
                    updateActiveRules(rule);
                });
            }
        });
    }

    requestType.addEventListener('change', function() {
        if (this.value === 'redirect') {
            responseSettings.style.display = 'none';
            redirectSettings.style.display = 'block';
        } else if (this.value === 'block') {
            responseSettings.style.display = 'none';
            redirectSettings.style.display = 'none';
        } else {
            responseSettings.style.display = 'block';
            redirectSettings.style.display = 'none';
        }
    });

    document.getElementById('requestForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const endpointValue = endpoint.value.trim();
        const jsonValue = customResponse.value;
        let isValid = true;
        
        if (!isValidEndpoint(endpointValue)) {
            validateEndpoint();
            isValid = false;
        }
        
        if (requestType.value === 'modify' && !isValidJSON(jsonValue)) {
            validateJSON();
            isValid = false;
        }
        
        if (!isValid) {
            return;
        }
        
        const formData = {
            type: 'UPDATE_SETTINGS',
            requestType: requestType.value,
            endpoint: endpointValue,
            matchType: document.getElementById('matchType').value,
            responseCode: document.getElementById('responseCode').value,
            customResponse: jsonValue,
            redirectUrl: document.getElementById('redirectUrl').value
        };

        chrome.runtime.sendMessage(formData, function(response) {
            if (response && response.status === 'success') {
                e.target.reset();
                
                endpoint.classList.remove('is-valid', 'is-invalid');
                customResponse.classList.remove('is-valid', 'is-invalid');
                
                activeRules.innerHTML = '';
                loadActiveRules();
                
                alert('Ayarlar başarıyla kaydedildi!');
            } else {
                alert('Bir hata oluştu: ' + (response ? response.message : 'Bilinmeyen hata'));
            }
        });
    });
    
    function showNotification(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.querySelector('.container').prepend(alertDiv);
        
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }
    
    function clearAllRules() {
        chrome.runtime.sendMessage({
            type: 'CLEAR_ALL_RULES'
        }, function(response) {
            if (response && response.status === 'success') {
                activeRules.innerHTML = '';
                showNotification('Tüm kurallar başarıyla temizlendi.', 'success');
            } else {
                showNotification('Kurallar temizlenirken bir hata oluştu.', 'error');
            }
        });
    }

    const clearButton = document.createElement('button');
    clearButton.className = 'btn btn-outline-danger mt-3 me-2';
    clearButton.textContent = 'Tüm Kuralları Temizle';
    clearButton.onclick = function() {
        if (confirm('Tüm kuralları silmek istediğinizden emin misiniz?')) {
            clearAllRules();
        }
    };
    
    const reloadButton = document.createElement('button');
    reloadButton.className = 'btn btn-outline-warning mt-3';
    reloadButton.textContent = 'Eklentiyi Yeniden Başlat';
    reloadButton.onclick = function() {
        if (confirm('Eklentiyi yeniden başlatmak istediğinizden emin misiniz?')) {
            chrome.runtime.reload();
        }
    };
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'd-flex';
    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(reloadButton);
    document.querySelector('.card:nth-child(2) .card-body').appendChild(buttonContainer);

    function updateActiveRules(rule) {
        if (!rule || !rule.condition) return;
    
        const ruleElement = document.createElement('div');
        ruleElement.className = 'alert alert-info d-flex justify-content-between align-items-center';
        ruleElement.setAttribute('data-rule-id', rule.id);
        
        const contentDiv = document.createElement('div');
        contentDiv.style.flex = '1';
        
        let ruleType = '';
        let details = '';
        let badgeClass = '';
        let endpoint = '';
        let statusIndicator = '';
        
        try {
            endpoint = rule.condition.urlFilter.replace(/\*/g, '');
    
            chrome.storage.local.get(['ruleStatus'], function(result) {
                const ruleStatus = result.ruleStatus || {};
                const status = ruleStatus[rule.id] || {};
                
                if (status.lastMatched) {
                    statusIndicator = '<span class="badge bg-success ms-2">Çalışıyor</span>';
                } else if (status.success === false) {
                    statusIndicator = '<span class="badge bg-danger ms-2">Hata</span>';
                } else {
                    statusIndicator = '<span class="badge bg-secondary ms-2">Beklemede</span>';
                }
                
                updateRuleContent();
            });
    
            if (rule.action) {
                if (rule.action.type === 'block') {
                    ruleType = 'Engelleme';
                    badgeClass = 'bg-danger';
                } else if (rule.action.type === 'redirect') {
                    if (rule.action.redirect.url.startsWith('data:')) {
                        ruleType = 'Yanıt Değiştirme';
                        badgeClass = 'bg-info';
                        details = `<strong>Özel Yanıt:</strong> ${decodeURIComponent(rule.action.redirect.url.split(',')[1])}`;
                    } else {
                        ruleType = 'Yönlendirme';
                        badgeClass = 'bg-warning';
                        details = `<strong>Hedef URL:</strong> ${rule.action.redirect.url}`;
                    }
                }
            }
        
            function updateRuleContent() {
                contentDiv.innerHTML = `
                    <div class="rule-content">
                        <div class="d-flex align-items-center">
                            <div class="rule-endpoint">
                                <strong>Endpoint:</strong> ${endpoint}
                            </div>
                            ${statusIndicator}
                        </div>
                        <span class="badge ${badgeClass} rule-type-badge">${ruleType || 'Bilinmeyen'}</span>
                    </div>
                    ${details ? `<div class="text-muted small mt-1">${details}</div>` : ''}
                `;
            }
            
            updateRuleContent();
            
        } catch (error) {
            console.error('Error updating active rules:', error);
            contentDiv.innerHTML = '<div class="text-danger">Kural görüntülenirken hata oluştu</div>';
        }
    
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger btn-sm ms-3';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = 'Kuralı Sil';
        deleteButton.onclick = function() {
            if (confirm('Bu kuralı silmek istediğinizden emin misiniz?')) {
                chrome.runtime.sendMessage({
                    type: 'DELETE_RULE',
                    ruleId: rule.id
                }, function(response) {
                    if (response && response.status === 'success') {
                        ruleElement.remove();
                        
                        if (activeRules.children.length === 0) {
                            const emptyState = document.createElement('div');
                            emptyState.className = 'text-center text-muted p-4';
                            emptyState.innerHTML = '<i class="fas fa-info-circle mb-2 d-block" style="font-size: 2rem;"></i>Henüz kural eklenmemiş';
                            activeRules.appendChild(emptyState);
                        }
                        
                        showNotification('Kural başarıyla silindi.', 'success');
                    } else {
                        showNotification('Kural silinirken bir hata oluştu.', 'error');
                    }
                });
            }
        };
    
        ruleElement.appendChild(contentDiv);
        ruleElement.appendChild(deleteButton);
        activeRules.appendChild(ruleElement);
    }
});