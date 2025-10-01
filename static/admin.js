// ===== ARCHUB - ადმინ პანელის JavaScript ფაილი =====
// ეს ფაილი შეიცავს ადმინ პანელის ფუნქციონალს
// პროექტების CRUD ოპერაციები, ფოტოების ატვირთვა, API კომუნიკაცია

// ===== გლობალური ცვლადები =====
let projectsCards = [];  // პროექტების მასივი
let galleryPhotos = [];  // გალერეის ფოტოების მასივი

// ===== API კონფიგურაცია და უსაფრთხო fetch =====
const API_BASE_URL = '/api/projects';  // API-ის ძირითადი URL
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

async function secureFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;
    return fetch(url, { credentials: 'same-origin', ...options, headers });
}

// ===== პროექტების ჩატვირთვა API-დან =====
async function loadCardsFromAPI() {
    try {
        console.log('Loading cards from API...');
        const response = await secureFetch(API_BASE_URL);
        
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
        cardsGrid.appendChild(noCardsMessage);
        return;
    }
    
    projectsCards.forEach((card, index) => {
        console.log('Rendering card:', card);
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        
        // Check if project has main image
        const hasMainImage = card.main_image_url && card.main_image_url.trim() !== '';
        const imageHtml = hasMainImage 
            ? `<img src="${card.main_image_url}" alt="ქარდი">`
            : `<div style="width: 100%; height: 200px; background: #f8f9fa; border: 2px dashed #ddd; display: flex; align-items: center; justify-content: center; color: #666; font-size: 16px;">ფოტო არ არის</div>`;
        
        cardItem.innerHTML = `
            <div class="card-preview">
                ${imageHtml}
            </div>
            <div class="card-details">
                <div class="card-area">${card.area}</div>
            </div>
            <div class="card-actions">
                <button class="edit-btn" onclick="editCard(${card.id})">რედაქტირება</button>
                <button class="delete-btn" onclick="deleteCard(${card.id})">წაშლა</button>
            </div>
        `;
        cardsGrid.appendChild(cardItem);
    });
    
    // Add the "Add Project" button as a card-like element after all projects
    const addCardItem = document.createElement('div');
    addCardItem.className = 'card-item';
    addCardItem.innerHTML = `
        <div class="card-preview">
            <div style="width: 100%; height: 200px; background: #f8f9fa; border: 2px dashed #007bff; display: flex; align-items: center; justify-content: center; color: #007bff; font-size: 16px; font-weight: bold; cursor: pointer;" onclick="addNewCard()">
                + პროექტის დამატება
            </div>
        </div>
        <div class="card-details">
            <div class="card-area" style="color: #007bff; font-weight: bold;">ახალი პროექტი</div>
        </div>
        <div class="card-actions">
            <button class="edit-btn" onclick="addNewCard()" style="background: #007bff;">დამატება</button>
        </div>
    `;
    cardsGrid.appendChild(addCardItem);
}

// ქარდის წაშლა API-ით
async function deleteCard(projectId) {
    if (confirm('ნამდვილად გსურთ ქარდის წაშლა? (გალერიის ფოტოებიც წაიშლება)')) {
        try {
            console.log('Deleting project with ID:', projectId);
            const response = await secureFetch(`${API_BASE_URL}/${projectId}`, {
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
                // განაახლოს მთავარი გვერდი (თუ ის ღიაა)
                refreshMainPageIfOpen();
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
            max-width: 800px;
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
        ">
            <h2 style="margin-top: 0; color: #333; text-align: center;">პროექტის რედაქტირება</h2>
            
            <div style="margin-bottom: 20px;">
                <label for="editArea" style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">ფართობი:</label>
                <input 
                    type="text" 
                    id="editArea" 
                    value="" 
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
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">მთავარი ფოტო:</label>
                <div id="mainImageContainer" style="text-align: center; margin-bottom: 10px; position: relative; display: inline-block;">
                    ${project.main_image_url && project.main_image_url.trim() !== '' ? 
                        `<img src="${project.main_image_url}" alt="მთავარი ფოტო" style="max-width: 200px; max-height: 150px; border-radius: 5px; border: 2px solid #ddd;">
                        <button onclick="deleteMainImage(${projectId})" style="position: absolute; top: -5px; right: -5px; background: #dc3545; color: white; border: none; width: 25px; height: 25px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center;" title="მთავარი ფოტოს წაშლა">&times;</button>` :
                        `<div style="width: 200px; height: 150px; border: 2px dashed #ddd; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #666; background: #f8f9fa;">
                            <span>მთავარი ფოტო არ არის</span>
                        </div>`
                    }
                </div>
                <div style="text-align: center;">
                    <button 
                        onclick="changeMainImage(${projectId})" 
                        style="
                            background: #28a745;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                        "
                    >
                        ${project.main_image_url && project.main_image_url.trim() !== '' ? 'მთავარი ფოტოს შეცვლა' : 'მთავარი ფოტოს დამატება'}
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">გალერეის ფოტოები:</label>
                <div id="editGalleryPhotos" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                    <!-- გალერეის ფოტოები აქ ჩაიტვირთება -->
                </div>
                <div style="text-align: center;">
                    <button 
                        onclick="addPhotosToProject(${projectId})" 
                        style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                            margin-right: 10px;
                        "
                    >
                        ფოტოების დამატება
                    </button>
                </div>
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
    
    // უსაფრთხოების გაუმჯობესება: XSS-ისგან დაცვა
    const editAreaInput = document.getElementById('editArea');
    if (editAreaInput) editAreaInput.value = project.area;

    // ჩატვირთოს გალერეის ფოტოები
    loadEditGalleryPhotos(project);
    
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
        
        const response = await secureFetch(`${API_BASE_URL}/${projectId}`, {
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
            // განაახლოს მთავარი გვერდი (თუ ის ღიაა)
            refreshMainPageIfOpen();
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

// მთავარი გვერდის განახლება (თუ ის ღიაა)
function refreshMainPageIfOpen() {
    // ახლა ადმინისტრატორის გვერდი იგივე ფანჯარაში იხსნება
    // ამიტომ არ არის საჭირო მთავარი გვერდის განახლება
    console.log('Admin panel is in the same window, no need to refresh main page');
}

// მთავარ გვერდზე გადასვლა
function goToMainPage(event) {
    event.preventDefault();
    window.location.href = '/';
}

// ქარდის დამატების ღილაკის ფუნქცია
async function addNewCard() {
    try {
        console.log('Creating empty project...');
        const response = await secureFetch('/api/projects/empty', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Create empty project response:', data);
        
        if (data.success) {
            console.log('Empty project created successfully');
            // განაახლოს პროექტების სია
            await loadCardsFromAPI();
            // განაახლოს მთავარი გვერდი (თუ ის ღიაა)
            refreshMainPageIfOpen();
        } else {
            console.error('Create empty project failed:', data.error);
            showError('შეცდომა ცარიელი პროექტის შექმნისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error creating empty project:', error);
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}


// რედაქტირების მოდალში გალერეის ფოტოების ჩატვირთვა
function loadEditGalleryPhotos(project) {
    const galleryContainer = document.getElementById('editGalleryPhotos');
    if (!galleryContainer) return;
    
    // გასუფთავება
    galleryContainer.innerHTML = '';
    
    if (!project.photos || project.photos.length === 0) {
        const noPhotosMessage = document.createElement('div');
        noPhotosMessage.style.cssText = 'text-align: center; color: #666; padding: 20px; font-size: 16px; width: 100%;';
        noPhotosMessage.textContent = 'გალერეის ფოტოები არ არის დამატებული';
        galleryContainer.appendChild(noPhotosMessage);
        return;
    }
    
    // ჩატვირთოს ყველა ფოტო
    project.photos.forEach((photoUrl, index) => {
        const photoDiv = document.createElement('div');
        photoDiv.style.cssText = 'position: relative; display: inline-block; margin: 5px;';
        photoDiv.innerHTML = `
            <img src="${photoUrl}" alt="გალერეის ფოტო" style="width: 120px; height: 120px; object-fit: cover; border-radius: 5px; border: 2px solid #ddd;">
            <button 
                onclick="deletePhotoFromProject(${project.id}, ${index})" 
                style="
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    width: 25px;
                    height: 25px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "
                title="ფოტოს წაშლა"
            >
                ×
            </button>
        `;
        galleryContainer.appendChild(photoDiv);
    });
}

// პროექტში ფოტოების დამატება
function addPhotosToProject(projectId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        try {
            // შექმნას FormData
            const formData = new FormData();
            files.forEach(file => {
                formData.append('photos', file);
            });
            
            console.log(`Adding ${files.length} photos to project ${projectId}`);
            
            const response = await secureFetch(`/api/projects/${projectId}/photos`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Add photos response:', data);
            
            if (data.success) {
                console.log('Photos added successfully');
                showSuccess(`${data.message}`);
                
                // განაახლოს პროექტის მონაცემები
                const project = projectsCards.find(p => p.id === projectId);
                if (project) {
                    project.photos = data.project.photos;
                    loadEditGalleryPhotos(project);
                }
                
                // განაახლოს მთავარი ქარდების სია
                await loadCardsFromAPI();
                // განაახლოს მთავარი გვერდი (თუ ის ღიაა)
                refreshMainPageIfOpen();
            } else {
                console.error('Add photos failed:', data.error);
                showError('შეცდომა ფოტოების დამატებისას: ' + data.error);
            }
        } catch (error) {
            console.error('Error adding photos:', error);
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    };
    input.click();
}

// პროექტიდან ფოტოს წაშლა
async function deletePhotoFromProject(projectId, photoIndex) {
    const project = projectsCards.find(p => p.id === projectId);
    if (!project || !project.photos || photoIndex >= project.photos.length) {
        showError('ფოტო ვერ მოიძებნა');
        return;
    }
    
    if (confirm('ნამდვილად გსურთ ფოტოს წაშლა?')) {
        try {
            const photoUrl = project.photos[photoIndex];
            
            console.log(`Deleting photo ${photoIndex} from project ${projectId}, URL: ${photoUrl}`);
            
            // შექმნას FormData
            const formData = new FormData();
            formData.append('photo_url', photoUrl);
            
            const response = await secureFetch(`/api/projects/${projectId}/photos`, {
                method: 'DELETE',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Delete photo response:', data);
            
            if (data.success) {
                console.log('Photo deleted successfully');
                showSuccess('ფოტო წარმატებით წაიშალა');
                
                // განაახლოს პროექტის მონაცემები
                project.photos = data.project.photos;
                loadEditGalleryPhotos(project);
                
                // განაახლოს მთავარი ქარდების სია
                await loadCardsFromAPI();
            } else {
                console.error('Delete photo failed:', data.error);
                showError('შეცდომა ფოტოს წაშლისას: ' + data.error);
            }
            
        } catch (error) {
            console.error('Error deleting photo:', error);
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    }
}

// მთავარი ფოტოს შეცვლა
function changeMainImage(projectId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            // შექმნას FormData
            const formData = new FormData();
            formData.append('main_image', file);
            
            console.log(`Updating main image for project ${projectId}`);
            
            const response = await secureFetch(`/api/projects/${projectId}/main-image`, {
                method: 'PUT',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Update main image response:', data);
            
            if (data.success) {
                console.log('Main image updated successfully');
                showSuccess('მთავარი ფოტო წარმატებით განახლდა');
                
                // განაახლოს პროექტის მონაცემები
                const project = projectsCards.find(p => p.id === projectId);
                if (project) {
                    project.main_image_url = data.project.main_image_url;
                    updateMainImageDisplay(projectId, data.project.main_image_url);
                }
                
                // განაახლოს მთავარი ქარდების სია
                await loadCardsFromAPI();
            } else {
                console.error('Update main image failed:', data.error);
                showError('შეცდომა მთავარი ფოტოს განახლებისას: ' + data.error);
            }
        } catch (error) {
            console.error('Error updating main image:', error);
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    };
    input.click();
}

// მთავარი ფოტოს წაშლა
async function deleteMainImage(projectId) {
    if (confirm('ნამდვილად გსურთ მთავარი ფოტოს წაშლა?')) {
        try {
            console.log(`Deleting main image for project ${projectId}`);
            
            const response = await secureFetch(`/api/projects/${projectId}/main-image`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Delete main image response:', data);
            
            if (data.success) {
                console.log('Main image deleted successfully');
                showSuccess('მთავარი ფოტო წარმატებით წაიშალა');
                
                // განაახლოს პროექტის მონაცემები
                const project = projectsCards.find(p => p.id === projectId);
                if (project) {
                    project.main_image_url = data.project.main_image_url;
                    updateMainImageDisplay(projectId, data.project.main_image_url);
                }
                
                // განაახლოს მთავარი ქარდების სია
                await loadCardsFromAPI();
            } else {
                console.error('Delete main image failed:', data.error);
                showError('შეცდომა მთავარი ფოტოს წაშლისას: ' + data.error);
            }
            
        } catch (error) {
            console.error('Error deleting main image:', error);
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    }
}

// მთავარი ფოტოს ჩვენების განახლება რედაქტირების მოდალში
function updateMainImageDisplay(projectId, newImageUrl) {
    const mainImageContainer = document.getElementById('mainImageContainer');
    if (!mainImageContainer) return;
    
    const project = projectsCards.find(p => p.id === projectId);
    if (!project) return;
    
    // განაახლოს პროექტის მონაცემები
    project.main_image_url = newImageUrl;
    
    // მთლიანად განაახლოს HTML
    if (newImageUrl && newImageUrl.trim() !== '') {
        mainImageContainer.parentElement.innerHTML = `
            <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">მთავარი ფოტო:</label>
            <div id="mainImageContainer" style="text-align: center; margin-bottom: 10px; position: relative; display: inline-block;">
                <img src="${newImageUrl}" alt="მთავარი ფოტო" style="max-width: 200px; max-height: 150px; border-radius: 5px; border: 2px solid #ddd;">
                <button onclick="deleteMainImage(${projectId})" style="position: absolute; top: -5px; right: -5px; background: #dc3545; color: white; border: none; width: 25px; height: 25px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center;" title="მთავარი ფოტოს წაშლა">&times;</button>
            </div>
            <div style="text-align: center;">
                <button 
                    onclick="changeMainImage(${projectId})" 
                    style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    "
                >
                    მთავარი ფოტოს შეცვლა
                </button>
            </div>
        `;
    } else {
        mainImageContainer.parentElement.innerHTML = `
            <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">მთავარი ფოტო:</label>
            <div id="mainImageContainer" style="text-align: center; margin-bottom: 10px; position: relative; display: inline-block;">
                <div style="width: 200px; height: 150px; border: 2px dashed #ddd; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #666; background: #f8f9fa;">
                    <span>მთავარი ფოტო არ არის</span>
                </div>
            </div>
            <div style="text-align: center;">
                <button 
                    onclick="changeMainImage(${projectId})" 
                    style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    "
                >
                    მთავარი ფოტოს დამატება
                </button>
            </div>
        `;
    }
}

// ===== კარუსელის მართვის ფუნქციები =====
let carouselImages = [];  // კარუსელის ფოტოების მასივი

// კარუსელის ფოტოების ჩატვირთვა API-დან
async function loadCarouselImages() {
    try {
        console.log('Loading carousel images from API...');
        const response = await secureFetch('/api/carousel');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Carousel API response:', data);
        
        if (data.success) {
            carouselImages = data.images || [];
            console.log('Carousel images loaded successfully:', carouselImages);
            renderCarouselImages();
        } else {
            console.error('Carousel API returned error:', data.error);
            carouselImages = [];
            showCarouselError('შეცდომა კარუსელის ფოტოების ჩატვირთვისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error loading carousel images from API:', error);
        carouselImages = [];
        showCarouselError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// კარუსელის ფოტოების რენდერი
function renderCarouselImages() {
    const carouselGrid = document.getElementById('carouselGrid');
    if (!carouselGrid) return;
    
    if (carouselImages.length === 0) {
        carouselGrid.innerHTML = `
            <div class="carousel-no-images">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21,15 16,10 5,21"></polyline>
                </svg>
                <h4>კარუსელის ფოტოები არ არის</h4>
                <p>დაამატეთ პირველი ფოტო ქვემოთ მოცემული ღილაკის გამოყენებით</p>
            </div>
            <div class="carousel-add-card" onclick="showCarouselUploadModal()">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <h3>ახალი ფოტოს დამატება</h3>
                <p>დააჭირეთ აქ კარუსელში ახალი ფოტოს დასამატებლად</p>
            </div>
        `;
        return;
    }
    
    // დალაგება რიგის მიხედვით
    const sortedImages = carouselImages.sort((a, b) => a.order - b.order);
    
    carouselGrid.innerHTML = sortedImages.map(image => `
        <div class="carousel-card" data-image-id="${image.id}">
            <img src="${image.url}" alt="კარუსელის ფოტო" class="carousel-card-preview">
            <div class="carousel-card-info">
                <div class="carousel-card-title">
                    <span class="carousel-card-order">რიგი: ${image.order}</span>
                    <span class="carousel-card-status ${image.is_active ? 'active' : 'inactive'}">
                        ${image.is_active ? 'აქტიური' : 'არააქტიური'}
                    </span>
                </div>
                <div class="carousel-card-details">
                    ID: ${image.id}<br>
                    შექმნილი: ${new Date(image.created_at).toLocaleDateString('ka-GE')}
                </div>
                <div class="carousel-card-actions">
                    <button class="edit-order-btn" onclick="editCarouselImageOrder(${image.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        რიგის რედაქტირება
                    </button>
                    <button class="toggle-status-btn" onclick="toggleCarouselImageStatus(${image.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z"></path>
                            <path d="M3 12c-.552 0-1-.448-1-1s.448-1 1-1 1 .448 1 1-.448 1-1 1z"></path>
                        </svg>
                        ${image.is_active ? 'გათიშვა' : 'ჩართვა'}
                    </button>
                    <button class="delete-btn" onclick="deleteCarouselImage(${image.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        </svg>
                        წაშლა
                    </button>
                </div>
            </div>
        </div>
    `).join('') + `
        <div class="carousel-add-card" onclick="showCarouselUploadModal()">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <h3>ახალი ფოტოს დამატება</h3>
            <p>დააჭირეთ აქ კარუსელში ახალი ფოტოს დასამატებლად</p>
        </div>
    `;
}

// კარუსელის ფოტოს დამატება
async function addCarouselImage() {
    const form = document.getElementById('carouselUploadForm');
    const formData = new FormData(form);
    
    try {
        const response = await secureFetch('/api/carousel', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('ფოტო წარმატებით დაემატა კარუსელში');
            form.reset();
            loadCarouselImages(); // განაახლოს სია
            closeCarouselUploadModal(); // დახუროს მოდალური ფანჯარა
        } else {
            showCarouselError('შეცდომა ფოტოს დამატებისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error adding carousel image:', error);
        showCarouselError('შეცდომა ფოტოს დამატებისას: ' + error.message);
    }
}

// კარუსელის ფოტოს რიგის რედაქტირება
function editCarouselImageOrder(imageId) {
    const imageCard = document.querySelector(`[data-image-id="${imageId}"]`);
    const actionsDiv = imageCard.querySelector('.carousel-card-actions');
    
    // შექმნას input ველი რიგისთვის
    const orderInput = document.createElement('input');
    orderInput.type = 'number';
    orderInput.className = 'carousel-order-input';
    orderInput.value = carouselImages.find(img => img.id === imageId)?.order || 0;
    orderInput.min = '0';
    
    // შექმნას ღილაკები
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-order-btn';
    saveBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"></path>
        </svg>
        შენახვა
    `;
    saveBtn.onclick = () => saveCarouselImageOrder(imageId, orderInput.value);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-order-btn';
    cancelBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        გაუქმება
    `;
    cancelBtn.onclick = () => loadCarouselImages(); // განაახლოს ორიგინალური ვერსია
    
    // შეცვალოს actions div
    actionsDiv.innerHTML = '';
    actionsDiv.appendChild(orderInput);
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);
}

// კარუსელის ფოტოს რიგის შენახვა
async function saveCarouselImageOrder(imageId, newOrder) {
    try {
        const response = await secureFetch(`/api/carousel/${imageId}/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order: parseInt(newOrder) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('რიგი წარმატებით განახლდა');
            loadCarouselImages(); // განაახლოს სია
        } else {
            showCarouselError('შეცდომა რიგის განახლებისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error updating carousel image order:', error);
        showCarouselError('შეცდომა რიგის განახლებისას: ' + error.message);
    }
}

// კარუსელის ფოტოს სტატუსის შეცვლა
async function toggleCarouselImageStatus(imageId) {
    try {
        const response = await secureFetch(`/api/carousel/${imageId}/toggle`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess(data.message);
            loadCarouselImages(); // განაახლოს სია
        } else {
            showCarouselError('შეცდომა სტატუსის შეცვლისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error toggling carousel image status:', error);
        showCarouselError('შეცდომა სტატუსის შეცვლისას: ' + error.message);
    }
}

// კარუსელის ფოტოს წაშლა
async function deleteCarouselImage(imageId) {
    if (!confirm('ნამდვილად გსურთ ამ ფოტოს წაშლა კარუსელიდან?')) {
        return;
    }
    
    try {
        const response = await secureFetch(`/api/carousel/${imageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('ფოტო წარმატებით წაიშალა');
            loadCarouselImages(); // განაახლოს სია
        } else {
            showCarouselError('შეცდომა ფოტოს წაშლისას: ' + data.error);
        }
    } catch (error) {
        console.error('Error deleting carousel image:', error);
        showCarouselError('შეცდომა ფოტოს წაშლისას: ' + error.message);
    }
}

// კარუსელის შეცდომის ჩვენება
function showCarouselError(message) {
    const carouselGrid = document.getElementById('carouselGrid');
    if (carouselGrid) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'text-align: center; color: #dc3545; padding: 20px; font-size: 16px; width: 90%; margin: 0 auto; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;';
        errorDiv.textContent = message;
        carouselGrid.innerHTML = '';
        carouselGrid.appendChild(errorDiv);
    }
}

// კარუსელის წარმატების შეტყობინება
function showCarouselSuccess(message) {
    // შექმნას წარმატების შეტყობინება
    const successDiv = document.createElement('div');
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #d4edda; color: #155724; padding: 15px 20px; border-radius: 5px; border: 1px solid #c3e6cb; z-index: 9999; font-weight: bold;';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    // ავტომატურად წაიშალოს 3 წამის შემდეგ
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// კარუსელის ფოტოს ატვირთვის მოდალური ფანჯრის ჩვენება
function showCarouselUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'carousel-upload-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div class="carousel-upload-modal-content" style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #663399;">ახალი ფოტოს დამატება</h3>
                <button onclick="closeCarouselUploadModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6c757d;
                ">×</button>
            </div>
            <form id="carouselUploadForm" enctype="multipart/form-data">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #495057;">ფოტოს არჩევა:</label>
                    <input type="file" id="carouselImage" name="image" accept="image/*" required style="
                        width: 100%;
                        padding: 12px;
                        border: 2px dashed #dee2e6;
                        border-radius: 8px;
                        background: #f8f9fa;
                        font-size: 14px;
                        cursor: pointer;
                    ">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #495057;">რიგითობა:</label>
                    <input type="number" id="carouselOrder" name="order" value="0" min="0" style="
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #dee2e6;
                        border-radius: 8px;
                        font-size: 14px;
                    ">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="closeCarouselUploadModal()" style="
                        padding: 10px 20px;
                        border: 1px solid #dee2e6;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                    ">გაუქმება</button>
                    <button type="submit" style="
                        padding: 10px 20px;
                        border: none;
                        background: #663399;
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                    ">დამატება</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ფორმის submit event listener
    const form = modal.querySelector('#carouselUploadForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        addCarouselImage();
    });
}

// კარუსელის ფოტოს ატვირთვის მოდალური ფანჯრის დახურვა
function closeCarouselUploadModal() {
    const modal = document.querySelector('.carousel-upload-modal');
    if (modal) {
        modal.remove();
    }
}

// ფორმის submit event listener
document.addEventListener('DOMContentLoaded', function() {
    // კარუსელის ფოტოების ჩატვირთვა
    loadCarouselImages();
});
