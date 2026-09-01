// ===== ARCHUB - ადმინ პანელის JavaScript ფაილი =====
// ეს ფაილი შეიცავს ადმინ პანელის ფუნქციონალს
// პროექტების CRUD ოპერაციები, ფოტოების ატვირთვა, API კომუნიკაცია

// ===== სურათის დამუშავება პროექტებისთვის (1280x720, 16:9, ნაცრისფერი letterboxing) =====
async function processProjectImage(file, quality = 0.85) {
    const TARGET_WIDTH = 1280;
    const TARGET_HEIGHT = 720;
    const LETTERBOX_COLOR = '#e0e0e0'; // ნაცრისფერი
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = TARGET_WIDTH;
                canvas.height = TARGET_HEIGHT;
                
                const ctx = canvas.getContext('2d');
                
                // შევავსოთ ნაცრისფერით (letterboxing)
                ctx.fillStyle = LETTERBOX_COLOR;
                ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
                
                // გამოვთვალოთ ფოტოს ზომა და პოზიცია 16:9 ჩარჩოში
                const imgRatio = img.width / img.height;
                const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (imgRatio > targetRatio) {
                    // ფოტო უფრო განიერია - letterbox ზემოთ/ქვემოთ
                    drawWidth = TARGET_WIDTH;
                    drawHeight = TARGET_WIDTH / imgRatio;
                    drawX = 0;
                    drawY = (TARGET_HEIGHT - drawHeight) / 2;
                } else {
                    // ფოტო უფრო მაღალია - pillarbox გვერდებზე
                    drawHeight = TARGET_HEIGHT;
                    drawWidth = TARGET_HEIGHT * imgRatio;
                    drawX = (TARGET_WIDTH - drawWidth) / 2;
                    drawY = 0;
                }
                
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                
                canvas.toBlob((blob) => {
                    const processedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(processedFile);
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// რამდენიმე სურათის დამუშავება პროექტებისთვის
async function processProjectImages(files) {
    return Promise.all(files.map(file => processProjectImage(file)));
}

// ===== სურათის კომპრესია ჰედერის კარუსელისთვის (ორიგინალი პროპორცია) =====
async function compressImage(file, maxWidth = 1920, quality = 0.8) {
    return new Promise((resolve) => {
        // თუ ფაილი პატარაა (500KB-ზე ნაკლები), არ დავკომპრესოთ
        if (file.size < 500 * 1024) {
            resolve(file);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // შევამციროთ ზომა თუ საჭიროა
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// რამდენიმე სურათის კომპრესია (ჰედერის კარუსელისთვის)
async function compressImages(files) {
    return Promise.all(files.map(file => compressImage(file)));
}

// ===== გლობალური ცვლადები =====
let projectsCards = [];  // პროექტების მასივი
let galleryPhotos = [];  // გალერეის ფოტოების მასივი

function getSafeAdminUploadedImageUrl(value) {
    if (typeof value !== 'string') return null;
    const rawValue = value.trim().replace(/\\/g, '/');
    if (!rawValue || rawValue.startsWith('//')) return null;

    try {
        const decodedRawPath = decodeURIComponent(rawValue).split(/[?#]/, 1)[0];
        if (decodedRawPath.split('/').includes('..')) return null;

        const candidate = new URL(rawValue, window.location.origin);
        if (candidate.origin !== window.location.origin || candidate.username || candidate.password) {
            return null;
        }
        const pathname = decodeURIComponent(candidate.pathname);
        const allowedUpload = /^\/static\/uploads\/(?:main|gallery|carousel)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|gif|webp)$/i;
        return allowedUpload.test(pathname) ? pathname : null;
    } catch (error) {
        return null;
    }
}

function createAdminUploadedImage(value, altText, className = '') {
    const safeUrl = getSafeAdminUploadedImageUrl(value);
    if (!safeUrl) return null;
    const image = document.createElement('img');
    image.src = safeUrl;
    image.alt = String(altText || '');
    image.loading = 'lazy';
    if (className) image.className = className;
    image.addEventListener('error', () => {
        if (image.parentNode) {
            image.replaceWith(createAdminImagePlaceholder('ფოტო ვერ ჩაიტვირთა'));
        }
    }, { once: true });
    return image;
}

function createAdminImagePlaceholder(message = 'ფოტო არ არის') {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.textContent = message;
    placeholder.style.cssText = 'width: 100%; min-height: 160px; background: #f8f9fa; border: 2px dashed #ddd; display: flex; align-items: center; justify-content: center; color: #666; font-size: 16px; box-sizing: border-box;';
    return placeholder;
}

function createAdminTextButton(text, className, clickHandler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', clickHandler);
    return button;
}

function getSafeNumericId(value) {
    const numericId = Number(value);
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

function createCarouselAddCard(includeDescription = false) {
    const addCard = document.createElement('div');
    addCard.className = 'carousel-add-card';
    addCard.setAttribute('role', 'button');
    addCard.tabIndex = 0;
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(svgNamespace, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1');
    const verticalLine = document.createElementNS(svgNamespace, 'line');
    verticalLine.setAttribute('x1', '12'); verticalLine.setAttribute('y1', '5');
    verticalLine.setAttribute('x2', '12'); verticalLine.setAttribute('y2', '19');
    const horizontalLine = document.createElementNS(svgNamespace, 'line');
    horizontalLine.setAttribute('x1', '5'); horizontalLine.setAttribute('y1', '12');
    horizontalLine.setAttribute('x2', '19'); horizontalLine.setAttribute('y2', '12');
    icon.append(verticalLine, horizontalLine);
    addCard.appendChild(icon);
    const title = document.createElement('h3');
    title.textContent = 'ახალი ფოტოს დამატება';
    addCard.appendChild(title);
    if (includeDescription) {
        const description = document.createElement('p');
        description.textContent = 'დააჭირეთ აქ კარუსელში ახალი ფოტოს დასამატებლად';
        addCard.appendChild(description);
    }
    const openModal = () => showCarouselUploadModal();
    addCard.addEventListener('click', openModal);
    addCard.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openModal();
        }
    });
    return addCard;
}

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
        const response = await secureFetch(API_BASE_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            projectsCards = data.projects || [];
            loadCardsList();
        } else {
            projectsCards = [];
            showError('შეცდომა მონაცემების ჩატვირთვისას: ' + data.error);
        }
    } catch (error) {
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
    const cardsGrid = document.getElementById('cardsGrid');
    if (!cardsGrid) return;
    
    // Clear only the cards, not the add-card-section
    cardsGrid.querySelectorAll('.card-item').forEach(card => card.remove());
    cardsGrid.querySelectorAll('[style*="text-align: center"]').forEach(msg => msg.remove());
    
    projectsCards.forEach(card => {
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';

        const preview = document.createElement('div');
        preview.className = 'card-preview';
        const image = createAdminUploadedImage(card.main_image_url, 'ქარდი');
        preview.appendChild(image || createAdminImagePlaceholder());

        const details = document.createElement('div');
        details.className = 'card-details';
        const area = document.createElement('div');
        area.className = 'card-area';
        area.textContent = String(card.area || '');
        details.appendChild(area);

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const projectId = getSafeNumericId(card.id);
        if (projectId) {
            actions.append(
                createAdminTextButton('რედაქტირება', 'edit-btn', () => editCard(projectId)),
                createAdminTextButton('წაშლა', 'delete-btn', () => deleteCard(projectId))
            );
        }

        cardItem.append(preview, details, actions);
        cardsGrid.appendChild(cardItem);
    });
    
    // Add the "Add Project" button as a card-like element after all projects
    const addCardItem = document.createElement('div');
    addCardItem.className = 'card-item';
    const addPreview = document.createElement('div');
    addPreview.className = 'card-preview';
    const addPrompt = createAdminImagePlaceholder('+ პროექტის დამატება');
    addPrompt.style.borderColor = '#007bff';
    addPrompt.style.color = '#007bff';
    addPrompt.style.fontWeight = 'bold';
    addPrompt.style.cursor = 'pointer';
    addPrompt.addEventListener('click', addNewCard);
    addPreview.appendChild(addPrompt);

    const addDetails = document.createElement('div');
    addDetails.className = 'card-details';
    const addArea = document.createElement('div');
    addArea.className = 'card-area';
    addArea.style.cssText = 'color: #007bff; font-weight: bold;';
    addArea.textContent = 'ახალი პროექტი';
    addDetails.appendChild(addArea);

    const addActions = document.createElement('div');
    addActions.className = 'card-actions';
    const addButton = createAdminTextButton('დამატება', 'edit-btn', addNewCard);
    addButton.style.background = '#007bff';
    addActions.appendChild(addButton);

    addCardItem.append(addPreview, addDetails, addActions);
    cardsGrid.appendChild(addCardItem);
}

// ქარდის წაშლა API-ით
async function deleteCard(projectId) {
    if (!confirm('ნამდვილად გსურთ ქარდის წაშლა? (გალერიის ფოტოებიც წაიშლება)')) return;
    
    try {
        const response = await secureFetch(`${API_BASE_URL}/${projectId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(`პროექტი ${data.project_info.area} წარმატებით წაიშალა`);
            await loadCardsFromAPI();
            refreshMainPageIfOpen();
        } else {
            showError('შეცდომა ქარდის წაშლისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// ===== რედაქტირების მოდალის გლობალური სტეიტი =====
let editModalState = {
    projectId: null,
    originalPhotos: [],      // თავდაპირველი ფოტოები
    currentPhotos: [],       // მიმდინარე ფოტოები (რიგითობით)
    mainPhotoIndex: 0,       // მთავარი ფოტოს ინდექსი
    originalMainIndex: 0,    // თავდაპირველი მთავარი ფოტოს ინდექსი
    originalArea: '',        // თავდაპირველი ფართობი
    hasChanges: false,       // არის თუ არა ცვლილება
    draggedItem: null        // გადასათრევი ელემენტი
};

// ქარდის რედაქტირება - მოდალური ფანჯრის გახსნა
function editCard(projectId) {
    const project = projectsCards.find(p => p.id === projectId);
    if (!project) {
        showError('პროექტი ვერ მოიძებნა');
        return;
    }
    
    // სტეიტის ინიციალიზაცია
    editModalState.projectId = projectId;
    const safePhotos = (Array.isArray(project.photos) ? project.photos : [])
        .map(getSafeAdminUploadedImageUrl)
        .filter(Boolean);
    const safeMainImageUrl = getSafeAdminUploadedImageUrl(project.main_image_url);
    editModalState.originalPhotos = [...safePhotos];
    editModalState.currentPhotos = [...safePhotos];
    editModalState.mainPhotoIndex = safeMainImageUrl
        ? safePhotos.findIndex(photoUrl => photoUrl === safeMainImageUrl)
        : 0;
    if (editModalState.mainPhotoIndex === -1) editModalState.mainPhotoIndex = 0;
    editModalState.originalMainIndex = editModalState.mainPhotoIndex;
    editModalState.originalArea = project.area || '';
    editModalState.hasChanges = false;
    
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div class="edit-modal-content" style="
            background: white;
            padding: 0;
            border-radius: 12px;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
            max-width: 900px;
            width: 95%;
            max-height: 90vh;
            overflow: hidden;
            position: relative;
        ">
            <!-- ჰედერი X ღილაკით -->
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 25px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
            ">
                <h2 style="margin: 0; color: #333; font-size: 20px;">პროექტის რედაქტირება</h2>
                <button 
                    onclick="closeEditModal()"
                    style="
                        background: none;
                        border: none;
                        font-size: 28px;
                        cursor: pointer;
                        color: #666;
                        padding: 0;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.background='#e0e0e0'; this.style.color='#333';"
                    onmouseout="this.style.background='none'; this.style.color='#666';"
                    title="დახურვა"
                >×</button>
            </div>
            
            <!-- კონტენტი -->
            <div style="padding: 25px; max-height: calc(90vh - 160px); overflow-y: auto;">
                <!-- ფართობის ველი -->
                <div style="margin-bottom: 25px;">
                    <label for="editArea" style="display: block; margin-bottom: 8px; font-weight: 600; color: #444; font-size: 14px;">ფართობი:</label>
                    <input 
                        type="text" 
                        id="editArea" 
                        value=""
                        oninput="markEditModalChanged()"
                        style="
                            width: 100%;
                            padding: 12px 15px;
                            border: 2px solid #ddd;
                            border-radius: 8px;
                            font-size: 16px;
                            box-sizing: border-box;
                            transition: border-color 0.2s;
                        "
                        onfocus="this.style.borderColor='#007bff';"
                        onblur="this.style.borderColor='#ddd';"
                        placeholder="მაგ: 120 კვ.მ"
                    >
                </div>
                
                <!-- ფოტოების სექცია -->
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <label style="font-weight: 600; color: #444; font-size: 14px;">
                            ფოტოები <span style="color: #888; font-weight: normal;">(გადაათრიეთ რიგის შესაცვლელად)</span>
                        </label>
                        <button 
                            onclick="addPhotosToProject(${projectId})" 
                            style="
                                background: #007bff;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                transition: background 0.2s;
                            "
                            onmouseover="this.style.background='#0056b3';"
                            onmouseout="this.style.background='#007bff';"
                        >
                            <span style="font-size: 18px;">+</span> ფოტოების დამატება
                        </button>
                    </div>
                    
                    <div id="editGalleryPhotos" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 15px;
                        min-height: 100px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        border: 2px dashed #ddd;
                    ">
                        <!-- ფოტოები აქ ჩაიტვირთება -->
                    </div>
                </div>
            </div>
            
            <!-- ფუტერი შენახვის ღილაკით -->
            <div style="
                padding: 20px 25px;
                border-top: 1px solid #e0e0e0;
                background: #f8f9fa;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            ">
                <button 
                    onclick="closeEditModal()" 
                    style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 500;
                        transition: background 0.2s;
                    "
                    onmouseover="this.style.background='#5a6268';"
                    onmouseout="this.style.background='#6c757d';"
                >
                    გაუქმება
                </button>
                <button 
                    onclick="saveProjectUpdate(${projectId})" 
                    style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 600;
                        transition: background 0.2s;
                    "
                    onmouseover="this.style.background='#1e7e34';"
                    onmouseout="this.style.background='#28a745';"
                >
                    შენახვა
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ფართობის მნიშვნელობის დაყენება
    const editAreaInput = document.getElementById('editArea');
    if (editAreaInput) editAreaInput.value = project.area || '';

    // ფოტოების ჩატვირთვა
    renderEditGalleryPhotos();
    
    // ფოკუსი
    setTimeout(() => {
        if (editAreaInput) {
            editAreaInput.focus();
            editAreaInput.select();
        }
    }, 100);
}

// ცვლილების მარკირება
function markEditModalChanged() {
    editModalState.hasChanges = true;
}

// მოდალის დახურვა (გაფრთხილებით)
function closeEditModal() {
    // შევამოწმოთ არის თუ არა ცვლილება
    const areaInput = document.getElementById('editArea');
    const currentArea = areaInput ? areaInput.value : '';
    
    const hasAreaChange = currentArea !== editModalState.originalArea;
    const hasOrderChange = JSON.stringify(editModalState.currentPhotos) !== JSON.stringify(editModalState.originalPhotos);
    const hasMainChange = editModalState.mainPhotoIndex !== editModalState.originalMainIndex;
    
    if (hasAreaChange || hasOrderChange || hasMainChange || editModalState.hasChanges) {
        if (!confirm('გაქვთ შეუნახავი ცვლილებები. ნამდვილად გსურთ დახურვა?')) {
            return;
        }
    }
    
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
    
    // სტეიტის გასუფთავება
    editModalState = {
        projectId: null,
        originalPhotos: [],
        currentPhotos: [],
        mainPhotoIndex: 0,
        originalMainIndex: 0,
        originalArea: '',
        hasChanges: false,
        draggedItem: null
    };
}

// პროექტის განახლების შენახვა (ფართობი, ფოტოების რიგი, მთავარი ფოტო)
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
        const formData = new FormData();
        formData.append('area', newArea);
        
        // ფოტოების რიგი და მთავარი ფოტო
        formData.append('photos_order', JSON.stringify(editModalState.currentPhotos));
        const mainPhotoUrl = editModalState.currentPhotos[editModalState.mainPhotoIndex] || '';
        formData.append('main_image_url', mainPhotoUrl);
        
        const response = await secureFetch(`${API_BASE_URL}/${projectId}`, { method: 'PUT', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(`პროექტი "${data.project.area}" წარმატებით განახლდა`);
            
            // სტეიტის გასუფთავება პირდაპირ (გაფრთხილების გარეშე)
            const modal = document.getElementById('editModal');
            if (modal) modal.remove();
            editModalState = {
                projectId: null,
                originalPhotos: [],
                currentPhotos: [],
                mainPhotoIndex: 0,
                originalMainIndex: 0,
                originalArea: '',
                hasChanges: false,
                draggedItem: null
            };
            
            await loadCardsFromAPI();
            refreshMainPageIfOpen();
        } else {
            showError('შეცდომა პროექტის განახლებისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// ===== ფოტოების რენდერინგი drag & drop-ით =====
function renderEditGalleryPhotos() {
    const galleryContainer = document.getElementById('editGalleryPhotos');
    if (!galleryContainer) return;

    galleryContainer.replaceChildren();

    if (editModalState.currentPhotos.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #888; padding: 40px 20px; font-size: 15px;';
        const icon = document.createElement('div');
        icon.style.cssText = 'font-size: 40px; margin-bottom: 10px;';
        icon.textContent = '📷';
        const message = document.createElement('div');
        message.textContent = 'ფოტოები არ არის დამატებული. დააჭირეთ „ფოტოების დამატება“ ღილაკს.';
        emptyState.append(icon, message);
        galleryContainer.appendChild(emptyState);
        return;
    }

    editModalState.currentPhotos.forEach((photoUrl, index) => {
        const photoDiv = document.createElement('div');
        photoDiv.className = 'photo-item';
        photoDiv.draggable = true;
        photoDiv.dataset.index = String(index);

        const isMain = index === editModalState.mainPhotoIndex;
        photoDiv.style.cssText = `position: relative; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: grab; transition: transform 0.2s, box-shadow 0.2s; border: ${isMain ? '3px solid #28a745' : '2px solid #e0e0e0'};`;

        const safePhotoUrl = getSafeAdminUploadedImageUrl(photoUrl);
        const preview = document.createElement('div');
        preview.style.cssText = 'width: 100%; aspect-ratio: 16/9; overflow: hidden;';
        if (safePhotoUrl) {
            const image = createAdminUploadedImage(safePhotoUrl, `პროექტის ფოტო ${index + 1}`);
            image.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            preview.appendChild(image);
        } else {
            preview.appendChild(createAdminImagePlaceholder('არასწორი ფოტო'));
        }

        const controls = document.createElement('div');
        controls.style.cssText = 'padding: 10px; background: #fafafa; display: flex; align-items: center; justify-content: space-between;';

        const mainLabel = document.createElement('label');
        mainLabel.style.cssText = `display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${isMain ? '#28a745' : '#666'}; font-weight: ${isMain ? '600' : '400'};`;
        const mainRadio = document.createElement('input');
        mainRadio.type = 'radio';
        mainRadio.name = 'mainPhoto';
        mainRadio.checked = isMain;
        mainRadio.style.cssText = 'cursor: pointer; accent-color: #28a745;';
        mainRadio.addEventListener('change', () => setMainPhoto(index));
        const mainLabelText = document.createElement('span');
        mainLabelText.textContent = isMain ? 'მთავარი' : 'მთავარად';
        mainLabel.append(mainRadio, mainLabelText);

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px;';
        const downloadButton = createAdminTextButton('⬇', '', () => {
            if (safePhotoUrl) downloadPhoto(safePhotoUrl, index);
        });
        downloadButton.title = 'ჩამოტვირთვა';
        downloadButton.disabled = !safePhotoUrl;
        downloadButton.style.cssText = 'background: #17a2b8; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px;';
        const removeButton = createAdminTextButton('×', '', () => removePhotoFromEdit(index));
        removeButton.title = 'წაშლა';
        removeButton.style.cssText = 'background: #dc3545; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;';
        buttons.append(downloadButton, removeButton);
        controls.append(mainLabel, buttons);
        photoDiv.append(preview, controls);

        if (isMain) {
            const badge = document.createElement('div');
            badge.style.cssText = 'position: absolute; top: 8px; left: 8px; background: #28a745; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;';
            badge.textContent = 'მთავარი';
            photoDiv.appendChild(badge);
        }

        // Drag & Drop ივენთები
        photoDiv.addEventListener('dragstart', handleDragStart);
        photoDiv.addEventListener('dragend', handleDragEnd);
        photoDiv.addEventListener('dragover', handleDragOver);
        photoDiv.addEventListener('drop', handleDrop);
        photoDiv.addEventListener('dragenter', handleDragEnter);
        photoDiv.addEventListener('dragleave', handleDragLeave);

        galleryContainer.appendChild(photoDiv);
    });
}

// მთავარი ფოტოს დაყენება
function setMainPhoto(index) {
    editModalState.mainPhotoIndex = index;
    editModalState.hasChanges = true;
    renderEditGalleryPhotos();
}

// ფოტოს წაშლა (მოდალიდან)
async function removePhotoFromEdit(index) {
    if (!confirm('ნამდვილად გსურთ ამ ფოტოს წაშლა?')) return;
    
    const photoUrl = editModalState.currentPhotos[index];
    const removingMainPhoto = index === editModalState.mainPhotoIndex;
    
    try {
        const endpoint = removingMainPhoto
            ? `/api/projects/${editModalState.projectId}/main-image`
            : `/api/projects/${editModalState.projectId}/photos`;
        const requestOptions = { method: 'DELETE' };
        if (!removingMainPhoto) {
            const formData = new FormData();
            formData.append('photo_url', photoUrl);
            requestOptions.body = formData;
        }
        const response = await secureFetch(endpoint, requestOptions);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            editModalState.currentPhotos = (
                Array.isArray(data.project?.photos) ? data.project.photos : []
            ).map(getSafeAdminUploadedImageUrl).filter(Boolean);
            const safeMainUrl = getSafeAdminUploadedImageUrl(
                data.project?.main_image_url
            );
            editModalState.mainPhotoIndex = safeMainUrl
                ? editModalState.currentPhotos.indexOf(safeMainUrl)
                : 0;
            if (editModalState.mainPhotoIndex < 0) {
                editModalState.mainPhotoIndex = 0;
            }
            
            editModalState.hasChanges = true;
            renderEditGalleryPhotos();
            showSuccess('ფოტო წაშლილია');
        } else {
            showError('შეცდომა ფოტოს წაშლისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// ფოტოს ჩამოტვირთვა
function downloadPhoto(photoUrl, index) {
    const safePhotoUrl = getSafeAdminUploadedImageUrl(photoUrl);
    if (!safePhotoUrl) return;
    const link = document.createElement('a');
    link.href = safePhotoUrl;
    link.download = `photo_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== Drag & Drop ფუნქციები =====
function handleDragStart(e) {
    editModalState.draggedItem = this;
    this.style.opacity = '0.5';
    this.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.style.cursor = 'grab';
    
    // ყველა ელემენტიდან drag-over კლასის მოხსნა
    document.querySelectorAll('.photo-item').forEach(item => {
        item.style.transform = '';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== editModalState.draggedItem) {
        this.style.transform = 'scale(1.02)';
        this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    }
}

function handleDragLeave(e) {
    this.style.transform = '';
    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
}

function handleDrop(e) {
    e.preventDefault();
    
    if (this === editModalState.draggedItem) return;
    
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = parseInt(this.dataset.index);
    
    // მასივში ელემენტების გადაადგილება
    const photos = editModalState.currentPhotos;
    const [movedPhoto] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, movedPhoto);
    
    // მთავარი ფოტოს ინდექსის კორექტირება
    if (editModalState.mainPhotoIndex === fromIndex) {
        editModalState.mainPhotoIndex = toIndex;
    } else if (fromIndex < editModalState.mainPhotoIndex && toIndex >= editModalState.mainPhotoIndex) {
        editModalState.mainPhotoIndex--;
    } else if (fromIndex > editModalState.mainPhotoIndex && toIndex <= editModalState.mainPhotoIndex) {
        editModalState.mainPhotoIndex++;
    }
    
    editModalState.hasChanges = true;
    renderEditGalleryPhotos();
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
    const galleryContainer = document.getElementById('galleryPhotosContainer');
    if (!galleryContainer) return;
    
    galleryContainer.replaceChildren();
    
    if (galleryPhotos.length === 0) {
        const noPhotosMessage = document.createElement('div');
        noPhotosMessage.style.cssText = 'text-align: center; color: #666; padding: 20px; font-size: 16px;';
        noPhotosMessage.textContent = 'გალერიის ფოტოები არ არის დამატებული';
        galleryContainer.appendChild(noPhotosMessage);
        return;
    }
    
    galleryPhotos.forEach((photo, index) => {
        const photoDiv = document.createElement('div');
        photoDiv.className = 'gallery-photo-item';
        photoDiv.style.cssText = 'margin: 10px; display: inline-block; text-align: center;';

        const image = createAdminUploadedImage(photo?.url, 'გალერიის ფოტო');
        if (image) {
            image.style.cssText = 'width: 150px; height: 150px; object-fit: cover; border-radius: 5px; border: 2px solid #ddd;';
            photoDiv.appendChild(image);
        } else {
            const placeholder = createAdminImagePlaceholder('არასწორი ფოტო');
            placeholder.style.cssText += 'width: 150px; height: 150px;';
            photoDiv.appendChild(placeholder);
        }

        const actions = document.createElement('div');
        actions.style.marginTop = '5px';
        const removeButton = createAdminTextButton('წაშლა', '', () => removeGalleryPhoto(index));
        removeButton.style.cssText = 'background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;';
        actions.appendChild(removeButton);
        photoDiv.appendChild(actions);
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
    loadCardsFromAPI();
    loadGalleryPhotosList();
});

// მთავარი გვერდის განახლება (თუ ის ღიაა)
function refreshMainPageIfOpen() {
    // ადმინისტრატორის გვერდი იგივე ფანჯარაში იხსნება
}

// მთავარ გვერდზე გადასვლა
function goToMainPage(event) {
    event.preventDefault();
    window.location.href = '/';
}

// ქარდის დამატების ღილაკის ფუნქცია
async function addNewCard() {
    try {
        const response = await secureFetch('/api/projects/empty', { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            await loadCardsFromAPI();
            refreshMainPageIfOpen();
        } else {
            showError('შეცდომა ცარიელი პროექტის შექმნისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}


// პროექტში ფოტოების დამატება (ახალი - 1280x720 letterboxing-ით)
function addPhotosToProject(projectId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        // Loading ინდიკატორი
        const galleryContainer = document.getElementById('editGalleryPhotos');
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'uploadLoading';
        loadingDiv.style.cssText = `
            grid-column: 1 / -1;
            text-align: center;
            padding: 30px;
            color: #666;
        `;
        const loadingIcon = document.createElement('div');
        loadingIcon.style.cssText = 'font-size: 24px; margin-bottom: 10px;';
        loadingIcon.textContent = '⏳';
        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = `იტვირთება ${files.length} ფოტო...`;
        const loadingDetails = document.createElement('div');
        loadingDetails.style.cssText = 'font-size: 12px; color: #888; margin-top: 5px;';
        loadingDetails.textContent = 'ზომის კორექტირება და კომპრესია';
        loadingDiv.append(loadingIcon, loadingMessage, loadingDetails);
        if (galleryContainer) galleryContainer.appendChild(loadingDiv);
        
        try {
            // დამუშავება: 1280x720 + ნაცრისფერი letterboxing
            const processedFiles = await processProjectImages(files);
            
            const formData = new FormData();
            processedFiles.forEach(file => formData.append('photos', file));
            
            const response = await secureFetch(`/api/projects/${projectId}/photos`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            // Loading-ის წაშლა
            const loading = document.getElementById('uploadLoading');
            if (loading) loading.remove();
            
            if (data.success) {
                showSuccess(`${files.length} ფოტო წარმატებით აიტვირთა`);
                
                // სტეიტის განახლება
                editModalState.currentPhotos = (Array.isArray(data.project?.photos) ? data.project.photos : [])
                    .map(getSafeAdminUploadedImageUrl)
                    .filter(Boolean);
                editModalState.hasChanges = true;
                
                // თუ მთავარი ფოტო არ იყო, პირველი გახდეს მთავარი
                if (editModalState.currentPhotos.length > 0 && editModalState.mainPhotoIndex >= editModalState.currentPhotos.length) {
                    editModalState.mainPhotoIndex = 0;
                }
                
                renderEditGalleryPhotos();
            } else {
                showError('შეცდომა ფოტოების დამატებისას: ' + data.error);
            }
        } catch (error) {
            const loading = document.getElementById('uploadLoading');
            if (loading) loading.remove();
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    };
    input.click();
}

// პროექტიდან ფოტოს წაშლა (ძველი ფუნქცია - თავსებადობისთვის)
async function deletePhotoFromProject(projectId, photoIndex) {
    const project = projectsCards.find(p => p.id === projectId);
    if (!project?.photos || photoIndex >= project.photos.length) {
        showError('ფოტო ვერ მოიძებნა');
        return;
    }
    
    if (!confirm('ნამდვილად გსურთ ფოტოს წაშლა?')) return;
    
    try {
        const formData = new FormData();
        formData.append('photo_url', project.photos[photoIndex]);
        
        const response = await secureFetch(`/api/projects/${projectId}/photos`, { method: 'DELETE', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('ფოტო წარმატებით წაიშალა');
            project.photos = data.project.photos;
            loadEditGalleryPhotos(project);
            await loadCardsFromAPI();
        } else {
            showError('შეცდომა ფოტოს წაშლისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
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
            // კომპრესია ატვირთვამდე
            const compressedFile = await compressImage(file);
            
            const formData = new FormData();
            formData.append('main_image', compressedFile);
            
            const response = await secureFetch(`/api/projects/${projectId}/main-image`, { method: 'PUT', body: formData });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            if (data.success) {
                showSuccess('მთავარი ფოტო წარმატებით განახლდა');
                const project = projectsCards.find(p => p.id === projectId);
                if (project) {
                    project.main_image_url = data.project.main_image_url;
                    updateMainImageDisplay(projectId, data.project.main_image_url);
                }
                await loadCardsFromAPI();
            } else {
                showError('შეცდომა მთავარი ფოტოს განახლებისას: ' + data.error);
            }
        } catch (error) {
            showError('შეცდომა API-თან კავშირისას: ' + error.message);
        }
    };
    input.click();
}

// მთავარი ფოტოს წაშლა
async function deleteMainImage(projectId) {
    if (!confirm('ნამდვილად გსურთ მთავარი ფოტოს წაშლა?')) return;
    
    try {
        const response = await secureFetch(`/api/projects/${projectId}/main-image`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('მთავარი ფოტო წარმატებით წაიშალა');
            const project = projectsCards.find(p => p.id === projectId);
            if (project) {
                project.main_image_url = data.project.main_image_url;
                updateMainImageDisplay(projectId, data.project.main_image_url);
            }
            await loadCardsFromAPI();
        } else {
            showError('შეცდომა მთავარი ფოტოს წაშლისას: ' + data.error);
        }
    } catch (error) {
        showError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// მთავარი ფოტოს ჩვენების განახლება რედაქტირების მოდალში
function updateMainImageDisplay(projectId, newImageUrl) {
    const mainImageContainer = document.getElementById('mainImageContainer');
    if (!mainImageContainer) return;

    const safeProjectId = getSafeNumericId(projectId);
    const project = projectsCards.find(p => p.id === safeProjectId);
    if (!project) return;

    const safeImageUrl = getSafeAdminUploadedImageUrl(newImageUrl);
    // განაახლოს პროექტის მონაცემები
    project.main_image_url = safeImageUrl || '';

    const wrapper = mainImageContainer.parentElement;
    if (!wrapper) return;
    wrapper.replaceChildren();

    const label = document.createElement('label');
    label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: bold; color: #555;';
    label.textContent = 'მთავარი ფოტო:';

    const display = document.createElement('div');
    display.id = 'mainImageContainer';
    display.style.cssText = 'text-align: center; margin-bottom: 10px; position: relative; display: inline-block;';

    if (safeImageUrl) {
        const image = createAdminUploadedImage(safeImageUrl, 'მთავარი ფოტო');
        image.style.cssText = 'max-width: 200px; max-height: 150px; border-radius: 5px; border: 2px solid #ddd;';
        display.appendChild(image);

        const deleteButton = createAdminTextButton('×', '', () => deleteMainImage(safeProjectId));
        deleteButton.title = 'მთავარი ფოტოს წაშლა';
        deleteButton.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #dc3545; color: white; border: none; width: 25px; height: 25px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center;';
        display.appendChild(deleteButton);
    } else {
        const placeholder = createAdminImagePlaceholder('მთავარი ფოტო არ არის');
        placeholder.style.cssText += 'width: 200px; height: 150px; border-radius: 5px;';
        display.appendChild(placeholder);
    }

    const actions = document.createElement('div');
    actions.style.textAlign = 'center';
    const changeButton = createAdminTextButton(
        safeImageUrl ? 'მთავარი ფოტოს შეცვლა' : 'მთავარი ფოტოს დამატება',
        '',
        () => changeMainImage(safeProjectId)
    );
    changeButton.style.cssText = 'background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 16px;';
    actions.appendChild(changeButton);
    wrapper.append(label, display, actions);
}

// ===== კარუსელის მართვის ფუნქციები =====
let carouselImages = [];  // კარუსელის ფოტოების მასივი

// კარუსელის ფოტოების ჩატვირთვა API-დან
async function loadCarouselImages() {
    try {
        const response = await secureFetch('/api/carousel/all');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            carouselImages = data.images || [];
            renderCarouselImages();
        } else {
            carouselImages = [];
            showCarouselError('შეცდომა კარუსელის ფოტოების ჩატვირთვისას: ' + data.error);
        }
    } catch (error) {
        carouselImages = [];
        showCarouselError('შეცდომა API-თან კავშირისას: ' + error.message);
    }
}

// კარუსელის ფოტოების რენდერი
function renderCarouselImages() {
    const carouselGrid = document.getElementById('carouselGrid');
    if (!carouselGrid) return;

    carouselGrid.replaceChildren();
    if (carouselImages.length === 0) {
        carouselGrid.appendChild(createCarouselAddCard());
        return;
    }

    // დალაგება რიგის მიხედვით
    const sortedImages = [...carouselImages].sort(
        (a, b) => Number(a.order || 0) - Number(b.order || 0)
    );

    sortedImages.forEach(imageData => {
        const imageId = getSafeNumericId(imageData.id);
        if (!imageId) return;

        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.dataset.imageId = String(imageId);

        const image = createAdminUploadedImage(imageData.url, 'კარუსელის ფოტო', 'carousel-card-preview');
        card.appendChild(image || createAdminImagePlaceholder('არასწორი ფოტო'));

        const info = document.createElement('div');
        info.className = 'carousel-card-info';
        const title = document.createElement('div');
        title.className = 'carousel-card-title';
        const order = document.createElement('span');
        order.className = 'carousel-card-order';
        order.textContent = `რიგი: ${Number(imageData.order || 0)}`;
        const status = document.createElement('span');
        status.className = 'carousel-card-status';
        status.classList.add(imageData.is_active ? 'active' : 'inactive');
        status.textContent = imageData.is_active ? 'აქტიური' : 'არააქტიური';
        title.append(order, status);

        const details = document.createElement('div');
        details.className = 'carousel-card-details';
        const createdDate = new Date(imageData.created_at);
        const createdText = Number.isNaN(createdDate.getTime())
            ? '—'
            : createdDate.toLocaleDateString('ka-GE');
        details.textContent = `ID: ${imageId} · შექმნილი: ${createdText}`;

        const actions = document.createElement('div');
        actions.className = 'carousel-card-actions';
        actions.append(
            createAdminTextButton('რიგი', 'edit-order-btn', () => editCarouselImageOrder(imageId)),
            createAdminTextButton(
                imageData.is_active ? 'გათიშვა' : 'ჩართვა',
                'toggle-status-btn',
                () => toggleCarouselImageStatus(imageId)
            ),
            createAdminTextButton('წაშლა', 'delete-btn', () => deleteCarouselImage(imageId))
        );

        info.append(title, details, actions);
        card.appendChild(info);
        carouselGrid.appendChild(card);
    });

    carouselGrid.appendChild(createCarouselAddCard(true));
}

// კარუსელის ფოტოს დამატება
async function addCarouselImage() {
    const form = document.getElementById('carouselUploadForm');
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput?.files[0];
    
    if (!file) {
        showCarouselError('გთხოვთ აირჩიოთ ფოტო');
        return;
    }
    
    try {
        // კომპრესია ატვირთვამდე
        const compressedFile = await compressImage(file);
        
        const formData = new FormData();
        formData.append('image', compressedFile);
        
        // დავამატოთ სხვა ველებიც თუ არსებობს
        const orderInput = form.querySelector('input[name="order"]');
        if (orderInput) {
            formData.append('order', orderInput.value);
        }
        
        const response = await secureFetch('/api/carousel', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('ფოტო წარმატებით დაემატა კარუსელში');
            form.reset();
            loadCarouselImages();
            closeCarouselUploadModal();
        } else {
            showCarouselError('შეცდომა ფოტოს დამატებისას: ' + data.error);
        }
    } catch (error) {
        showCarouselError('შეცდომა ფოტოს დამატებისას: ' + error.message);
    }
}

// კარუსელის ფოტოს რიგის რედაქტირება
function editCarouselImageOrder(imageId) {
    const safeImageId = getSafeNumericId(imageId);
    if (!safeImageId) return;
    const imageCard = Array.from(document.querySelectorAll('[data-image-id]'))
        .find(card => card.dataset.imageId === String(safeImageId));
    const actionsDiv = imageCard?.querySelector('.carousel-card-actions');
    if (!actionsDiv) return;
    
    const orderInput = document.createElement('input');
    orderInput.type = 'number';
    orderInput.className = 'carousel-order-input';
    orderInput.value = carouselImages.find(img => img.id === safeImageId)?.order || 0;
    orderInput.min = '0';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'save-order-btn';
    saveBtn.textContent = '✓ შენახვა';
    saveBtn.onclick = () => saveCarouselImageOrder(safeImageId, orderInput.value);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cancel-order-btn';
    cancelBtn.textContent = '× გაუქმება';
    cancelBtn.onclick = () => loadCarouselImages();
    
    actionsDiv.replaceChildren(orderInput, saveBtn, cancelBtn);
}

// კარუსელის ფოტოს რიგის შენახვა
async function saveCarouselImageOrder(imageId, newOrder) {
    try {
        const response = await secureFetch(`/api/carousel/${imageId}/order`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: parseInt(newOrder) })
        });
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('რიგი წარმატებით განახლდა');
            loadCarouselImages();
        } else {
            showCarouselError('შეცდომა რიგის განახლებისას: ' + data.error);
        }
    } catch (error) {
        showCarouselError('შეცდომა რიგის განახლებისას: ' + error.message);
    }
}

// კარუსელის ფოტოს სტატუსის შეცვლა
async function toggleCarouselImageStatus(imageId) {
    try {
        const response = await secureFetch(`/api/carousel/${imageId}/toggle`, { method: 'PUT' });
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess(data.message);
            loadCarouselImages();
        } else {
            showCarouselError('შეცდომა სტატუსის შეცვლისას: ' + data.error);
        }
    } catch (error) {
        showCarouselError('შეცდომა სტატუსის შეცვლისას: ' + error.message);
    }
}

// კარუსელის ფოტოს წაშლა
async function deleteCarouselImage(imageId) {
    if (!confirm('ნამდვილად გსურთ ამ ფოტოს წაშლა კარუსელიდან?')) return;
    
    try {
        const response = await secureFetch(`/api/carousel/${imageId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showCarouselSuccess('ფოტო წარმატებით წაიშალა');
            loadCarouselImages();
        } else {
            showCarouselError('შეცდომა ფოტოს წაშლისას: ' + data.error);
        }
    } catch (error) {
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
        carouselGrid.replaceChildren(errorDiv);
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
