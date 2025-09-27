// ===== ARCHUB - მთავარი JavaScript ფაილი =====
// ეს ფაილი შეიცავს მთავარი გვერდის ფუნქციონალს
// ავტორიზაცია, პროექტების ჩატვირთვა, კონტაქტ ფორმა

document.addEventListener('DOMContentLoaded', function() {
    // ===== CSRF Token-ის წამოღება =====
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // ===== უსაფრთხო fetch ფუნქცია =====
    const secureFetch = async (url, options = {}) => {
        // ჰედერების დამატება
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            ...options.headers,
        };
        
        // მოთხოვნის გაგზავნა
        return fetch(url, { ...options, headers });
    };
    
    // ===== კარუსელის ფოტოების ჩატვირთვა =====
    loadCarouselImages();
    
    // ===== ელემენტების არჩევა =====
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const mobileMyPageBtn = document.getElementById('mobileMyPageBtn');
    const showRegisterModalLink = document.getElementById('showRegisterModal');
    const showLoginModalLink = document.getElementById('showLoginModal');
    
    // ===== გლობალური ცვლადები =====
    // ავტორიზაციის სტატუსის თვალყურის დევნება
    let userAuthenticated = false;
    let currentUser = null;
    
    // --- ავტორიზაციის სტატუსის შემოწმება ---
    async function checkAuthStatus() {
        try {
            console.log('Checking auth status...');
            const response = await fetch('/api/status');
            const data = await response.json();
            console.log('Auth status response:', data);
            
            if (data.logged_in) {
                userAuthenticated = true;
                currentUser = data.user;
                updateAuthButtons('logout');
                console.log('User is authenticated:', currentUser);
            } else {
                userAuthenticated = false;
                currentUser = null;
                updateAuthButtons('login');
                console.log('User is not authenticated');
            }
            
            // ავტორიზაციის სტატუსის გლობალურად ხელმისაწვდომად გაკეთება
            window.userAuthenticated = userAuthenticated;
            console.log('window.userAuthenticated set to:', window.userAuthenticated);
            
            // ლაიქების ღილაკების ხელახალი რენდერი ავტორიზაციის სტატუსის შემოწმების შემდეგ
            if (typeof renderProjectsCards === 'function') {
                renderProjectsCards();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            userAuthenticated = false;
            currentUser = null;
            updateAuthButtons('login');
            window.userAuthenticated = false;
        }
    }
    
    // --- ავტორიზაციის ღილაკების განახლება ---
    function updateAuthButtons(state) {
        if (state === 'logout') {
            if (authBtn) {
                authBtn.textContent = 'გასვლა';
                authBtn.onclick = handleLogout;
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'გასვლა';
                mobileAuthBtn.onclick = handleLogout;
            }
            // ჩემი გვერდის ღილაკების ჩვენება შესვლისას
            if (myPageBtn) {
                myPageBtn.style.display = 'block';
                myPageBtn.onclick = () => window.location.href = '/my-page';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.style.display = 'block';
                mobileMyPageBtn.onclick = () => window.location.href = '/my-page';
            }
        } else {
            if (authBtn) {
                authBtn.textContent = 'შესვლა';
                authBtn.onclick = () => openModal('loginModal');
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'შესვლა';
                mobileAuthBtn.onclick = () => openModal('loginModal');
            }
            // ჩემი გვერდის ღილაკების დამალვა გამოსვლისას
            if (myPageBtn) {
                myPageBtn.style.display = 'none';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.style.display = 'none';
            }
        }
    }
    
    // --- გასვლის დამუშავება ---
    async function handleLogout() {
        try {
            const response = await secureFetch('/api/logout', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                userAuthenticated = false;
                currentUser = null;
                window.userAuthenticated = false;
                updateAuthButtons('login');
                // ლაიქების ღილაკების ხელახალი რენდერი გამოსვლის შემდეგ
                renderProjectsCards();
                alert('წარმატებით გამოხვედით სისტემიდან!');
                // გადამისამართება მთავარ გვერდზე, რათა თავიდან ავიცილოთ შეცდომები დაცულ გვერდებზე
                window.location.href = '/';
            } else {
                alert('შეცდომა გასვლისას: ' + (data.error || 'უცნობი შეცდომა'));
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('შეცდომა სერვერთან კავშირისას.');
        }
    }
    
    // --- მოდალური ფანჯრების მართვა ---
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // ყველა დახურვის ღილაკზე მოსმენის დამატება
    document.querySelectorAll('.auth-modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.auth-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- ავტორიზაციის ღილაკების მოვლენები ---
    // ეს განისაზღვრება updateAuthButtons ფუნქციით ავტორიზაციის სტატუსის მიხედვით

    // --- მოდალური ფანჯრების გადართვა ---
    if (showRegisterModalLink) {
        showRegisterModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('loginModal');
            openModal('registerModal');
        });
    }

    if (showLoginModalLink) {
        showLoginModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('registerModal');
            openModal('loginModal');
        });
    }
    
    // --- შესვლის ფორმის გაგზავნა ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'შესვლა...';

            try {
                const response = await secureFetch('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    userAuthenticated = true;
                    currentUser = result.user;
                    window.userAuthenticated = true;
                    updateAuthButtons('logout');
                    // ლაიქების ღილაკების ხელახალი რენდერი ავტორიზაციის შემდეგ
                    renderProjectsCards();
                    alert('წარმატებით შეხვედით სისტემაში!');
                    closeModal('loginModal');
                } else {
                    alert('შეცდომა: ' + result.error);
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'შესვლა';
            }
        });
    }

    // --- რეგისტრაციის ფორმის გაგზავნა ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'რეგისტრაცია...';

            try {
                const response = await secureFetch('/api/register', {
                    method: 'POST',
                    body: JSON.stringify({ username, email, password })
                });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                    closeModal('registerModal');
                    openModal('loginModal');
                } else {
                    alert('შეცდომა: ' + result.error);
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'რეგისტრაცია';
            }
        });
    }


    // --- მობილური მენიუ ---
    const burger = document.querySelector('.burger-menu');
    const panel = document.getElementById('mobileNavPanel');
    const icon = document.querySelector('.burger-icon');
    const body = document.body;

    function toggleMobileMenu() {
        panel.classList.toggle('active');
        icon.classList.toggle('active');
        body.classList.toggle('nav-open');
    }

    function closeMobileMenu() {
        panel.classList.remove('active');
        icon.classList.remove('active');
        body.classList.remove('nav-open');
    }

    if (burger) {
        burger.addEventListener('click', toggleMobileMenu);
    }
    
    document.querySelectorAll('.mobile-nav-link, .mobile-auth-btn, #mobileNavClose').forEach(btn => {
        btn.addEventListener('click', closeMobileMenu);
    });

    // --- პროექტების ღილაკი ---
    const projectsBtn = document.querySelector('.projects-btn');
    if (projectsBtn) {
        projectsBtn.addEventListener('click', () => {
            window.open('https://gipc.ge', '_blank');
        });
    }

    // Close mobile menu on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMobileMenu();
    });


    // --- პროექტების კარუსელი ---
let projectsCards = [];
let currentCardIndex = 0;
let projectsIsTransitioning = false;
let cardsContainer = null;
let totalCards = 0;

window.initProjectsCarousel = async function initProjectsCarousel() {
    // Use the existing Section 2 container directly
    cardsContainer = document.getElementById('cardsWrapper');
    if (!cardsContainer) return;

    await loadCardsFromAPI();
    renderProjectsCards();
    
    // Initialize Section 2 arrows
    initSection2Arrows();
}

// ===== სექცია 3 - პროექტების გრიდი =====
window.initSection3Projects = async function initSection3Projects() {
    const projectsGrid = document.getElementById('projectsGrid');
    
    if (!projectsGrid) {
        console.log('Projects grid not found');
        return;
    }
    
    try {
        // Load projects from API (same data as section 2)
        const response = await fetch('/api/projects');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            // Clear existing content
            projectsGrid.innerHTML = '';
            
            // Create project cards
            data.projects.forEach(project => {
                const cardElement = createSection3CardElement(project);
                projectsGrid.appendChild(cardElement);
            });
            
            console.log(`Section 3: Loaded ${data.projects.length} projects`);
        } else {
            console.error('Failed to load projects for section 3:', data.error);
            projectsGrid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">პროექტები ვერ ჩაიტვირთა</div>';
        }
    } catch (error) {
        console.error('Error loading projects for section 3:', error);
        projectsGrid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">შეცდომა პროექტების ჩატვირთვისას</div>';
    }
}

// Create card element for section 3
function createSection3CardElement(project) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-project-id', project.id);
    
    // Create like button HTML (only for authenticated users)
    const likeButtonHtml = (window.userAuthenticated) ? `
        <button class="like-btn ${project.is_liked ? 'liked' : ''}" data-project-id="${project.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${project.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
    ` : '';
    
    cardElement.innerHTML = `
        <img src="${project.main_image_url}" class="card-image" alt="${project.area}">
        <div class="card-info">
            <div class="card-area">${project.area}</div>
        </div>
        ${likeButtonHtml}
    `;
    
    // Add click event to open gallery
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Create project object with photos array
        const projectWithPhotos = {
            id: project.id,
            area: project.area,
            main_image_url: project.main_image_url,
            photos: project.photos || [],
            is_liked: project.is_liked,
            likes_count: project.likes_count
        };
        
        // Open gallery modal (same as section 2)
        openGalleryForCard(projectWithPhotos);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(project.id, likeBtn);
        });
    }
    
    return cardElement;
}

    // ქარდების ჩატვირთვა API-დან
async function loadCardsFromAPI() {
    try {
        const response = await fetch('/api/projects');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsCards = data.projects.map(project => {
                // Create photos array with main image first, then gallery photos
                const allPhotos = [];
                if (project.main_image_url) {
                    allPhotos.push({
                        url: project.main_image_url,
                        title: 'მთავარი ფოტო'
                    });
                }
                if (project.photos && project.photos.length > 0) {
                    project.photos.forEach(photoUrl => {
                        allPhotos.push({
                            url: photoUrl,
                            title: 'პროექტის ფოტო'
                        });
                    });
                }
                
                return {
                    id: project.id,
                    title: project.title || '',
                    description: project.description || '',
                    area: project.area,
                    image: project.main_image_url,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: allPhotos
                };
            });
            
            // ძებნისთვის ყველა პროექტის შენახვა
            allProjects = [...projectsCards];
            
            totalCards = projectsCards.length;
        } else {
            createRandomCards();
        }
    } catch (error) {
        console.error('Error loading cards from API:', error);
        createRandomCards();
    }
}

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
        title: `პროექტი ${index + 1}`,
        description: `ეს არის ${index + 1}-ე პროექტის აღწერა`,
        area: card.area,
        image: card.image,
        link: `card-detail.html?id=card-${index}`,
        photos: [{
            url: card.image,
            title: 'მთავარი ფოტო'
        }]
    }));
    
    // ძებნისთვის ყველა პროექტის შენახვა
    allProjects = [...projectsCards];
    
    totalCards = projectsCards.length;
}

function renderProjectsCards() {
    if (!cardsContainer || !projectsCards.length) return;

    console.log(`Rendering ${projectsCards.length} cards, totalCards=${totalCards}`);
    cardsContainer.innerHTML = '';

    // Render a single set of cards (no cloning, no arrows)
    projectsCards.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        cardsContainer.appendChild(cardElement);
    });
}

function createCardElement(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-original-index', index);
    cardElement.setAttribute('data-project-id', card.id);
    // Use background image for the card
    if (card.image) {
        cardElement.style.backgroundImage = `url('${card.image}')`;
        cardElement.style.backgroundSize = 'cover';
        cardElement.style.backgroundPosition = 'center';
        cardElement.style.backgroundRepeat = 'no-repeat';
    }
    
    // Create like button HTML (only for authenticated users)
    const likeButtonHtml = (window.userAuthenticated) ? `
        <button class="like-btn ${card.is_liked ? 'liked' : ''}" data-project-id="${card.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${card.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
    ` : '';
    
    cardElement.innerHTML = `
        <div class="card-info">
            <div class="card-area">${card.area}</div>
            ${card.title ? `<div class="card-title" style="display: none;">${card.title}</div>` : ''}
            ${card.description ? `<div class="card-description" style="display: none;">${card.description}</div>` : ''}
        </div>
        ${likeButtonHtml}
    `;
    
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Store the original index of the card
        card.originalIndex = index;
        
        // Navigate to gallery page with card data
        openGalleryForCard(card);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(card.id, likeBtn);
        });
    }
    
    return cardElement;
}

function moveCarousel(direction) {
    if (!cardsContainer) return;
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    if (!projectCards.length) return;
    
    // infinite: allow index to move, but clamp the element index we scroll to
    currentCardIndex += direction;
    const clampedIndex = Math.max(0, Math.min(projectCards.length - 1, currentCardIndex));
    projectCards[clampedIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    // After scroll animation, snap back to middle clone range
    setTimeout(() => {
        resetCarouselPositionIfNeeded();
    }, 360);
}

// ძებნის რეჟიმში შემდეგ/წინა ნაპოვნ პროექტზე გადასვლა
function moveToNextFoundProject(direction) {
    if (filteredProjects.length === 0) return;
    
    // მიმდინარე ნაპოვნი პროექტის ინდექსის განახლება
    searchCurrentIndex += direction;
    
    // ციკლური ნავიგაცია
    if (searchCurrentIndex >= filteredProjects.length) {
        searchCurrentIndex = 0;
    } else if (searchCurrentIndex < 0) {
        searchCurrentIndex = filteredProjects.length - 1;
    }
    
    // შემდეგი ნაპოვნი პროექტის ქარდის პოვნა
    const targetProject = filteredProjects[searchCurrentIndex];
    const cardsContainer = document.querySelector('.cards-container');
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    
    const targetCard = Array.from(projectCards).find(card => 
        card.dataset.projectId == targetProject.id
    );
    
    if (targetCard) {
        scrollToCard(targetCard);
    }
    
    setTimeout(() => {
        projectsIsTransitioning = false;
    }, 500);
}

function resetCarouselPositionIfNeeded() {
    if (!cardsContainer) return;
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    const original = totalCards;
    if (original === 0 || projectCards.length === 0) return;

    const minMiddle = original; // first index of the middle set
    const maxMiddle = original * 2 - 1; // last index of the middle set

    // helper: compute total width (card + gap)
    const getCardStep = () => {
        if (projectCards.length < 2) {
            // fallback to measured width or default gap 30
            const w = projectCards[0]?.getBoundingClientRect().width || 450;
            return w + 30;
        }
        const r1 = projectCards[0].getBoundingClientRect();
        const r2 = projectCards[1].getBoundingClientRect();
        return Math.round(r2.left - r1.left);
    };

    const segmentWidth = getCardStep() * original;

    if (currentCardIndex > maxMiddle) {
        // move the scroll by exactly one segment to keep the same visual card
        currentCardIndex = currentCardIndex - original;
        cardsContainer.scrollLeft -= segmentWidth;
    } else if (currentCardIndex < minMiddle) {
        currentCardIndex = currentCardIndex + original;
        cardsContainer.scrollLeft += segmentWidth;
    }
}

function updateCarouselPosition() {
    if (!cardsContainer) return;
    const cards = cardsContainer.querySelectorAll('.project-card');
    if (!cards.length) return;
    // center by direct scrollLeft math to avoid unexpected snapping
    const card = cards[currentCardIndex];
    const cardRect = card.getBoundingClientRect();
    const containerRect = cardsContainer.getBoundingClientRect();
    const delta = (cardRect.left + cardRect.width / 2) - (containerRect.left + containerRect.width / 2);
    cardsContainer.scrollLeft += delta;
}

function updateCarouselButtons() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

    // --- გალერიის ფუნქციონალი ---
function openGalleryForCard(card) {
    // Store card data for gallery modal
    window.selectedCard = card;
    
    // Open gallery modal
    openGalleryModal(card);
}

    // --- გალერიის მოდალური ფანჯრის ფუნქციონალი ---
let galleryCurrentSlide = 0;
let gallerySlides = [];
let galleryDots = [];
let galleryTotalSlides = 0;

function initGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    const galleryCloseBtn = document.getElementById('galleryCloseBtn');
    const galleryPrevBtn = document.getElementById('galleryPrevBtn');
    const galleryNextBtn = document.getElementById('galleryNextBtn');
    
    if (!galleryModal) return;
    
    // Event listeners
        if (galleryCloseBtn) galleryCloseBtn.addEventListener('click', closeGalleryModal);
        if (galleryPrevBtn) galleryPrevBtn.addEventListener('click', () => changeGallerySlide(-1));
        if (galleryNextBtn) galleryNextBtn.addEventListener('click', () => changeGallerySlide(1));
    
    // Close modal when clicking outside
    galleryModal.addEventListener('click', (e) => {
        if (e.target === galleryModal) closeGalleryModal();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (galleryModal.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                changeGallerySlide(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                changeGallerySlide(1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeGalleryModal();
            }
        }
    });
}

// Open gallery modal
function openGalleryModal(card) {
    const galleryModal = document.getElementById('galleryModal');
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    if (!galleryModal) return;
    
    // Show modal
    galleryModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load gallery photos from selected card
    loadGalleryPhotosForModal();
}

// Load gallery photos for modal
function loadGalleryPhotosForModal() {
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    console.log('loadGalleryPhotosForModal called');
    console.log('window.selectedCard:', window.selectedCard);
    
    try {
            // Use photos from the selected card
        if (window.selectedCard && window.selectedCard.photos && window.selectedCard.photos.length > 0) {
            console.log('Photos found:', window.selectedCard.photos.length);
            displayGalleryPhotos(window.selectedCard.photos);
            gallery.style.display = 'block';
            noPhotos.style.display = 'none';
            return;
        }
        
        console.log('No photos found, showing no photos message');
        // If no selected card photos, show no photos message
        gallery.style.display = 'none';
        noPhotos.style.display = 'block';
    } catch (error) {
        console.error('Error loading gallery photos:', error);
        gallery.style.display = 'none';
        noPhotos.style.display = 'block';
    }
}

// Close gallery modal
function closeGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal) return;
    
    galleryModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear selected card
    window.selectedCard = null;
}

// Display photos in gallery
function displayGalleryPhotos(photos) {
    const carouselContainer = document.getElementById('galleryCarouselContainer');
    const dotsContainer = document.getElementById('galleryDots');
    
    console.log('displayGalleryPhotos called with:', photos);
    console.log('carouselContainer:', carouselContainer);
    console.log('dotsContainer:', dotsContainer);
    
    if (!carouselContainer || !dotsContainer) {
        console.error('Gallery containers not found!');
        return;
    }
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // Create slides
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `slide ${index === 0 ? 'active' : ''}`;
        
        const photoUrl = typeof photo === 'string' ? photo : photo.url;
        
        // Create like button HTML for gallery (only for authenticated users)
        const likeButtonHtml = (window.userAuthenticated) ? `
            <button class="gallery-like-btn ${window.selectedCard.is_liked ? 'liked' : ''}" data-project-id="${window.selectedCard.id}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${window.selectedCard.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
        ` : '';
        
        slide.innerHTML = `
            <img src="${photoUrl}" alt="Photo ${index + 1}">
            ${likeButtonHtml}
        `;
        carouselContainer.appendChild(slide);
        
        // Create dot
        const dot = document.createElement('button');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToGallerySlide(index));
        dotsContainer.appendChild(dot);
    });
    
    // Add like button click event listener for gallery (for all slides)
    const galleryLikeBtns = document.querySelectorAll('.gallery-like-btn');
    galleryLikeBtns.forEach(galleryLikeBtn => {
        if (galleryLikeBtn && window.selectedCard) {
            galleryLikeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeClick(window.selectedCard.id, galleryLikeBtn);
            });
        }
    });
    
    // ცვლადების განახლება
    gallerySlides = document.querySelectorAll('#galleryCarouselContainer .slide');
    galleryDots = document.querySelectorAll('#galleryDots .dot');
    galleryTotalSlides = photos.length;
    galleryCurrentSlide = 0;
}

// Show specific slide
function showGallerySlide(index) {
    if (!gallerySlides || gallerySlides.length === 0) return;
    
    gallerySlides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    
    if (galleryDots && galleryDots.length > 0) {
        galleryDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    
    galleryCurrentSlide = index;
}

// Change slide (previous/next)
function changeGallerySlide(direction) {
    if (galleryTotalSlides === 0) return;
    
    galleryCurrentSlide += direction;
    if (galleryCurrentSlide >= galleryTotalSlides) {
        galleryCurrentSlide = 0;
    } else if (galleryCurrentSlide < 0) {
        galleryCurrentSlide = galleryTotalSlides - 1;
    }
    showGallerySlide(galleryCurrentSlide);
}

// Go to specific slide
function goToGallerySlide(index) {
    if (index >= 0 && index < galleryTotalSlides) {
        showGallerySlide(index);
    }
}

    // --- მოწონების ფუნქციონალი ---
async function handleLikeClick(projectId, likeButton) {
    console.log('handleLikeClick called with projectId:', projectId);
    console.log('userAuthenticated:', window.userAuthenticated);
    
    if (!window.userAuthenticated) {
        alert('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
        return;
    }
    
    try {
        console.log('Sending like request to:', `/api/projects/${projectId}/like`);
        const response = await secureFetch(`/api/projects/${projectId}/like`, {
            method: 'POST'
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok && data.success) {
            // ღილაკის ვიზუალური მდგომარეობის განახლება
            updateLikeButton(likeButton, data.liked, data.likes_count);
            
            // პროექტის ქარდის მონაცემების განახლება
            updateProjectCardData(projectId, data.liked, data.likes_count);
            
            // რეალ-ტაიმ განახლება my_page-ისთვის
            if (data.liked) {
                // პროექტი ლაიქდა
                localStorage.setItem('projectLiked', JSON.stringify({
                    projectId: projectId,
                    timestamp: Date.now()
                }));
                window.dispatchEvent(new CustomEvent('projectLiked', {
                    detail: { projectId: projectId }
                }));
            } else {
                // პროექტი ანლაიქდა
                localStorage.setItem('projectUnliked', JSON.stringify({
                    projectId: projectId,
                    timestamp: Date.now()
                }));
                window.dispatchEvent(new CustomEvent('projectUnliked', {
                    detail: { projectId: projectId }
                }));
            }
        } else {
            // Error handling
            const errorMessage = data.error || 'შეცდომა მოწონებისას';
            if (response.status === 401) {
                alert('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
            } else {
                alert(`შეცდომა: ${errorMessage}`);
            }
        }
        
    } catch (error) {
        console.error('Error during like/unlike:', error);
        alert('შეცდომა სერვერთან კავშირისას.');
    }
}

// ყველა ლაიქის ღილაკის განახლება იგივე პროექტისთვის
function updateAllLikeButtonsForProject(projectId, isLiked) {
    // განაახლოს ყველა ღილაკი იგივე პროექტისთვის ორივე სექციაში და გალერეაში
    const allLikeButtons = document.querySelectorAll(`[data-project-id="${projectId}"]`);
    
    allLikeButtons.forEach(button => {
        // შეამოწმოს არის თუ არა ეს ლაიქის ღილაკი (ორივე კლასი)
        if (button.classList.contains('like-btn') || button.classList.contains('gallery-like-btn')) {
            const svg = button.querySelector('svg');
            if (svg) {
                if (isLiked) {
                    button.classList.add('liked');
                    svg.setAttribute('fill', '#ffffff');
                    svg.setAttribute('stroke', '#ffffff');
                } else {
                    button.classList.remove('liked');
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', '#ffffff');
                }
            }
        }
    });
    
    console.log(`Updated all like buttons for project ${projectId} to ${isLiked ? 'liked' : 'unliked'}`);
}

// მოწონების ღილაკის ვიზუალური მდგომარეობის განახლება
function updateLikeButton(likeButton, isLiked, likesCount) {
    const projectId = likeButton.getAttribute('data-project-id');
    
    console.log('updateLikeButton called:', {
        buttonClass: likeButton.className,
        projectId: projectId,
        isLiked: isLiked
    });
    
    // განაახლოს ყველა ღილაკი იგივე პროექტისთვის ორივე სექციაში და გალერეაში
    updateAllLikeButtonsForProject(projectId, isLiked);
}

// პროექტის ქარდის მონაცემების განახლება projectsCards მასივში
function updateProjectCardData(projectId, isLiked, likesCount) {
    projectsCards.forEach(card => {
        if (card.id == projectId) {
            card.is_liked = isLiked;
            card.likes_count = likesCount;
        }
    });
    
    // ასევე განაახლოს window.selectedCard (თუ ეს იგივე პროექტია)
    if (window.selectedCard && window.selectedCard.id == projectId) {
        window.selectedCard.is_liked = isLiked;
        window.selectedCard.likes_count = likesCount;
    }
    
    // სინქრონიზაცია ახლა updateLikeButton ფუნქციით ხდება
}


    // --- რეალ-ტაიმ განახლების ფუნქციონალი ---
    function setupRealtimeUpdates() {
        // მოსმენა localStorage ცვლილებების
        window.addEventListener('storage', function(e) {
            if (e.key === 'projectLiked' || e.key === 'projectUnliked') {
                console.log('Project like status changed, updating UI...');
                // განაახლოს ყველა ლაიქის ღილაკი
                const data = JSON.parse(e.newValue);
                updateAllLikeButtonsForProject(data.projectId, e.key === 'projectLiked');
            }
        });
        
        // მოსმენა custom events-ების
        window.addEventListener('projectLiked', function(e) {
            console.log('Project liked event received:', e.detail);
            updateAllLikeButtonsForProject(e.detail.projectId, true);
        });
        
        window.addEventListener('projectUnliked', function(e) {
            console.log('Project unliked event received:', e.detail);
            updateAllLikeButtonsForProject(e.detail.projectId, false);
        });
    }

    // --- ყველაფრის ინიციალიზაცია ---
    // Check authentication status on page load first
    checkAuthStatus();
    
    initProjectsCarousel().catch(error => {
        console.error('Error initializing projects carousel:', error);
    });
    initSection3Projects().catch(error => {
        console.error('Error initializing section 3 projects:', error);
    });
    initGalleryModal();
    setupRealtimeUpdates();
    
    // ძებნის ფუნქციონალის ინიციალიზაცია
    initSearchFunctionality();
});

// ადმინის პანელის გახსნა
function openAdminPanel() {
    // გახსნას ადმინის გვერდი იგივე ფანჯარაში
    window.location.href = '/admin';
}

// ===== კარუსელის ფოტოების ჩატვირთვის ფუნქცია =====
async function loadCarouselImages() {
    try {
        console.log('Loading carousel images from API...');
        const response = await fetch('/api/carousel');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Carousel API response:', data);
        
        if (data.success && data.images && data.images.length > 0) {
            renderCarouselImages(data.images);
        } else {
            console.log('No carousel images found, using default images');
            renderDefaultCarouselImages();
        }
    } catch (error) {
        console.error('Error loading carousel images from API:', error);
        console.log('Falling back to default carousel images');
        renderDefaultCarouselImages();
    }
}

// კარუსელის ფოტოების რენდერი API-დან
function renderCarouselImages(images) {
    const carouselContainer = document.getElementById('carouselContainer');
    if (!carouselContainer) return;
    
    // დალაგება რიგის მიხედვით
    const sortedImages = images.sort((a, b) => a.order - b.order);
    
    carouselContainer.innerHTML = sortedImages.map((image, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}">
            <img src="${image.url}" alt="კარუსელის ფოტო">
        </div>
    `).join('');
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// ნაგულისხმები კარუსელის ფოტოების რენდერი
function renderDefaultCarouselImages() {
    const carouselContainer = document.getElementById('carouselContainer');
    if (!carouselContainer) return;
    
    carouselContainer.innerHTML = `
        <!-- კარუსელის პირველი სლაიდი (აქტიური) -->
        <div class="carousel-slide active">
            <img src="/static/photos/car (1).jpg">
        </div>
        <!-- კარუსელის მეორე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (2).jpg">
        </div>
        <!-- კარუსელის მესამე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (3).jpg">
        </div>
        <!-- კარუსელის მეოთხე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (4).jpg">
        </div>
        <!-- კარუსელის მეხუთე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (5).jpg">
        </div>
        <!-- კარუსელის მეექვსე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (6).jpg">
        </div>
        <!-- კარუსელის მეშვიდე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (7).jpg">
        </div>
        <!-- კარუსელის მერვე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (8).jpg">
        </div>
        <!-- კარუსელის მეცხრე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (9).jpg">
        </div>
        <!-- კარუსელის მეათე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (10).jpg">
        </div>
    `;
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// მთავარი კარუსელის ინიციალიზაცია
function initMainCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    
    if (slides.length === 0) return;
    
    // ავტომატური სლაიდების შეცვლა
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    // კარუსელის ავტომატური გაშვება (5 წამში ერთხელ)
    setInterval(nextSlide, 5000);
}

// ===== ძებნის ფუნქციონალი =====
let allProjects = []; // ყველა პროექტი
let filteredProjects = []; // ფილტრირებული პროექტები
let currentSearchTerm = ''; // მიმდინარე ძებნის ტერმინი
let searchMode = false; // ძებნის რეჟიმი
let searchCurrentIndex = 0; // მიმდინარე ნაპოვნი პროექტის ინდექსი

// ძებნის ფუნქციონალის ინიციალიზაცია
function initSearchFunctionality() {
    const searchInput = document.getElementById('projectSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !searchBtn || !clearSearchBtn) return;
    
    // ძებნის ღილაკის event listener
    searchBtn.addEventListener('click', performSearch);
    
    // წმენდის ღილაკის event listener
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Enter ღილაკის event listener
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // რეალ-ტაიმ ძებნა
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        if (searchTerm.length >= 2) {
            performSearch();
        } else if (searchTerm.length === 0) {
            clearSearch();
        }
    });
    
    // ძებნის შესრულება
    function performSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        currentSearchTerm = searchTerm;
        
        if (searchTerm.length < 2) {
            clearSearch();
            return;
        }
        
        // პროექტების ფილტრაცია
        filteredProjects = allProjects.filter(project => {
            const title = (project.title || '').toLowerCase();
            const description = (project.description || '').toLowerCase();
            const area = (project.area || '').toLowerCase();
            
            return title.includes(searchTerm) || 
                   description.includes(searchTerm) || 
                   area.includes(searchTerm);
        });
        
        console.log(`Search term: "${searchTerm}"`);
        console.log(`Found ${filteredProjects.length} projects:`, filteredProjects.map(p => p.title));
        
        // ძებნის რეჟიმის განახლება
        searchMode = filteredProjects.length > 0;
        searchCurrentIndex = 0;
        
        // შედეგების ჩვენება — badge ამოღებულია, არაფერს ვაკეთებთ
        // updateSearchResults();
        updateCarouselDisplay();
        
        // ძებნის ღილაკების განახლება
        searchBtn.style.display = 'none';
        clearSearchBtn.style.display = 'flex';
    }
    
    // ძებნის წმენდა
    function clearSearch() {
        searchInput.value = '';
        currentSearchTerm = '';
        filteredProjects = [];
        searchMode = false;
        searchCurrentIndex = 0;
        
        // ყველა პროექტის ჩვენება — badge ამოღებულია, არაფერს ვაკეთებთ
        // updateSearchResults();
        updateCarouselDisplay();
        
        // ძებნის ღილაკების განახლება
        searchBtn.style.display = 'flex';
        clearSearchBtn.style.display = 'none';
    }
    
    // ძებნის შედეგების განახლება
    function updateSearchResults() { /* badge removed */ }
    
    // კარუსელის ჩვენების განახლება
    function updateCarouselDisplay() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer) return;
        
        const projectCards = cardsContainer.querySelectorAll('.project-card');
        
        if (searchMode && filteredProjects.length > 0) {
            // ძებნის რეჟიმი - ყველა პროექტი ჩანს, ნაპოვნი ხაზგასმულია
            
            projectCards.forEach((card) => {
                const projectId = card.dataset.projectId;
                const isFound = filteredProjects.some(project => project.id == projectId);

                if (isFound) {
                    // ვაჩვენებთ და ვანიჭებთ კლასს
                    card.style.display = 'block';
                    card.classList.add('search-highlighted');
                } else {
                    // ვმალავთ არანაპოვნ ქარდებს
                    card.style.display = 'none';
                }
            });
            
            // პირველი ნაპოვნი პროექტისკენ სქროლვა
            const firstFoundCard = cardsContainer.querySelector('.project-card.search-highlighted');
            if (firstFoundCard) {
                scrollToCard(firstFoundCard);
            }
        } else {
            // ჩვეულებრივი რეჟიმი - ყველა პროექტი ჩანს
            
            projectCards.forEach(card => {
                card.style.display = 'block';
                card.style.opacity = '1';
                card.classList.remove('search-highlighted');
            });
            
            // კარუსელის საწყის პოზიციაზე დაბრუნება
            cardsContainer.style.transform = 'translateX(0px)';
        }
    }
    
}

// კონკრეტულ ქარდზე სქროლვის ფუნქცია (გლობალური)
function scrollToCard(targetCard) {
    const container = document.getElementById('cardsWrapper');
    if (!container || !targetCard) return;
    
    // იყენებს კონტეინერის scrollLeft-ს გვერდის სქროლვის ნაცვლად
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const scrollLeft = cardRect.left - containerRect.left + container.scrollLeft - (containerRect.width / 2) + (cardRect.width / 2);
    
    container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

// სექცია 2-ის ისრების ფუნქციონალი
function initSection2Arrows() {
    const prevBtn = document.getElementById('section2PrevBtn');
    const nextBtn = document.getElementById('section2NextBtn');
    const container = document.getElementById('cardsWrapper');
    
    if (!prevBtn || !nextBtn || !container) return;
    
    // წინა ისრის მოვლენა
    prevBtn.addEventListener('click', () => {
        const cards = container.querySelectorAll('.project-card');
        if (cards.length === 0) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        
        // ვპოულობთ ყველაზე ახლო ქარდს ცენტრთან
        let closestCard = null;
        let minDistance = Infinity;
        
        cards.forEach(card => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = Math.abs(cardCenter - containerCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });
        
        if (closestCard) {
            // ვპოულობთ წინა ქარდს
            const allCards = Array.from(cards);
            const currentIndex = allCards.indexOf(closestCard);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : allCards.length - 1;
            
            scrollToCard(allCards[prevIndex]);
        }
    });
    
    // შემდეგი ისრის მოვლენა
    nextBtn.addEventListener('click', () => {
        const cards = container.querySelectorAll('.project-card');
        if (cards.length === 0) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        
        // ვპოულობთ ყველაზე ახლო ქარდს ცენტრთან
        let closestCard = null;
        let minDistance = Infinity;
        
        cards.forEach(card => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = Math.abs(cardCenter - containerCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });
        
        if (closestCard) {
            // ვპოულობთ შემდეგ ქარდს
            const allCards = Array.from(cards);
            const currentIndex = allCards.indexOf(closestCard);
            const nextIndex = currentIndex < allCards.length - 1 ? currentIndex + 1 : 0;
            
            scrollToCard(allCards[nextIndex]);
        }
    });
}