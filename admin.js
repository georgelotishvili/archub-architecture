// ადმინ პანელის ფუნქციონალი
let projectsCards = [];

// ქარდების შენახვა localStorage-ში
function saveCardsToStorage() {
    try {
        console.log('Saving cards to localStorage:', projectsCards);
        const cardsData = JSON.stringify(projectsCards);
        
        // შეინახოს localStorage-ში
        localStorage.setItem('adminCards', cardsData);
        console.log('Cards saved successfully to localStorage');
        
        // ალტერნატივად sessionStorage-შიც
        try {
            sessionStorage.setItem('adminCards', cardsData);
            console.log('Cards also saved to sessionStorage');
        } catch (sessionError) {
            console.warn('sessionStorage save failed:', sessionError);
        }
        
        // შეტყობინება სხვა ტაბებისთვის
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'adminCards',
            newValue: cardsData
        }));
        console.log('Storage event dispatched');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        
        // თუ localStorage სრულია, სცადოს გასუფთავება
        if (error.message.includes('quota') || error.message.includes('exceeded')) {
            console.log('localStorage quota exceeded, attempting cleanup...');
            clearOldCards();
            
            // კვლავ სცადოს შენახვა
            try {
                localStorage.setItem('adminCards', JSON.stringify(projectsCards));
                console.log('Cards saved after cleanup');
                alert('ქარდი დაემატა! localStorage გასუფთავდა.');
            } catch (retryError) {
                console.error('Still failed after cleanup:', retryError);
                alert('localStorage სრულია. გთხოვთ გასუფთავოთ ბრაუზერის მონაცემები.');
            }
        } else {
            alert('შეცდომა localStorage-ში შენახვისას: ' + error.message);
        }
    }
}

// ქარდების ჩატვირთვა localStorage-იდან
function loadCardsFromStorage() {
    try {
        console.log('Loading cards from storage...');
        let savedCards = localStorage.getItem('adminCards');
        
        // თუ localStorage-ში არ არის, სცადოს sessionStorage-ში
        if (!savedCards) {
            console.log('No cards in localStorage, checking sessionStorage...');
            try {
                savedCards = sessionStorage.getItem('adminCards');
                if (savedCards) {
                    console.log('Found cards in sessionStorage');
                }
            } catch (sessionError) {
                console.warn('sessionStorage access failed:', sessionError);
            }
        }
        
        console.log('Raw saved cards:', savedCards);
        
        if (savedCards) {
            projectsCards = JSON.parse(savedCards);
            console.log('Parsed cards from storage:', projectsCards);
        } else {
            console.log('No saved cards found, creating random cards');
            // თუ არ არის შენახული ქარდები, შევქმნათ ნიმუშები
            createRandomCards();
        }
    } catch (error) {
        console.error('Error loading from storage:', error);
        console.log('Creating random cards as fallback');
        createRandomCards();
    }
}

// მთავარი ფუნქცია
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin page loaded');
    
    // ინიციალიზაცია
    loadCardsFromStorage();
    loadCardsList();
    
    // Event listeners
    const addCardBtn = document.getElementById('addCardBtn');
    console.log('addCardBtn found:', addCardBtn);
    
    if (addCardBtn) {
        // Remove any existing listeners first
        const newBtn = addCardBtn.cloneNode(true);
        addCardBtn.parentNode.replaceChild(newBtn, addCardBtn);
        
        // Add fresh event listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Button clicked, calling addNewCard');
            
            // Debug: Check form values
            const areaValue = document.getElementById('cardArea').value;
            const imageFiles = document.getElementById('cardImage').files;
            console.log('Form values - Area:', areaValue, 'Image files:', imageFiles.length);
            
            addNewCard();
        });
        
        console.log('Event listener added to button successfully');
    } else {
        console.log('Button not found!');
    }
});

// ქარდების შექმნა
function createRandomCards() {
    const sampleCards = [
        { area: '120 კვ.მ', image: 'photos/pro 1.png' },
        { area: '150 კვ.მ', image: 'photos/pro 2.jpg' },
        { area: '90 კვ.მ', image: 'photos/pro 3.png' },
        { area: '200 კვ.მ', image: 'photos/pro 4.jpg' },
        { area: '180 კვ.მ', image: 'photos/pro 5.jpg' }
    ];
    
    projectsCards = sampleCards.map((card, index) => ({
        id: `card-${index}`,
        area: card.area,
        image: card.image,
        link: `card-detail.html?id=card-${index}`,
        photos: [{
            url: card.image,
            title: 'მთავარი ფოტო'
        }]
    }));
}

// ახალი ქარდის დამატება
function addNewCard() {
    console.log('addNewCard function called');
    
    try {
        // ღილაკის დაბლოკვა რომ ორჯერ არ გამოიძახოს
        const addCardBtn = document.getElementById('addCardBtn');
        console.log('addCardBtn:', addCardBtn);
        
        if (addCardBtn && addCardBtn.disabled) {
            console.log('Button is disabled, returning');
            return;
        }
        
        const imageInput = document.getElementById('cardImage');
        const areaInput = document.getElementById('cardArea');
        
        console.log('imageInput:', imageInput);
        console.log('areaInput:', areaInput);
        
        if (!imageInput || !areaInput) {
            console.log('Inputs not found, returning');
            alert('შეცდომა: ფორმის ელემენტები არ მოიძებნა!');
            return;
        }
        
        const area = areaInput.value.trim();
        console.log('area:', area);
        
        if (!area) {
            alert('შეავსეთ ფართობის ველი!');
            return;
        }
        
        if (!imageInput.files || !imageInput.files[0]) {
            console.log('No file selected');
            alert('აირჩიეთ ფოტო!');
            return;
        }
        
        console.log('File selected:', imageInput.files[0]);
        
        // ღილაკის დაბლოკვა
        if (addCardBtn) {
            addCardBtn.disabled = true;
            addCardBtn.textContent = 'მიმდინარეობს...';
        }
        
        const mainFile = imageInput.files[0];
        const additionalFilesInput = document.getElementById('cardPhotos');
        const additionalFiles = additionalFilesInput ? additionalFilesInput.files : [];
        
        // ყველა ფოტოს ატვირთვა
        const allFiles = [mainFile];
        for (let i = 0; i < additionalFiles.length; i++) {
            allFiles.push(additionalFiles[i]);
        }
        
        let processedFiles = 0;
        const photos = [];
        
        allFiles.forEach((file, index) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                photos.push({
                    url: e.target.result,
                    title: index === 0 ? 'მთავარი ფოტო' : `ფოტო ${index + 1}`
                });
                
                processedFiles++;
                
                // ყველა ფაილი დამუშავდა
                if (processedFiles === allFiles.length) {
                    console.log('All files processed');
                    
                    const newCard = {
                        id: `card-${Date.now()}`,
                        area: area,
                        image: photos[0].url, // მთავარი ფოტო
                        link: `card-detail.html?id=card-${Date.now()}`,
                        photos: photos
                    };
                    
                    console.log('New card:', newCard);
                    projectsCards.push(newCard);
                    console.log('Updated projectsCards:', projectsCards);
                    
                    saveCardsToStorage(); // შენახვა localStorage-ში
                    loadCardsList();
                    clearForm([imageInput, areaInput, additionalFilesInput]);
                    alert('ქარდი წარმატებით დაემატა!');
                    
                    // ღილაკის განბლოკვა
                    if (addCardBtn) {
                        addCardBtn.disabled = false;
                        addCardBtn.textContent = 'ქარდის დამატება';
                    }
                }
            };
            
            reader.onerror = function() {
                console.error('Error reading file:', file);
                alert('ფაილის წაკითხვის შეცდომა!');
                if (addCardBtn) {
                    addCardBtn.disabled = false;
                    addCardBtn.textContent = 'ქარდის დამატება';
                }
            };
            
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error('Error in addNewCard:', error);
        alert('შეცდომა ქარდის დამატებისას: ' + error.message);
        
        const addCardBtn = document.getElementById('addCardBtn');
        if (addCardBtn) {
            addCardBtn.disabled = false;
            addCardBtn.textContent = 'ქარდის დამატება';
        }
    }
}

// addNewCard ფუნქციის window-ზე დამატება onclick-ისთვის
window.addNewCard = addNewCard;

// ძველი ქარდების გასუფთავება localStorage-იდან
function clearOldCards() {
    try {
        console.log('Clearing old cards to free up space...');
        
        // მხოლოდ ბოლო 5 ქარდი დატოვოს
        if (projectsCards.length > 5) {
            projectsCards = projectsCards.slice(-5); // ბოლო 5 ქარდი
            console.log('Kept only last 5 cards:', projectsCards);
        }
        
        // localStorage-ის გასუფთავება
        localStorage.removeItem('adminCards');
        console.log('Cleared localStorage adminCards');
        
        // sessionStorage-ის გასუფთავება
        sessionStorage.removeItem('adminCards');
        console.log('Cleared sessionStorage adminCards');
        
        // სხვა localStorage keys-ების შემოწმება
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('admin') || key.includes('card')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('Removed key:', key);
        });
        
        console.log('Cleanup completed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}


// ტესტის ფუნქცია (commented out - debugging only)
/*
function testFunction() {
    console.log('Test function called');
    
    // ტესტი - ვამოწმებთ ველებს
    const imageInput = document.getElementById('cardImage');
    const areaInput = document.getElementById('cardArea');
    
    console.log('Image input:', imageInput);
    console.log('Area input:', areaInput);
    console.log('Area value:', areaInput ? areaInput.value : 'No area input');
    console.log('Image files:', imageInput ? imageInput.files : 'No image input');
    
    // localStorage და sessionStorage ტესტი
    try {
        const testData = localStorage.getItem('adminCards');
        console.log('localStorage test - adminCards:', testData);
        
        const sessionTestData = sessionStorage.getItem('adminCards');
        console.log('sessionStorage test - adminCards:', sessionTestData);
        
        // ტესტის მონაცემების შექმნა
        localStorage.setItem('test', 'test value');
        const testValue = localStorage.getItem('test');
        localStorage.removeItem('test');
        
        sessionStorage.setItem('test', 'test value');
        const sessionTestValue = sessionStorage.getItem('test');
        sessionStorage.removeItem('test');
        
        let message = 'ტესტი მუშაობს!\n';
        
        if (testValue === 'test value') {
            console.log('localStorage is working correctly');
            message += 'localStorage: ✓\n';
        } else {
            console.log('localStorage test failed');
            message += 'localStorage: ✗\n';
        }
        
        if (sessionTestValue === 'test value') {
            console.log('sessionStorage is working correctly');
            message += 'sessionStorage: ✓';
        } else {
            console.log('sessionStorage test failed');
            message += 'sessionStorage: ✗';
        }
        
        alert(message);
    } catch (error) {
        console.error('Storage error:', error);
        alert('Storage შეცდომა: ' + error.message);
    }
}
window.testFunction = testFunction;
*/

// ქარდების სიის ჩატვირთვა
function loadCardsList() {
    console.log('loadCardsList called');
    const cardsList = document.getElementById('cardsList');
    console.log('cardsList element:', cardsList);
    
    if (!cardsList) {
        console.log('cardsList not found');
        return;
    }
    
    cardsList.innerHTML = '';
    console.log('projectsCards length:', projectsCards.length);
    
    if (projectsCards.length === 0) {
        cardsList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ქარდები არ არის დამატებული</p>';
        return;
    }
    
    projectsCards.forEach((card, index) => {
        console.log('Rendering card:', card);
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        cardItem.innerHTML = `
            <div class="card-preview">
                <img src="${card.image}" alt="ქარდი">
                <div class="card-details">
                    <div class="card-area">${card.area}</div>
                </div>
            </div>
            <div class="card-actions">
                <button class="edit-btn" onclick="editCard(${index})">რედაქტირება</button>
                <button class="delete-btn" onclick="deleteCard(${index})">წაშლა</button>
            </div>
        `;
        cardsList.appendChild(cardItem);
    });
}

// ქარდის რედაქტირება
function editCard(index) {
    const card = projectsCards[index];
    
    // შევქმნათ რედაქტირების მოდალი
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="edit-modal-content">
            <div class="edit-modal-header">
                <h3>ქარდის რედაქტირება</h3>
                <button class="edit-close" onclick="closeEditModal()">✕</button>
            </div>
            <div class="edit-modal-body">
                <div class="form-group">
                    <label for="editArea">ფართობი:</label>
                    <input type="text" id="editArea" value="${card.area}">
                </div>
                <div class="form-group">
                    <label for="editImage">ახალი ფოტო (ოფციონალური):</label>
                    <input type="file" id="editImage" accept="image/*">
                </div>
                <div class="current-image">
                    <label>მიმდინარე ფოტო:</label>
                    <img src="${card.image}" alt="მიმდინარე ფოტო" style="width: 100px; height: 75px; object-fit: cover; border-radius: 4px; margin-top: 5px;">
                </div>
                <div class="edit-actions">
                    <button class="save-edit-btn" onclick="saveCardEdit(${index})">შენახვა</button>
                    <button class="cancel-edit-btn" onclick="closeEditModal()">გაუქმება</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// რედაქტირების მოდალის დახურვა
function closeEditModal() {
    const modal = document.querySelector('.edit-modal');
    if (modal) {
        modal.remove();
    }
}

// ქარდის რედაქტირების შენახვა
function saveCardEdit(index) {
    const areaInput = document.getElementById('editArea');
    const imageInput = document.getElementById('editImage');
    
    const newArea = areaInput.value.trim();
    
    if (!newArea) {
        alert('შეავსეთ ფართობის ველი!');
        return;
    }
    
    if (imageInput.files && imageInput.files[0]) {
        // ახალი ფოტო ატვირთულია
        const file = imageInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            projectsCards[index] = {
                ...projectsCards[index],
                area: newArea,
                image: e.target.result
            };
            saveCardsToStorage(); // შენახვა localStorage-ში
            loadCardsList();
            closeEditModal();
            alert('ქარდი განახლდა!');
        };
        
        reader.readAsDataURL(file);
    } else {
        // ფოტო არ შეცვლილა
        projectsCards[index] = {
            ...projectsCards[index],
            area: newArea
        };
        saveCardsToStorage(); // შენახვა localStorage-ში
        loadCardsList();
        closeEditModal();
        alert('ქარდი განახლდა!');
    }
}

// ქარდის წაშლა
function deleteCard(index) {
    if (confirm('ნამდვილად გსურთ ქარდის წაშლა?')) {
        projectsCards.splice(index, 1);
        saveCardsToStorage(); // შენახვა localStorage-ში
        loadCardsList();
        alert('ქარდი წაიშალა!');
    }
}

// ფორმის გასუფთავება
function clearForm(inputs) {
    inputs.forEach(input => input.value = '');
}

// ქარდების ექსპორტი JSON ფაილად
function exportCards() {
    const dataStr = JSON.stringify(projectsCards, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projects-cards.json';
    link.click();
    URL.revokeObjectURL(url);
}

// ქარდების იმპორტი JSON ფაილიდან
function importCards() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedCards = JSON.parse(e.target.result);
                    if (Array.isArray(importedCards)) {
        projectsCards = importedCards;
        saveCardsToStorage(); // შენახვა localStorage-ში
        loadCardsList();
        alert('ქარდები წარმატებით იმპორტირდა!');
                    } else {
                        alert('არასწორი ფაილის ფორმატი!');
                    }
                } catch (error) {
                    alert('ფაილის წაკითხვის შეცდომა!');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// კლავიატურის შორტკატები
document.addEventListener('keydown', function(e) {
    // Ctrl + S - ექსპორტი
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportCards();
    }
    
    // Ctrl + O - იმპორტი
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        importCards();
    }
    
    // Escape - ფორმის გასუფთავება ან რედაქტირების მოდალის დახურვა
    if (e.key === 'Escape') {
        const editModal = document.querySelector('.edit-modal');
        if (editModal) {
            closeEditModal();
        } else {
            const inputs = document.querySelectorAll('#cardImage, #cardArea');
            clearForm(Array.from(inputs));
        }
    }
});

// ფუნქციების window-ზე დამატება onclick-ისთვის
window.editCard = editCard;
window.deleteCard = deleteCard;
window.closeEditModal = closeEditModal;
window.saveCardEdit = saveCardEdit;
window.clearForm = clearForm;
window.exportCards = exportCards;
window.importCards = importCards;
