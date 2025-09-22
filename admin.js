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
                    <label for="editText">ტექსტი:</label>
                    <input type="text" id="editText" value="${card.area}" placeholder="ფართობი ან სხვა ტექსტი">
                </div>
                
                <div class="form-group">
                    <label for="editMainImage">მთავარი ფოტო:</label>
                    <input type="file" id="editMainImage" accept="image/*">
                    <div class="current-main-image">
                        <img src="${card.image}" alt="მიმდინარე მთავარი ფოტო" style="width: 150px; height: 100px; object-fit: cover; border-radius: 4px; margin-top: 10px;">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>გალერიის ფოტოები:</label>
                    <div class="gallery-photos-container" id="galleryPhotosContainer">
                        <!-- Gallery photos will be loaded here -->
                    </div>
                    <button type="button" class="add-gallery-photo-btn" onclick="addGalleryPhotoField()">+ ფოტოს დამატება</button>
                </div>
                
                <div class="edit-actions">
                    <button class="save-edit-btn" onclick="saveCardEdit(${index})">შენახვა</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load existing gallery photos
    loadGalleryPhotosForEdit(index);
}

// რედაქტირების მოდალის დახურვა
function closeEditModal() {
    const modal = document.querySelector('.edit-modal');
    if (modal) {
        modal.remove();
    }
}

// გალერიის ფოტოების ჩატვირთვა რედაქტირებისთვის
function loadGalleryPhotosForEdit(cardIndex) {
    const container = document.getElementById('galleryPhotosContainer');
    const card = projectsCards[cardIndex];
    
    if (!container) {
        console.error('Gallery photos container not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Load existing gallery photos (first 5)
    const existingPhotos = galleryPhotos.slice(0, 5);
    
    if (existingPhotos.length === 0) {
        // No existing photos, create empty fields
        for (let i = 0; i < 3; i++) {
            const photoField = document.createElement('div');
            photoField.className = 'gallery-photo-field';
            photoField.innerHTML = `
                <div class="gallery-photo-preview">
                    <div class="no-photo-placeholder">ფოტო არ არის</div>
                    <button type="button" class="remove-gallery-photo-btn" onclick="removeGalleryPhotoField(${i})">×</button>
                </div>
                <input type="file" class="gallery-photo-input" accept="image/*" onchange="handleGalleryPhotoChange(${i}, this)">
            `;
            container.appendChild(photoField);
        }
    } else {
        existingPhotos.forEach((photo, index) => {
            const photoField = document.createElement('div');
            photoField.className = 'gallery-photo-field';
            photoField.innerHTML = `
                <div class="gallery-photo-preview">
                    <img src="${photo.url}" alt="Gallery Photo ${index + 1}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
                    <button type="button" class="remove-gallery-photo-btn" onclick="removeGalleryPhotoField(${index})">×</button>
                </div>
                <input type="file" class="gallery-photo-input" accept="image/*" onchange="handleGalleryPhotoChange(${index}, this)">
            `;
            container.appendChild(photoField);
        });
    }
}

// გალერიის ფოტოს ველის დამატება
function addGalleryPhotoField() {
    const container = document.getElementById('galleryPhotosContainer');
    if (!container) {
        console.error('Gallery photos container not found');
        return;
    }
    
    const currentCount = container.children.length;
    
    if (currentCount >= 10) {
        alert('მაქსიმუმ 10 ფოტო შეიძლება დაემატოს!');
        return;
    }
    
    const photoField = document.createElement('div');
    photoField.className = 'gallery-photo-field';
    photoField.innerHTML = `
        <div class="gallery-photo-preview">
            <div class="no-photo-placeholder">ფოტო არ არის</div>
            <button type="button" class="remove-gallery-photo-btn" onclick="removeGalleryPhotoField(${currentCount})">×</button>
        </div>
        <input type="file" class="gallery-photo-input" accept="image/*" onchange="handleGalleryPhotoChange(${currentCount}, this)">
    `;
    container.appendChild(photoField);
}

// გალერიის ფოტოს ველის წაშლა
function removeGalleryPhotoField(index) {
    const container = document.getElementById('galleryPhotosContainer');
    if (!container) return;
    
    const field = container.children[index];
    if (field) {
        field.remove();
        // Update indices for remaining fields
        updateGalleryPhotoIndices();
    }
}

// გალერიის ფოტოს ცვლილების დამუშავება
function handleGalleryPhotoChange(index, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = input.previousElementSibling;
            const img = preview.querySelector('img');
            if (img) {
                img.src = e.target.result;
            } else {
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Gallery Photo ${index + 1}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
                    <button type="button" class="remove-gallery-photo-btn" onclick="removeGalleryPhotoField(${index})">×</button>
                `;
            }
        };
        reader.readAsDataURL(file);
    }
}

// გალერიის ფოტოების ინდექსების განახლება
function updateGalleryPhotoIndices() {
    const container = document.getElementById('galleryPhotosContainer');
    if (!container) return;
    
    const fields = container.children;
    
    Array.from(fields).forEach((field, index) => {
        const input = field.querySelector('.gallery-photo-input');
        const removeBtn = field.querySelector('.remove-gallery-photo-btn');
        
        if (input) {
            input.setAttribute('onchange', `handleGalleryPhotoChange(${index}, this)`);
        }
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeGalleryPhotoField(${index})`);
        }
    });
}

// ქარდის რედაქტირების შენახვა
function saveCardEdit(index) {
    const textInput = document.getElementById('editText');
    const mainImageInput = document.getElementById('editMainImage');
    const galleryContainer = document.getElementById('galleryPhotosContainer');
    
    if (!textInput) {
        alert('ტექსტის ველი ვერ მოიძებნა!');
        return;
    }
    
    const newText = textInput.value.trim();
    
    if (!newText) {
        alert('შეავსეთ ტექსტის ველი!');
        return;
    }
    
    // Update card text
    projectsCards[index].area = newText;
    
    // Handle main image update
    if (mainImageInput && mainImageInput.files && mainImageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            projectsCards[index].image = e.target.result;
            saveCardAndGallery(index, galleryContainer);
        };
        reader.readAsDataURL(mainImageInput.files[0]);
    } else {
        saveCardAndGallery(index, galleryContainer);
    }
}

// ქარდისა და გალერიის შენახვა
function saveCardAndGallery(cardIndex, galleryContainer) {
    const card = projectsCards[cardIndex];
    
    if (!galleryContainer) {
        // No gallery container, just save card
        saveCardsToStorage();
        saveGalleryPhotosToStorage();
        loadCardsList();
        closeEditModal();
        alert('ქარდი განახლდა!');
        return;
    }
    
    // Update gallery photos
    const galleryFields = galleryContainer.children;
    const newGalleryPhotos = [];
    let processedCount = 0;
    let totalFields = galleryFields.length;
    
    if (totalFields === 0) {
        // No gallery fields, just save card
        saveCardsToStorage();
        saveGalleryPhotosToStorage();
        loadCardsList();
        closeEditModal();
        alert('ქარდი განახლდა!');
        return;
    }
    
    Array.from(galleryFields).forEach((field, index) => {
        const input = field.querySelector('.gallery-photo-input');
        const img = field.querySelector('img');
        
        if (input && input.files && input.files[0]) {
            // New photo uploaded
            const reader = new FileReader();
            reader.onload = function(e) {
                newGalleryPhotos.push({
                    id: `gallery-${Date.now()}-${Math.random()}`,
                    url: e.target.result,
                    title: `ფოტო ${index + 1}`
                });
                
                processedCount++;
                if (processedCount === totalFields) {
                    // All photos processed
                    galleryPhotos.splice(0, 5, ...newGalleryPhotos);
                    saveCardsToStorage();
                    saveGalleryPhotosToStorage();
                    loadCardsList();
                    closeEditModal();
                    alert('ქარდი და გალერიის ფოტოები განახლდა!');
                }
            };
            reader.readAsDataURL(input.files[0]);
        } else if (img && img.src && !img.src.includes('placeholder')) {
            // Existing photo
            newGalleryPhotos.push({
                id: `gallery-${Date.now()}-${Math.random()}`,
                url: img.src,
                title: `ფოტო ${index + 1}`
            });
            processedCount++;
            
            if (processedCount === totalFields) {
                // All photos processed
                galleryPhotos.splice(0, 5, ...newGalleryPhotos);
                saveCardsToStorage();
                saveGalleryPhotosToStorage();
                loadCardsList();
                closeEditModal();
                alert('ქარდი და გალერიის ფოტოები განახლდა!');
            }
        } else {
            // Empty field
            processedCount++;
            if (processedCount === totalFields) {
                // All photos processed
                galleryPhotos.splice(0, 5, ...newGalleryPhotos);
                saveCardsToStorage();
                saveGalleryPhotosToStorage();
                loadCardsList();
                closeEditModal();
                alert('ქარდი და გალერიის ფოტოები განახლდა!');
            }
        }
    });
}

// გალერიის ფოტოების ჩატვირთვა (placeholder)
function loadGalleryPhotosList() {
    console.log('loadGalleryPhotosList called - placeholder function');
    // This function is kept for compatibility but doesn't do anything
    // Gallery photos are managed through the card edit modal
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
window.showAddCardModal = showAddCardModal;
window.saveNewCard = saveNewCard;
window.closeAddCardModal = closeAddCardModal;
window.addGalleryPhotoField = addGalleryPhotoField;
window.removeGalleryPhotoField = removeGalleryPhotoField;
window.handleGalleryPhotoChange = handleGalleryPhotoChange;
