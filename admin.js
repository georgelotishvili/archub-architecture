// ადმინ პანელის ფუნქციონალი
let projectsCards = [];
let galleryPhotos = [];

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

// გალერიის ფოტოების შენახვა localStorage-ში
function saveGalleryPhotosToStorage() {
    try {
        console.log('Saving gallery photos to localStorage:', galleryPhotos);
        const photosData = JSON.stringify(galleryPhotos);
        
        localStorage.setItem('galleryPhotos', photosData);
        console.log('Gallery photos saved successfully to localStorage');
        
        // ალტერნატივად sessionStorage-შიც
        try {
            sessionStorage.setItem('galleryPhotos', photosData);
            console.log('Gallery photos also saved to sessionStorage');
        } catch (sessionError) {
            console.warn('sessionStorage save failed:', sessionError);
        }
        
        // შეტყობინება სხვა ტაბებისთვის
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'galleryPhotos',
            newValue: photosData
        }));
        console.log('Gallery photos storage event dispatched');
    } catch (error) {
        console.error('Error saving gallery photos to localStorage:', error);
        alert('შეცდომა გალერიის ფოტოების შენახვისას: ' + error.message);
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

// გალერიის ფოტოების ჩატვირთვა localStorage-იდან
function loadGalleryPhotosFromStorage() {
    try {
        console.log('Loading gallery photos from storage...');
        let savedPhotos = localStorage.getItem('galleryPhotos');
        
        // თუ localStorage-ში არ არის, სცადოს sessionStorage-ში
        if (!savedPhotos) {
            console.log('No gallery photos in localStorage, checking sessionStorage...');
            try {
                savedPhotos = sessionStorage.getItem('galleryPhotos');
                if (savedPhotos) {
                    console.log('Found gallery photos in sessionStorage');
                }
            } catch (sessionError) {
                console.warn('sessionStorage access failed:', sessionError);
            }
        }
        
        console.log('Raw saved gallery photos:', savedPhotos);
        
        if (savedPhotos) {
            galleryPhotos = JSON.parse(savedPhotos);
            console.log('Parsed gallery photos from storage:', galleryPhotos);
        } else {
            console.log('No saved gallery photos found, creating default photos');
            // თუ არ არის შენახული ფოტოები, შევქმნათ ნიმუშები
            createDefaultGalleryPhotos();
        }
    } catch (error) {
        console.error('Error loading gallery photos from storage:', error);
        console.log('Creating default gallery photos as fallback');
        createDefaultGalleryPhotos();
    }
}

// ნიმუშის გალერიის ფოტოების შექმნა
function createDefaultGalleryPhotos() {
    const defaultPhotos = [
        { id: 'gallery-1', url: 'photos/car (1).jpg', title: 'ფოტო 1' },
        { id: 'gallery-2', url: 'photos/car (2).jpg', title: 'ფოტო 2' },
        { id: 'gallery-3', url: 'photos/car (3).jpg', title: 'ფოტო 3' },
        { id: 'gallery-4', url: 'photos/car (4).jpg', title: 'ფოტო 4' },
        { id: 'gallery-5', url: 'photos/car (5).jpg', title: 'ფოტო 5' }
    ];
    
    galleryPhotos = defaultPhotos;
    saveGalleryPhotosToStorage();
}

// მთავარი ფუნქცია
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin page loaded');
    
    // ინიციალიზაცია
    loadCardsFromStorage();
    loadCardsList();
    loadGalleryPhotosFromStorage();
    
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
    
    
    // Add new card button event listener
    const addNewCardBtn = document.getElementById('addNewCardBtn');
    console.log('addNewCardBtn found:', addNewCardBtn);
    
    if (addNewCardBtn) {
        addNewCardBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Add new card button clicked, calling showAddCardModal');
            showAddCardModal();
        });
        console.log('Add new card event listener added successfully');
    } else {
        console.log('Add new card button not found!');
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
            addCardBtn.textContent = 'მიმდინარეობს... (ფოტოები ატვირთება)';
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
                    
                    // გალერიის ფოტოების დამატება
                    const galleryPhotosToAdd = photos.map(photo => ({
                        id: `gallery-${Date.now()}-${Math.random()}`,
                        url: photo.url,
                        title: photo.title
                    }));
                    
                    galleryPhotos.push(...galleryPhotosToAdd);
                    console.log('Added to gallery photos:', galleryPhotosToAdd);
                    
                    saveCardsToStorage(); // შენახვა localStorage-ში
                    saveGalleryPhotosToStorage(); // გალერიის ფოტოების შენახვა
                    loadCardsList();
                    loadGalleryPhotosList(); // გალერიის ფოტოების განახლება
                    clearForm([imageInput, areaInput, additionalFilesInput]);
                    alert('ქარდი და გალერიის ფოტოები წარმატებით დაემატა!');
                    
                    // ღილაკის განბლოკვა
                    if (addCardBtn) {
                        addCardBtn.disabled = false;
                        addCardBtn.textContent = 'ქარდის დამატება (ფოტოები გალერიაშიც დაემატება)';
                    }
                }
            };
            
            reader.onerror = function() {
                console.error('Error reading file:', file);
                alert('ფაილის წაკითხვის შეცდომა!');
                if (addCardBtn) {
                    addCardBtn.disabled = false;
                    addCardBtn.textContent = 'ქარდის დამატება (ფოტოები გალერიაშიც დაემატება)';
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
            addCardBtn.textContent = 'ქარდის დამატება (ფოტოები გალერიაშიც დაემატება)';
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
    const cardsGrid = document.getElementById('cardsGrid');
    console.log('cardsGrid element:', cardsGrid);
    
    if (!cardsGrid) {
        console.log('cardsGrid not found');
        return;
    }
    
    cardsGrid.innerHTML = '';
    console.log('projectsCards length:', projectsCards.length);
    
    if (projectsCards.length === 0) {
        cardsGrid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px; font-size: 18px; width: 90%; margin: 0 auto;">ქარდები არ არის დამატებული</div>';
        return;
    }
    
    projectsCards.forEach((card, index) => {
        console.log('Rendering card:', card);
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        cardItem.innerHTML = `
            <div class="card-preview">
                <img src="${card.image}" alt="ქარდი">
            </div>
            <div class="card-details">
                <div class="card-area">${card.area}</div>
            </div>
            <div class="card-actions">
                <button class="upload-photos-btn" onclick="uploadPhotosForCard(${index})">ფოტოების ატვირთვა</button>
                <button class="edit-btn" onclick="editCard(${index})">რედაქტირება</button>
                <button class="delete-btn" onclick="deleteCard(${index})">წაშლა</button>
            </div>
        `;
        cardsGrid.appendChild(cardItem);
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
                <button class="edit-close" onclick="closeEditModal()">დახურვა</button>
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
            const oldImage = projectsCards[index].image;
            
            projectsCards[index] = {
                ...projectsCards[index],
                area: newArea,
                image: e.target.result
            };
            
            // გალერიის ფოტოების განახლება
            const galleryPhotoIndex = galleryPhotos.findIndex(photo => photo.url === oldImage);
            if (galleryPhotoIndex !== -1) {
                galleryPhotos[galleryPhotoIndex] = {
                    ...galleryPhotos[galleryPhotoIndex],
                    url: e.target.result,
                    title: 'მთავარი ფოტო'
                };
                saveGalleryPhotosToStorage();
                loadGalleryPhotosList();
            }
            
            saveCardsToStorage(); // შენახვა localStorage-ში
            loadCardsList();
            closeEditModal();
            alert('ქარდი და გალერიის ფოტოები განახლდა!');
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
    if (confirm('ნამდვილად გსურთ ქარდის წაშლა? (გალერიის ფოტოებიც წაიშლება)')) {
        const card = projectsCards[index];
        
        // გალერიის ფოტოების წაშლა
        if (card.photos && card.photos.length > 0) {
            card.photos.forEach(photo => {
                const galleryPhotoIndex = galleryPhotos.findIndex(galleryPhoto => galleryPhoto.url === photo.url);
                if (galleryPhotoIndex !== -1) {
                    galleryPhotos.splice(galleryPhotoIndex, 1);
                }
            });
            saveGalleryPhotosToStorage();
            loadGalleryPhotosList();
        }
        
        projectsCards.splice(index, 1);
        saveCardsToStorage(); // შენახვა localStorage-ში
        loadCardsList();
        alert('ქარდი და გალერიის ფოტოები წაიშალა!');
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


// ცალკე ქარდისთვის ფოტოების ატვირთვა
function uploadPhotosForCard(cardIndex) {
    const card = projectsCards[cardIndex];
    
    // შევქმნათ ფოტოების ატვირთვის მოდალი
    const modal = document.createElement('div');
    modal.className = 'upload-photos-modal';
    modal.innerHTML = `
        <div class="upload-photos-modal-content">
            <div class="upload-photos-modal-header">
                <h3>ფოტოების ატვირთვა - ${card.area}</h3>
                <button class="upload-photos-close" onclick="closeUploadPhotosModal()">დახურვა</button>
            </div>
            <div class="upload-photos-modal-body">
                <div class="upload-sections">
                    <div class="upload-section main-photo-section">
                        <h4>მთავარი ფოტო:</h4>
                        <div class="file-upload-area" onclick="document.getElementById('mainPhotoInput').click()">
                            <div class="upload-icon">📷</div>
                            <div class="upload-text">მთავარი ფოტოს არჩევა</div>
                            <div class="upload-subtext">JPEG ფაილი</div>
                        </div>
                        <input type="file" id="mainPhotoInput" accept="image/jpeg,image/jpg" style="display: none;" onchange="handleMainPhotoSelection(${cardIndex})">
                        <button class="add-main-photo-btn" onclick="addMainPhoto(${cardIndex})" style="display: none;">მთავარი ფოტოს დამატება</button>
                    </div>
                    
                    <div class="upload-section other-photos-section">
                        <h4>სხვა ფოტოები:</h4>
                        <div class="file-upload-area" onclick="document.getElementById('otherPhotosInput').click()">
                            <div class="upload-icon">📁</div>
                            <div class="upload-text">სხვა ფოტოების არჩევა</div>
                            <div class="upload-subtext">JPEG ფაილები</div>
                        </div>
                        <input type="file" id="otherPhotosInput" accept="image/jpeg,image/jpg" multiple style="display: none;" onchange="handleOtherPhotosSelection(${cardIndex})">
                        <button class="add-other-photos-btn" onclick="addOtherPhotos(${cardIndex})" style="display: none;">სხვა ფოტოების დამატება</button>
                    </div>
                </div>
                
                <div class="photos-preview-section">
                    <h4>ფოტოების პრევიუ:</h4>
                    <div class="photos-preview-container" id="photosPreviewContainer">
                        <!-- Selected photos will be shown here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store current card index for global access
    window.currentEditingCardIndex = cardIndex;
}

// მიმდინარე ფოტოების ჩვენება
function displayCurrentPhotos(cardIndex) {
    const card = projectsCards[cardIndex];
    const currentPhotosGrid = document.getElementById('currentPhotosGrid');
    
    if (!currentPhotosGrid) return;
    
    currentPhotosGrid.innerHTML = '';
    
    if (card.photos && card.photos.length > 0) {
        card.photos.forEach((photo, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'current-photo-item';
            photoItem.innerHTML = `
                <img src="${photo.url}" alt="${photo.title}">
                <div class="photo-actions">
                    <button class="remove-photo-btn" onclick="removePhotoFromCard(${cardIndex}, ${index})" title="ფოტოს წაშლა">წაშლა</button>
                </div>
            `;
            currentPhotosGrid.appendChild(photoItem);
        });
    } else {
        currentPhotosGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ფოტოები არ არის</p>';
    }
}

// ფოტოს წაშლა ქარდიდან
function removePhotoFromCard(cardIndex, photoIndex) {
    if (confirm('ნამდვილად გსურთ ფოტოს წაშლა?')) {
        const card = projectsCards[cardIndex];
        const photo = card.photos[photoIndex];
        
        // ფოტოს წაშლა ქარდიდან
        card.photos.splice(photoIndex, 1);
        
        // თუ ეს იყო მთავარი ფოტო, შეცვალოს
        if (photoIndex === 0 && card.photos.length > 0) {
            card.image = card.photos[0].url;
        } else if (card.photos.length === 0) {
            card.image = '';
        }
        
        // გალერიის ფოტოებიდანაც წაშალოს
        const galleryPhotoIndex = galleryPhotos.findIndex(galleryPhoto => galleryPhoto.url === photo.url);
        if (galleryPhotoIndex !== -1) {
            galleryPhotos.splice(galleryPhotoIndex, 1);
            saveGalleryPhotosToStorage();
            loadGalleryPhotosList();
        }
        
        saveCardsToStorage();
        loadCardsList();
        displayCurrentPhotos(cardIndex);
        alert('ფოტო წაიშალა!');
    }
}

// ახალი ფოტოების შენახვა
function saveNewPhotos(cardIndex) {
    const photosInput = document.getElementById('newCardPhotos');
    
    if (!photosInput || !photosInput.files || photosInput.files.length === 0) {
        alert('აირჩიეთ ფოტოები!');
        return;
    }
    
    const card = projectsCards[cardIndex];
    const newPhotos = [];
    let processedFiles = 0;
    
    Array.from(photosInput.files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const newPhoto = {
                url: e.target.result,
                title: `ფოტო ${card.photos.length + index + 1}`
            };
            
            newPhotos.push(newPhoto);
            processedFiles++;
            
            if (processedFiles === photosInput.files.length) {
                // ფოტოების დამატება ქარდში
                card.photos.push(...newPhotos);
                
                // თუ ქარდს არ აქვს მთავარი ფოტო, დაუყენოს პირველი
                if (!card.image && newPhotos.length > 0) {
                    card.image = newPhotos[0].url;
                }
                
                // გალერიის ფოტოების დამატება
                const galleryPhotosToAdd = newPhotos.map(photo => ({
                    id: `gallery-${Date.now()}-${Math.random()}`,
                    url: photo.url,
                    title: photo.title
                }));
                
                galleryPhotos.push(...galleryPhotosToAdd);
                
                saveCardsToStorage();
                saveGalleryPhotosToStorage();
                loadCardsList();
                loadGalleryPhotosList();
                displayCurrentPhotos(cardIndex);
                photosInput.value = '';
                alert(`${newPhotos.length} ფოტო წარმატებით დაემატა!`);
            }
        };
        
        reader.readAsDataURL(file);
    });
}

// მთავარი ფოტოს არჩევის დამუშავება
function handleMainPhotoSelection(cardIndex) {
    const fileInput = document.getElementById('mainPhotoInput');
    const addBtn = document.querySelector('.add-main-photo-btn');
    const previewContainer = document.getElementById('photosPreviewContainer');
    
    if (fileInput.files && fileInput.files.length > 0) {
        addBtn.style.display = 'block';
        
        // Clear previous main photo preview
        const existingMainPhoto = document.querySelector('.main-photo-preview');
        if (existingMainPhoto) {
            existingMainPhoto.remove();
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-preview-item main-photo-preview';
            photoItem.innerHTML = `
                <div class="photo-preview-image">
                    <img src="${e.target.result}" alt="Main Photo Preview">
                    <div class="photo-actions">
                        <span class="main-photo-label">მთავარი</span>
                    </div>
                </div>
            `;
            previewContainer.insertBefore(photoItem, previewContainer.firstChild);
        };
        reader.readAsDataURL(file);
    }
}

// სხვა ფოტოების არჩევის დამუშავება
function handleOtherPhotosSelection(cardIndex) {
    const fileInput = document.getElementById('otherPhotosInput');
    const addBtn = document.querySelector('.add-other-photos-btn');
    const previewContainer = document.getElementById('photosPreviewContainer');
    
    if (fileInput.files && fileInput.files.length > 0) {
        addBtn.style.display = 'block';
        
        // Clear previous other photos preview
        const existingOtherPhotos = document.querySelectorAll('.other-photo-preview');
        existingOtherPhotos.forEach(item => item.remove());
        
        Array.from(fileInput.files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-preview-item other-photo-preview';
                photoItem.innerHTML = `
                    <div class="photo-preview-image">
                        <img src="${e.target.result}" alt="Other Photo Preview">
                        <div class="photo-actions">
                            <button class="move-up-btn" onclick="moveOtherPhotoUp(${index})" title="ზევით">↑</button>
                            <button class="move-down-btn" onclick="moveOtherPhotoDown(${index})" title="ქვევით">↓</button>
                        </div>
                    </div>
                `;
                previewContainer.appendChild(photoItem);
            };
            reader.readAsDataURL(file);
        });
    }
}

// მთავარ ფოტოდ დაყენება
function setAsMainPhoto(photoIndex) {
    const previewItems = document.querySelectorAll('.photo-preview-item');
    previewItems.forEach((item, index) => {
        const setMainBtn = item.querySelector('.set-main-btn');
        if (index === photoIndex) {
            setMainBtn.style.background = '#ffc400';
            setMainBtn.style.color = '#000';
            setMainBtn.textContent = '★';
        } else {
            setMainBtn.style.background = '#6c757d';
            setMainBtn.style.color = '#fff';
            setMainBtn.textContent = '⭐';
        }
    });
}

// ფოტოს ზევით გადატანა
function movePhotoUp(photoIndex) {
    const previewContainer = document.getElementById('photosPreviewContainer');
    const items = Array.from(previewContainer.children);
    
    if (photoIndex > 0) {
        const temp = items[photoIndex];
        items[photoIndex] = items[photoIndex - 1];
        items[photoIndex - 1] = temp;
        
        previewContainer.innerHTML = '';
        items.forEach(item => previewContainer.appendChild(item));
        
        // Update button indices
        updateButtonIndices();
    }
}

// ფოტოს ქვევით გადატანა
function movePhotoDown(photoIndex) {
    const previewContainer = document.getElementById('photosPreviewContainer');
    const items = Array.from(previewContainer.children);
    
    if (photoIndex < items.length - 1) {
        const temp = items[photoIndex];
        items[photoIndex] = items[photoIndex + 1];
        items[photoIndex + 1] = temp;
        
        previewContainer.innerHTML = '';
        items.forEach(item => previewContainer.appendChild(item));
        
        // Update button indices
        updateButtonIndices();
    }
}

// ღილაკების ინდექსების განახლება
function updateButtonIndices() {
    const previewItems = document.querySelectorAll('.photo-preview-item');
    previewItems.forEach((item, index) => {
        const setMainBtn = item.querySelector('.set-main-btn');
        const moveUpBtn = item.querySelector('.move-up-btn');
        const moveDownBtn = item.querySelector('.move-down-btn');
        
        setMainBtn.setAttribute('onclick', `setAsMainPhoto(${index})`);
        moveUpBtn.setAttribute('onclick', `movePhotoUp(${index})`);
        moveDownBtn.setAttribute('onclick', `movePhotoDown(${index})`);
    });
}

// მთავარი ფოტოს დამატება
function addMainPhoto(cardIndex) {
    const fileInput = document.getElementById('mainPhotoInput');
    const card = projectsCards[cardIndex];
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('აირჩიეთ მთავარი ფოტო!');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        // Update card main image
        card.image = e.target.result;
        
        // Add to gallery if not already there
        const existingGalleryPhoto = galleryPhotos.find(photo => photo.url === e.target.result);
        if (!existingGalleryPhoto) {
            galleryPhotos.push({
                id: `gallery-${Date.now()}-${Math.random()}`,
                url: e.target.result,
                title: `მთავარი ფოტო - ${card.area}`
            });
        }
        
        saveCardsToStorage();
        saveGalleryPhotosToStorage();
        loadCardsList();
        loadGalleryPhotosList();
        closeUploadPhotosModal();
        alert('მთავარი ფოტო წარმატებით დაემატა!');
    };
    reader.readAsDataURL(file);
}

// სხვა ფოტოების დამატება
function addOtherPhotos(cardIndex) {
    const fileInput = document.getElementById('otherPhotosInput');
    const card = projectsCards[cardIndex];
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('აირჩიეთ სხვა ფოტოები!');
        return;
    }
    
    const files = Array.from(fileInput.files);
    const newPhotos = [];
    let processedFiles = 0;
    
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            newPhotos.push({
                url: e.target.result,
                title: `ფოტო ${card.photos.length + index + 1}`
            });
            
            processedFiles++;
            
            if (processedFiles === files.length) {
                // Add photos to card
                card.photos.push(...newPhotos);
                
                // Add to gallery
                const galleryPhotosToAdd = newPhotos.map(photo => ({
                    id: `gallery-${Date.now()}-${Math.random()}`,
                    url: photo.url,
                    title: photo.title
                }));
                
                galleryPhotos.push(...galleryPhotosToAdd);
                
                saveCardsToStorage();
                saveGalleryPhotosToStorage();
                loadCardsList();
                loadGalleryPhotosList();
                closeUploadPhotosModal();
                alert(`${newPhotos.length} ფოტო წარმატებით დაემატა!`);
            }
        };
        reader.readAsDataURL(file);
    });
}

// სხვა ფოტოს ზევით გადატანა
function moveOtherPhotoUp(photoIndex) {
    const previewContainer = document.getElementById('photosPreviewContainer');
    const otherPhotos = Array.from(previewContainer.querySelectorAll('.other-photo-preview'));
    
    if (photoIndex > 0) {
        const temp = otherPhotos[photoIndex];
        otherPhotos[photoIndex] = otherPhotos[photoIndex - 1];
        otherPhotos[photoIndex - 1] = temp;
        
        // Reorder in DOM
        otherPhotos.forEach(photo => previewContainer.appendChild(photo));
        
        // Update button indices
        updateOtherPhotoButtonIndices();
    }
}

// სხვა ფოტოს ქვევით გადატანა
function moveOtherPhotoDown(photoIndex) {
    const previewContainer = document.getElementById('photosPreviewContainer');
    const otherPhotos = Array.from(previewContainer.querySelectorAll('.other-photo-preview'));
    
    if (photoIndex < otherPhotos.length - 1) {
        const temp = otherPhotos[photoIndex];
        otherPhotos[photoIndex] = otherPhotos[photoIndex + 1];
        otherPhotos[photoIndex + 1] = temp;
        
        // Reorder in DOM
        otherPhotos.forEach(photo => previewContainer.appendChild(photo));
        
        // Update button indices
        updateOtherPhotoButtonIndices();
    }
}

// სხვა ფოტოების ღილაკების ინდექსების განახლება
function updateOtherPhotoButtonIndices() {
    const otherPhotos = document.querySelectorAll('.other-photo-preview');
    otherPhotos.forEach((item, index) => {
        const moveUpBtn = item.querySelector('.move-up-btn');
        const moveDownBtn = item.querySelector('.move-down-btn');
        
        moveUpBtn.setAttribute('onclick', `moveOtherPhotoUp(${index})`);
        moveDownBtn.setAttribute('onclick', `moveOtherPhotoDown(${index})`);
    });
}

// ფოტოების ატვირთვის მოდალის დახურვა
function closeUploadPhotosModal() {
    const modal = document.querySelector('.upload-photos-modal');
    if (modal) {
        modal.remove();
    }
}

// ახალი ქარდის დამატების მოდალის ჩვენება
function showAddCardModal() {
    const modal = document.createElement('div');
    modal.className = 'add-card-modal';
    modal.innerHTML = `
        <div class="add-card-modal-content">
            <div class="add-card-modal-header">
                <h3>ახალი ქარდის დამატება</h3>
                <button class="add-card-close" onclick="closeAddCardModal()">დახურვა</button>
            </div>
            <div class="add-card-modal-body">
                <div class="form-group">
                    <label for="modalCardImage">მთავარი ფოტო:</label>
                    <input type="file" id="modalCardImage" accept="image/*">
                </div>
                <div class="form-group">
                    <label for="modalCardPhotos">დამატებითი ფოტოები:</label>
                    <input type="file" id="modalCardPhotos" accept="image/*" multiple>
                    <small style="color: #666; font-size: 12px;">შეგიძლიათ რამდენიმე ფოტო აირჩიოთ</small>
                </div>
                <div class="form-group">
                    <label for="modalCardArea">ფართობი:</label>
                    <input type="text" id="modalCardArea" placeholder="მაგ: 120 კვ.მ">
                </div>
                <div class="add-card-modal-actions">
                    <button class="save-card-btn" onclick="saveNewCard()">ქარდის დამატება</button>
                    <button class="cancel-card-btn" onclick="closeAddCardModal()">გაუქმება</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ახალი ქარდის შენახვა
function saveNewCard() {
    const imageInput = document.getElementById('modalCardImage');
    const areaInput = document.getElementById('modalCardArea');
    const additionalFilesInput = document.getElementById('modalCardPhotos');
    
    const area = areaInput.value.trim();
    
    if (!area) {
        alert('შეავსეთ ფართობის ველი!');
        return;
    }
    
    if (!imageInput.files || !imageInput.files[0]) {
        alert('აირჩიეთ მთავარი ფოტო!');
        return;
    }
    
    const mainFile = imageInput.files[0];
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
            
            if (processedFiles === allFiles.length) {
                const newCard = {
                    id: `card-${Date.now()}`,
                    area: area,
                    image: photos[0].url,
                    link: `card-detail.html?id=card-${Date.now()}`,
                    photos: photos
                };
                
                projectsCards.push(newCard);
                
                // გალერიის ფოტოების დამატება
                const galleryPhotosToAdd = photos.map(photo => ({
                    id: `gallery-${Date.now()}-${Math.random()}`,
                    url: photo.url,
                    title: photo.title
                }));
                
                galleryPhotos.push(...galleryPhotosToAdd);
                
                saveCardsToStorage();
                saveGalleryPhotosToStorage();
                loadCardsList();
                loadGalleryPhotosList();
                closeAddCardModal();
                alert('ქარდი და გალერიის ფოტოები წარმატებით დაემატა!');
            }
        };
        
        reader.readAsDataURL(file);
    });
}

// ახალი ქარდის მოდალის დახურვა
function closeAddCardModal() {
    const modal = document.querySelector('.add-card-modal');
    if (modal) {
        modal.remove();
    }
}

// ფუნქციების window-ზე დამატება onclick-ისთვის
window.editCard = editCard;
window.deleteCard = deleteCard;
window.closeEditModal = closeEditModal;
window.saveCardEdit = saveCardEdit;
window.clearForm = clearForm;
window.exportCards = exportCards;
window.importCards = importCards;
window.uploadPhotosForCard = uploadPhotosForCard;
window.removePhotoFromCard = removePhotoFromCard;
window.saveNewPhotos = saveNewPhotos;
window.closeUploadPhotosModal = closeUploadPhotosModal;
window.showAddCardModal = showAddCardModal;
window.saveNewCard = saveNewCard;
window.closeAddCardModal = closeAddCardModal;
window.handleMainPhotoSelection = handleMainPhotoSelection;
window.handleOtherPhotosSelection = handleOtherPhotosSelection;
window.addMainPhoto = addMainPhoto;
window.addOtherPhotos = addOtherPhotos;
window.moveOtherPhotoUp = moveOtherPhotoUp;
window.moveOtherPhotoDown = moveOtherPhotoDown;
