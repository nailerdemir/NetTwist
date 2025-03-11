document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['endpoint', 'responseCode'], function(result) {
        if (result.endpoint) {
            document.getElementById('endpoint').value = result.endpoint;
        }
        if (result.responseCode) {
            document.getElementById('responseCode').value = result.responseCode;
        }
    });

    document.getElementById('responseModifierForm').addEventListener('submit', function(event) {
        event.preventDefault();
        
        const endpoint = document.getElementById('endpoint').value;
        const responseCode = document.getElementById('responseCode').value;
        
        chrome.storage.local.set({
            endpoint: endpoint,
            responseCode: responseCode
        }, function() {
            const status = document.getElementById('status');
            status.textContent = 'Ayarlar kaydedildi!';
            status.style.color = 'green';
            
            chrome.runtime.sendMessage({ 
                type: 'UPDATE_SETTINGS',
                endpoint: endpoint, 
                responseCode: responseCode 
            }, function(response) {
                console.log('Background yanıtı:', response);
            });
        });
    });
});