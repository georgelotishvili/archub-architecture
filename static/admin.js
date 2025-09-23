// ადმინ პანელის ფუნქციონალი - API ვერსია
let projectsCards = [];
let galleryPhotos = [];

// API ბაზის URL
const API_BASE_URL = '/api/projects';

// ქარდების ჩატვირთვა API-დან
async function loadCardsFromAPI() {
    try {
        console.log('Loading cards from API...');
        const response = await fetch(API_BASE_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        if (data.success) {
            projectsCards = data.projects || [];
            console.log('Cards loaded successfully from API:', projectsCards);
            loadCardsList();
        } else {
            console.error('API returned error:', data.error);
            projectsCards = [];
            showError('შეცდომა მონაცემების ჩატვირთვისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error loading cards from API:', error);
        projectsCards = [];
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// შეცდომის ჩვენება
function showError(message) {
    const cardsGrid = document.getElementById('cardsGrid');
    if (cardsGrid) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'text-align: center; color: #dc3545; padding: 20px; font-size: 16px; width: 90%; margin: 0 auto; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;';
        errorDiv.textContent = message;
        cardsGrid.insertBefore(errorDiv, cardsGrid.querySelector('.add-card-section'));
    }
}

// წარმატების შეტყობინების ჩვენება
function showSuccess(message) {
    const cardsGrid = document.getElementById('cardsGrid');
    if (cardsGrid) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = 'text-align: center; color: #155724; padding: 20px; font-size: 16px; width: 90%; margin: 0 auto; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px;';
        successDiv.textContent = message;
        cardsGrid.insertBefore(successDiv, cardsGrid.querySelector('.add-card-section'));
        
        // ავტომატურად წაშალოს 3 წამის შემდეგ
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// ქარდების სიის ჩვენება
function loadCardsList() {
    console.log('loadCardsList called');
    const cardsGrid = document.getElementById('cardsGrid');
    console.log('cardsGrid element:', cardsGrid);
    
    if (!cardsGrid) {
        console.log('cardsGrid not found');
        return;
    }
    
    // Clear only the cards, not the add-card-section
    const existingCards = cardsGrid.querySelectorAll('.card-item');
    existingCards.forEach(card => card.remove());
    
    // Clear any error/success messages
    const messages = cardsGrid.querySelectorAll('[style*="text-align: center"]');
    messages.forEach(msg => msg.remove());
    
    console.log('projectsCards length:', projectsCards.length);
    
    if (projectsCards.length === 0) {
        const noCardsMessage = document.createElement('div');
        noCardsMessage.style.cssText = 'text-align: center; color: #666; padding: 40px; font-size: 18px; width: 90%; margin: 0 auto;';
        noCardsMessage.textContent = 'ქარდები არ არის დამატებული';
        cardsGrid.insertBefore(noCardsMessage, cardsGrid.querySelector('.add-card-section'));
        return;
    }
    
    projectsCards.forEach((card, index) => {
        console.log('Rendering card:', card);
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        cardItem.innerHTML = `
            <div class="card-preview">
                <img src="${card.main_image_url}" alt="ქარდი">
            </div>
            <div class="card-details">
                <div class="card-area">${card.area}</div>
            </div>
            <div class="card-actions">
                <button class="edit-btn" onclick="editCard(${card.id})">რედაქტირება</button>
                <button class="delete-btn" onclick="deleteCard(${card.id})">წაშლა</button>
            </div>
        `;
        cardsGrid.insertBefore(cardItem, cardsGrid.querySelector('.add-card-section'));
    });
}

// ქარდის წაშლა API-ით
async function deleteCard(projectId) {
    if (confirm('ნამდვილად გსურთ ქარდის წაშლა? (გალერიის ფოტოებიც წაიშლება)')) {
        try {
            console.log('Deleting project with ID:', projectId);
            const response = await fetch(`${API_BASE_URL}/${projectId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Delete response:', data);
            
            if (data.success) {
                console.log('Project deleted successfully');
                showSuccess(`პროექტი ${data.project_info.area} წარმატებით წაიშალა`);
                
                // განაახლოს ქარდების სია
                await loadCardsFromAPI();
            } else {
                console.error('Delete failed:', data.error);
                showError('შეცდომა ქარდის წაშლისას: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    }
}

// ქარდის რედაქტირება - მოდალური ფანჯრის გახსნა
function editCard(projectId) {
    // იპოვოს პროექტი projectsCards მასივიდან
    const project = projectsCards.find(p => p.id === projectId);
    if (!project) {
        showError('პროექტი ვერ მოიძებნა');
        return;
    }
    
    // შექმნას მოდალური ფანჯარა
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h2 style="margin-top: 0; color: #333; text-align: center;">პროექტის რედაქტირება</h2>
            
            <div style="margin-bottom: 20px;">
                <label for="editArea" style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">ფართობი:</label>
                <input 
                    type="text" 
                    id="editArea" 
                    value="${project.area}" 
                    style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #ddd;
                        border-radius: 5px;
                        font-size: 16px;
                        box-sizing: border-box;
                    "
                    placeholder="შეიყვანეთ ფართობი"
                >
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <button 
                    onclick="saveProjectUpdate(${projectId})" 
                    style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        margin-right: 10px;
                        font-weight: bold;
                    "
                >
                    შენახვა
                </button>
                <button 
                    onclick="closeEditModal()" 
                    style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                    "
                >
                    დახურვა
                </button>
            </div>
        </div>
    `;
    
    // დაემატოს მოდალი DOM-ში
    document.body.appendChild(modal);
    
    // ფოკუსი input ველზე
    setTimeout(() => {
        const areaInput = document.getElementById('editArea');
        if (areaInput) {
            areaInput.focus();
            areaInput.select();
        }
    }, 100);
}

// მოდალის დახურვა
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
}

// პროექტის განახლების შენახვა
async function saveProjectUpdate(projectId) {
    const areaInput = document.getElementById('editArea');
    if (!areaInput) {
        showError('შეცდომა: input ველი ვერ მოიძებნა');
        return;
    }
    
    const newArea = areaInput.value.trim();
    if (!newArea) {
        showError('გთხოვთ შეიყვანოთ ფართობი');
        return;
    }
    
    try {
        console.log('Updating project with ID:', projectId, 'New area:', newArea);
        
        // შექმნას FormData
        const formData = new FormData();
        formData.append('area', newArea);
        
        const response = await fetch(`${API_BASE_URL}/${projectId}`, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Update response:', data);
        
        if (data.success) {
            console.log('Project updated successfully');
            showSuccess(`პროექტი "${data.project.area}" წარმატებით განახლდა`);
            
            // დახურვა მოდალი
            closeEditModal();
            
            // განაახლოს ქარდების სია
            await loadCardsFromAPI();
        } else {
            console.error('Update failed:', data.error);
            showError('შეცდომა პროექტის განახლებისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error updating project:', error);
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
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

// ქარდების იმპორტი JSON ფაილიდან (ძველი ფუნქცია - ამჟამად არ არის API-ში)
function importCards() {
    alert('იმპორტის ფუნქცია ამჟამად არ არის ხელმისაწვდომი. გთხოვთ, გამოიყენოთ ფაილების ატვირთვის ფუნქცია.');
}

// გალერიის ფოტოების ჩვენება
function loadGalleryPhotosList() {
    console.log('loadGalleryPhotosList called');
    const galleryContainer = document.getElementById('galleryPhotosContainer');
    
    if (!galleryContainer) {
        console.log('galleryPhotosContainer not found');
        return;
    }
    
    // Clear existing photos
    galleryContainer.innerHTML = '';
    
    console.log('galleryPhotos length:', galleryPhotos.length);
    
    if (galleryPhotos.length === 0) {
        const noPhotosMessage = document.createElement('div');
        noPhotosMessage.style.cssText = 'text-align: center; color: #666; padding: 20px; font-size: 16px;';
        noPhotosMessage.textContent = 'გალერიის ფოტოები არ არის დამატებული';
        galleryContainer.appendChild(noPhotosMessage);
        return;
    }
    
    galleryPhotos.forEach((photo, index) => {
        console.log('Rendering gallery photo:', photo);
        const photoDiv = document.createElement('div');
        photoDiv.className = 'gallery-photo-item';
        photoDiv.style.cssText = 'margin: 10px; display: inline-block; text-align: center;';
        photoDiv.innerHTML = `
            <img src="${photo.url}" alt="გალერიის ფოტო" style="width: 150px; height: 150px; object-fit: cover; border-radius: 5px; border: 2px solid #ddd;">
            <div style="margin-top: 5px;">
                <button onclick="removeGalleryPhoto(${index})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">წაშლა</button>
            </div>
        `;
        galleryContainer.appendChild(photoDiv);
    });
}

// გალერიის ფოტოს წაშლა
function removeGalleryPhoto(index) {
    if (confirm('ნამდვილად გსურთ ფოტოს წაშლა?')) {
        galleryPhotos.splice(index, 1);
        loadGalleryPhotosList();
    }
}

// გალერიის ფოტოების დამატება
function addGalleryPhotos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photo = {
                    url: e.target.result,
                    name: file.name,
                    size: file.size
                };
                galleryPhotos.push(photo);
                loadGalleryPhotosList();
            };
            reader.readAsDataURL(file);
        });
    };
    input.click();
}

// ძველი ფუნქციები, რომლებიც ამჟამად არ გამოიყენება
function clearOldCards() {
    // ძველი ფუნქცია - ამჟამად არ გამოიყენება
}

// გვერდის ჩატვირთვისას
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin page loaded, initializing...');
    
    // ჩატვირთოს ქარდები API-დან
    loadCardsFromAPI();
    
    // ჩატვირთოს გალერიის ფოტოები (თუ არის)
    loadGalleryPhotosList();
    
    console.log('Admin page initialization complete');
});

// ქარდის დამატების ღილაკის ფუნქცია
function addNewCard() {
    // გადამისამართოს ადმინ გვერდზე (რადგან ფორმა იქ არის)
    window.location.href = '/admin';
}

// ფორმის გასუფთავება
function clearAddProjectForm() {
    const form = document.getElementById('add-project-form');
    if (form) {
        form.reset();
        console.log('Form cleared');
    }
}

// ახალი პროექტის დამატება
async function addNewProject(formData) {
    try {
        console.log('Adding new project...');
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Add project response:', data);
        
        if (data.success) {
            console.log('Project added successfully');
            showSuccess(`პროექტი "${data.project.area}" წარმატებით დაემატა`);
            
            // გაასუფთავოს ფორმა
            clearAddProjectForm();
            
            // განაახლოს პროექტების სია
            await loadCardsFromAPI();
        } else {
            console.error('Add project failed:', data.error);
            showError('შეცდომა პროექტის დამატებისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error adding project:', error);
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// ფორმის submit event listener
document.addEventListener('DOMContentLoaded', function() {
    // ახალი პროექტის ფორმის event listener
    const addProjectForm = document.getElementById('add-project-form');
    if (addProjectForm) {
        addProjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Form submitted');
            
            // შეამოწმოს ვალიდაცია
            const areaInput = document.getElementById('area');
            const mainImageInput = document.getElementById('main_image');
            
            if (!areaInput.value.trim()) {
                showError('გთხოვთ შეიყვანოთ ფართობი');
                return;
            }
            
            if (!mainImageInput.files || mainImageInput.files.length === 0) {
                showError('გთხოვთ აირჩიოთ მთავარი ფოტო');
                return;
            }
            
            // შექმნას FormData
            const formData = new FormData();
            formData.append('area', areaInput.value.trim());
            formData.append('main_image', mainImageInput.files[0]);
            
            // დაემატოს გალერეის ფოტოები
            const galleryPhotosInput = document.getElementById('gallery_photos');
            if (galleryPhotosInput.files && galleryPhotosInput.files.length > 0) {
                for (let i = 0; i < galleryPhotosInput.files.length; i++) {
                    formData.append('gallery_photos', galleryPhotosInput.files[i]);
                }
            }
            
            // გააუქმოს submit ღილაკი დამუშავებისას
            const submitBtn = addProjectForm.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'მუშავდება...';
            
            try {
                await addNewProject(formData);
            } finally {
                // აღადგინოს submit ღილაკი
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});
